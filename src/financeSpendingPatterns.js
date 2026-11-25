import {calendarMonthDays,requireCalendarDate,shiftCalendarDay} from "./financeCalendar.js";
import {cents} from "./financeStage1Analytics.js";

// Deterministic, explainable, read-only spending analysis. No SQL, AI or mutation.
const toRM=sen=>sen/100;
const median=values=>{
  if(!values.length)return null;
  const v=[...values].sort((a,b)=>a-b),n=v.length;
  return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;
};
const sum=values=>values.reduce((a,b)=>a+b,0);
const monthShift=(month,offset)=>{
  const [y,m]=month.split("-").map(Number);
  const d=new Date(Date.UTC(y,m-1+offset,1));
  return d.toISOString().slice(0,7);
};
const startMonth=date=>date.slice(0,7)+"-01";
const cutOff=(month,day)=>month+"-"+String(Math.min(Number(day),calendarMonthDays(month))).padStart(2,"0");
const group=(rows,key)=>rows.reduce((map,row)=>{
  const k=key(row),list=map.get(k)||[];list.push(row);map.set(k,list);return map;
},new Map());
const total=rows=>sum(rows.map(r=>r.sen));
const chart=(labels,values)=>labels.map((label,i)=>({label,value:values[i]}));
const evidence=rows=>rows.slice(0,20).map(r=>({
  id:r.id,date:r.date,category:r.category,note:r.note,method:r.method,amount:toRM(r.sen)
}));
const discovery=(kind,category,titleZh,titleEn,summaryZh,summaryEn,score,samples,rows,whyZh,whyEn,meta={})=>({
  id:kind+":"+category,kind,category,titleZh,titleEn,summaryZh,summaryEn,
  score,samples,evidence:evidence(rows),whyZh,whyEn,...meta
});

export const SPENDING_RADAR_KINDS=Object.freeze(["category","weekday","frequency","large","trend","outlier"]);

