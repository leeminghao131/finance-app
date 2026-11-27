import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {discoverSpendingPatterns} from "../src/financeSpendingPatterns.js";
import {shiftCalendarDay} from "../src/financeCalendar.js";
import {FINANCE_DOCK_IDS,normalizeDockOrder,moveDockItem} from "../src/financeDockOrder.js";

const asOfDate="2026-11-25";
const row=(date,category,amount,id="id"+date+category+amount)=>({id,date,category,amount,
  type:"expense",method:"TNG",note:"Sample",deleted_at:null});
const options={asOfDate,baselineMonths:3};
const hist=(category="饮食",perMonth=4,amount=20)=>{
  const rows=[];
  for(const month of ["2026-07","2026-08","2026-09","2026-10"])
    for(let i=0;i<perMonth;i++)
      rows.push(row(month+"-"+String(2+i*4).padStart(2,"0"),category,amount,month+"-"+i));
  return rows;
};
const base=()=>[...hist(),...Array.from({length:4},(_,i)=>row("2026-11-"+String(2+i*5).padStart(2,"0"),"饮食",32,"current"+i))];
const result=rows=>discoverSpendingPatterns(rows,options);
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("Radar does not silently fabricate patterns from sparse Expense data",()=>{
  const x=result([row("2026-11-23","饮食",120)]);
  assert.equal(x.status,"insufficient");
  assert.equal(x.findings.length,0);
});
test("Category growth compares equivalent calendar-day windows and uses sen precision",()=>{
  const rows=base(),before=JSON.stringify(rows);
  const x=result(rows);
  assert.equal(x.status,"ready");
  assert.ok(x.findings.some(f=>f.kind==="category"&&f.category==="饮食"));
  assert.equal(JSON.stringify(rows),before);
});
test("Frequency counts transactions instead of mistaking count for total amount",()=>{
  const rows=[...hist(),...Array.from({length:10},(_,i)=>row("2026-11-"+String(2+i*2).padStart(2,"0"),"饮食",10,"f"+i))];
  const x=result(rows);
  assert.ok(x.findings.some(f=>f.kind==="frequency"&&f.category==="饮食"));
});
test("One large purchase is flagged as dominant with traceable saved transaction",()=>{
  const rows=[...hist(),row("2026-11-02","饮食",300,"special"),row("2026-11-03","饮食",20,"small1"),row("2026-11-04","饮食",20,"small2")];
  const x=result(rows),large=x.findings.find(f=>f.kind==="large");
  assert.ok(large);
  assert.equal(large.evidence[0].id,"special");
  assert.ok(large.share>85);
});
test("Trend requires four complete months and does not invent future predictions",()=>{
  const rows=[];
  for(const [month,amount] of [["2026-07",20],["2026-08",28],["2026-09",36],["2026-10",44]]){
    for(let i=0;i<5;i++)rows.push(row(month+"-"+String(i+2).padStart(2,"0"),"交通",amount,month+"-"+i));
  }
  for(let i=0;i<4;i++)rows.push(row("2026-11-"+String(i+2).padStart(2,"0"),"交通",30,"now"+i));
  const x=result(rows);
  assert.ok(x.findings.some(f=>f.kind==="trend"&&f.category==="交通"));
});
test("Outlier uses historical peer median and a robust lower bound",()=>{
  const rows=[...hist("医疗",7,20),row("2026-11-02","医疗",120,"anomaly"),row("2026-11-03","医疗",20,"regular")];
  const x=result(rows);
  assert.ok(x.findings.some(f=>f.kind==="outlier"&&f.evidence[0].id==="anomaly"));
});
test("Weekday analysis normalizes each of 56 calendar days, not sums of mismatched weekdays",()=>{
  const rows=[...hist("教育",3,20)];
  for(let i=0;i<56;i++){
    const day=shiftCalendarDay("2026-10-01",i);
    const weekday=new Date(day+"T00:00:00Z").getUTCDay();
    rows.push(row(day,"饮食",weekday===5?80:2,"weekday"+i));
  }
  const x=result(rows);
  assert.ok(x.findings.some(f=>f.kind==="weekday"));
});
test("Only genuine Expenses participate: no deleted, future, income, transfer or claim expenses",()=>{
  const rows=base();
  rows.push({...row("2026-11-04","饮食",999999,"gone"),deleted_at:"2026-11-05T00:00:00Z"});
  rows.push(row("2026-12-10","饮食",999999,"future"));
  rows.push({...row("2026-11-04","饮食",999999,"in"),type:"income"});
  rows.push({...row("2026-11-04","饮食",999999,"transfer"),type:"transfer"});
  rows.push({...row("2026-11-04","饮食",999999,"claim"),type:"claim"});
  assert.deepEqual(result(rows).findings,result(base()).findings);
});
test("Incomplete snapshots and invalid saved cents fail closed",()=>{
  assert.throws(()=>result(null),/Complete Expense/);
  assert.throws(()=>result([...base(),row("2026-11-07","饮食",0.009)]),/Invalid RM/);
  assert.throws(()=>discoverSpendingPatterns(base(),{asOfDate,baselineMonths:5}),/Unsupported/);
});
test("Radar is a new reorderable drawer item, but no extra home card or finance writer",()=>{
  const dock=src("FinanceInsightsDock.jsx"),radar=src("FinanceSpendingRadar.jsx"),css=src("financeSpendingRadar.css");
  assert.equal(FINANCE_DOCK_IDS.length,11);
  assert.ok(FINANCE_DOCK_IDS.indexOf("radar")>FINANCE_DOCK_IDS.indexOf("comparison"));
  assert.ok(dock.includes('id:"radar"'));
  assert.ok(dock.includes('React.lazy(() => import("./FinanceSpendingRadar.jsx"))'));
  assert.ok(dock.includes('<DockCardPopup title={zh?"消费雷达":"Spending Radar"}'));
  assert.ok(radar.includes("discoverSpendingPatterns(records,{asOfDate,baselineMonths})"));
  assert.doesNotMatch(radar,/\.from\(|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(css,/animation:[^;]+infinite/);
  const sorted=moveDockItem(normalizeDockOrder(FINANCE_DOCK_IDS),"radar","wrapped");
  assert.equal(sorted[0],"radar");
});