export function discoverSpendingPatterns(records,{asOfDate,baselineMonths=3}={}) {
  requireCalendarDate(asOfDate);
  if(!Array.isArray(records))throw Error("Complete Expense snapshot is unavailable.");
  if(![3,6].includes(baselineMonths))throw Error("Unsupported spending comparison range.");
  const currentMonth=asOfDate.slice(0,7),day=asOfDate.slice(-2);
  const historyStart=startMonth(monthShift(currentMonth,-Math.max(6,baselineMonths)));
  const expenses=[];
  for(const r of records) {
    if(!r||r.type!=="expense"||r.deleted_at||r.date>asOfDate)continue;
    requireCalendarDate(r.date);
    const sen=cents(r.amount);
    if(sen<=0)throw Error("Non-positive Expense in spending analysis.");
    expenses.push({id:r.id,date:r.date,category:String(r.category||"").trim()||"Unknown",
      method:String(r.method||""),note:String(r.note||""),sen});
  }
  const eligible=expenses.filter(r=>r.date>=historyStart),recent=eligible.filter(r=>r.date>=shiftCalendarDay(asOfDate,-119));
  const months=Array.from({length:baselineMonths},(_,i)=>monthShift(currentMonth,i-baselineMonths));
  const previous=months.map(month=>{
    const first=startMonth(month),last=cutOff(month,day);
    return {month,first,last,rows:eligible.filter(r=>r.date>=first&&r.date<=last)};
  });
  const current=eligible.filter(r=>r.date>=startMonth(asOfDate)&&r.date<=asOfDate);
  const validMonths=previous.filter(m=>m.rows.length>=2);
  // Sparse diaries cannot support a reliable general assertion about habits.
  if(recent.length<10||current.length<2||validMonths.length<2){
    return {status:"insufficient",findings:[],analyzed:eligible.length,
      explanation:"Not enough comparable saved Expenses to infer reliable spending habits.",
      baselineMonths,asOfDate};
  }
  const findings=[],currentByCategory=group(current,r=>r.category);
  const categories=[...new Set([...current.map(r=>r.category),
    ...previous.flatMap(m=>m.rows.map(r=>r.category))])];
  for(const category of categories) {
    const mine=currentByCategory.get(category)||[];
    if(!mine.length)continue;
    const amounts=validMonths.map(m=>total(m.rows.filter(r=>r.category===category)));
    const baseline=median(amounts);
    const curr=total(mine);
    if(baseline!==null&&baseline>0&&curr-baseline>=3000&&curr>=baseline*1.35){
      const pct=Math.round((curr/baseline-1)*1000)/10;
      const labels=[...validMonths.map(m=>m.month),currentMonth];
      findings.push(discovery("category",category,
        category+"消费高于历史同期",category+" spending above comparable months",
        "同期基准 "+toRM(baseline).toFixed(2)+" → 本期 "+toRM(curr).toFixed(2)+" RM（+"+pct+"%）",
        "Comparable baseline RM"+toRM(baseline).toFixed(2)+" → current RM"+toRM(curr).toFixed(2)+" (+"+pct+"%)",
        (curr-baseline)/100,
        chart(labels,[...amounts,curr].map(toRM)),mine,
        "对比历史可用月份相同日期区间的分类总额，使用中位数；增长至少35%及RM30才提示。",
        "Median of the same days in prior comparable months; minimum +35% and +RM30.",
        {changePct:pct,baseValue:toRM(baseline),currentValue:toRM(curr)}));
    }
    const counts=validMonths.map(m=>m.rows.filter(r=>r.category===category).length);
    const typical=median(counts);
    if(typical!==null&&typical>=2&&mine.length-typical>=3&&mine.length>=typical*1.5) {
      const pct=Math.round((mine.length/typical-1)*1000)/10;
      findings.push(discovery("frequency",category,
        category+"消费次数增加",category+" transactions became more frequent",
        "同期基准 "+typical+" 笔 → 本期 "+mine.length+" 笔（+"+pct+"%）",
        "Comparable baseline "+typical+" → "+mine.length+" transactions (+"+pct+"%)",
        mine.length-typical,chart([...validMonths.map(m=>m.month),currentMonth],[...counts,mine.length]),mine,
        "先比较相同日期范围内的交易笔数，再单独观察金额；增加至少3笔且50%才提示。",
        "Transaction count compared over like-for-like dates; at least +3 and +50% before flagging.",
        {changePct:pct,baseValue:typical,currentValue:mine.length}));
    }
    const currTotal=total(mine),largest=[...mine].sort((a,b)=>b.sen-a.sen)[0];
    if(mine.length>=2&&currTotal>=15000&&largest.sen/currTotal>=.65){
      const share=Math.round(largest.sen/currTotal*1000)/10;
      findings.push(discovery("large",category,
        category+"支出集中在单笔交易",category+" dominated by a single purchase",
        "单笔 RM"+toRM(largest.sen).toFixed(2)+"，占该分类 "+share+"%",
        "Largest RM"+toRM(largest.sen).toFixed(2)+" represents "+share+"% of category spending",
        share,chart(["其他","最大单笔"],[toRM(currTotal-largest.sen),toRM(largest.sen)]),
        [largest,...mine.filter(r=>r.id!==largest.id)],
        "分类本期总额至少RM150，并有至少2笔记录；最大单笔占比达到65%。",
        "At least RM150 and 2 transactions; one purchase accounts for at least 65%.",
        {share,baseValue:toRM(currTotal),currentValue:toRM(largest.sen)}));
    }
  }
  // Eight-week weekday averages: exactly 56 calendar days, including recorded zero days.
  const start=shiftCalendarDay(asOfDate,-55),weekdayRows=eligible.filter(r=>r.date>=start&&r.date<=asOfDate);
  if(weekdayRows.length>=12){
    const byWeekday=Array.from({length:7},()=>({sen:0,days:0,rows:[]}));
    for(let i=0;i<56;i++){
      const date=shiftCalendarDay(start,i),weekday=new Date(date+"T00:00:00Z").getUTCDay();
      byWeekday[weekday].days++;
    }
    for(const row of weekdayRows){
      const wd=new Date(row.date+"T00:00:00Z").getUTCDay();
      byWeekday[wd].sen+=row.sen;byWeekday[wd].rows.push(row);
    }
    const avg=byWeekday.map(g=>g.sen/g.days);
    const highest=avg.indexOf(Math.max(...avg));
    const others=(sum(avg)-avg[highest])/6;
    if(others>0&&avg[highest]-others>=1500&&avg[highest]>=others*1.6){
      const weekdayZh=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
      const weekdayEn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const pct=Math.round((avg[highest]/others-1)*1000)/10;
      findings.push(discovery("weekday",String(highest),
        weekdayZh[highest]+"平均消费较高",weekdayEn[highest]+" daily spending is higher",
        "该日平均 RM"+toRM(avg[highest]).toFixed(2)+"，其他六天平均 RM"+toRM(others).toFixed(2),
        "Daily RM"+toRM(avg[highest]).toFixed(2)+" vs other weekdays RM"+toRM(others).toFixed(2),
        (avg[highest]-others)/100,chart(weekdayEn,avg.map(toRM)),byWeekday[highest].rows,
        "过去56个自然日，按每个星期几的8个日历日计算日均金额；缺失记账可能影响结果。",
        "Eight calendar occurrences per weekday over 56 days; missing diary entries can bias this estimate.",
        {changePct:pct,baseValue:toRM(others),currentValue:toRM(avg[highest])}));
    }
  }
  // Sustained trends require FOUR complete, independently observed months.
  const completeMonths=Array.from({length:4},(_,i)=>monthShift(currentMonth,i-4));
  const complete=completeMonths.map(month=>({
    month,rows:eligible.filter(r=>r.date.startsWith(month))
  }));
  if(complete.every(m=>m.rows.length>=2)){
    const trendCategories=[...new Set(complete.flatMap(m=>m.rows.map(r=>r.category)))];
    for(const category of trendCategories){
      const amounts=complete.map(m=>total(m.rows.filter(r=>r.category===category)));
      if(amounts[0]>0&&amounts.every((v,i)=>i===0||v>amounts[i-1])&&
        amounts[3]-amounts[0]>=5000&&amounts[3]>=amounts[0]*1.35){
        findings.push(discovery("trend",category,category+"连续四个月增加",
          category+" increased for four complete months",
          "从 RM"+toRM(amounts[0]).toFixed(2)+" 升至 RM"+toRM(amounts[3]).toFixed(2),
          "From RM"+toRM(amounts[0]).toFixed(2)+" to RM"+toRM(amounts[3]).toFixed(2),
          toRM(amounts[3]-amounts[0]),
          chart(completeMonths,amounts.map(toRM)),complete.flatMap(m=>m.rows.filter(r=>r.category===category)),
          "仅对最近四个完整月份比较；各月该分类支出严格上升，累计增加至少RM50及35%。",
          "Four complete months, strict month-over-month increase, at least +RM50 and +35%."));
      }
    }
  }
  // Robust single-transaction deviation. Historical peer count >= 6.
  for(const [category,mine] of currentByCategory.entries()){
    const prior=eligible.filter(r=>r.category===category&&r.date<startMonth(asOfDate)&&r.date>=shiftCalendarDay(asOfDate,-120));
    if(prior.length<6)continue;
    const normal=median(prior.map(r=>r.sen)),mad=median(prior.map(r=>Math.abs(r.sen-normal)));
    if(!normal||mad===null)continue;
    const flagged=[...mine].filter(r=>r.sen>=normal*3&&r.sen-normal>=Math.max(5000,3*mad))
      .sort((a,b)=>b.sen-a.sen);
    if(flagged.length){
      const item=flagged[0];
      findings.push(discovery("outlier",category,
        category+"出现远高于常见金额的单笔消费",
        category+" has a purchase far above its typical amount",
        "本笔 RM"+toRM(item.sen).toFixed(2)+"，历史单笔中位数 RM"+toRM(normal).toFixed(2),
        "Purchase RM"+toRM(item.sen).toFixed(2)+" vs historical median RM"+toRM(normal).toFixed(2),
        toRM(item.sen-normal),chart(["历史单笔中位数","这笔交易"],[toRM(normal),toRM(item.sen)]),
        [item,...prior.slice(-10)],
        "至少6笔历史同类记录；超过历史中位数3倍，并超过稳健差异门槛。不代表记录一定错误。",
        "At least 6 historical peers; exceeds 3× median and robust deviation threshold. Not proof of error."));
    }
  }
  return {status:"ready",findings:findings.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),
    analyzed:eligible.length,baselineMonths,asOfDate,
    explanation:"Statistical observations from saved Expenses, not predictions or financial advice."};
}
