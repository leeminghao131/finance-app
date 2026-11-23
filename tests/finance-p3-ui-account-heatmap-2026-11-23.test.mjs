import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  chartDayFractions,chartViewport,chartTimeTickIndices,chartLineRuns,
  chartBalanceSegments,chartHasVisibleBar
} from "../src/financeChartPlot.js";
import {
  heatmapScopeMonths,heatmapPageMonth,heatmapMonthCalendarDays,
  heatmapShiftMonth,heatmapMonthIndex
} from "../src/financeHeatmapScope.js";
import {
  DEFAULT_FINANCE_BALANCE_ALERT,financeBalanceAlertKey,
  readFinanceBalanceAlert,saveFinanceBalanceAlert,normalizedFinanceBalanceAlert
} from "../src/financeBalanceAlertPreference.js";

const source=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const moneyRows=[
  {dateKey:"2026-11-01",expense:10,balanceGreen:1010,balanceRed:null},
  {dateKey:"2026-11-02",expense:20,balanceGreen:990,balanceRed:null},
  {dateKey:"2026-11-12",expense:0,balanceGreen:970,balanceRed:null},
  {dateKey:"2026-11-13",expense:30,balanceGreen:940,balanceRed:null}
];
test("P3 #10: missing calendar days have REAL proportional X spacing, not equal row spacing",()=>{
  const fractions=chartDayFractions(moneyRows);
  assert.ok(fractions);
  assert.equal(fractions[0],0);
  assert.equal(fractions[3],1);
  assert.ok(Math.abs(fractions[1]-1/12)<1e-10);
  assert.ok(Math.abs(fractions[2]-11/12)<1e-10);
  const view=chartViewport(moneyRows,"expense",760,260);
  assert.deepEqual(view.dateFractions,fractions);
  const near=view.x(1)-view.x(0),far=view.x(2)-view.x(1);
  assert.ok(Math.abs(far/near-10)<1e-8,"10 actual days must be 10x 1-day spacing");
  assert.deepEqual(chartLineRuns(moneyRows,"expense",view).flat().map(p=>p.value),[10,20,0,30]);
});

test("P3 #10: invalid, duplicate and unsorted dates fail safe to legacy index positions",()=>{
  for(const days of [
    ["2026-11-01","2026-11-01","2026-11-02"],
    ["2026-11-10","2026-11-01","2026-11-12"],
    ["2026-02-30","2026-03-01"],
    ["2026-11-01","not-a-day"],
  ])assert.equal(chartDayFractions(days.map(date=>({dateKey:date,expense:5}))),null);
  const bad=[{dateKey:"2026-11-10",expense:3},{dateKey:"2026-11-01",expense:2},
    {dateKey:"2026-11-12",expense:1}];
  const view=chartViewport(bad,"expense",760,240);
  assert.equal(view.dateFractions,null);
  assert.ok(Math.abs(view.x(1)-(view.x(0)+view.x(2))/2)<1e-8);
  assert.equal(chartDayFractions([moneyRows[0]]),null);
});

test("P3 #10: sparse tick labels obey pixel spacing and retain first/last dates",()=>{
  const view=chartViewport(moneyRows,"expense",760,240);
  const tick=chartTimeTickIndices(moneyRows,view,7,72);
  assert.equal(tick[0],0);
  assert.equal(tick[tick.length-1],moneyRows.length-1);
  assert.ok(tick.every((x,i)=>i===0||view.x(x)-view.x(tick[i-1])>=72));
  const tiny=chartViewport(moneyRows,"expense",200,130);
  const short=chartTimeTickIndices(moneyRows,tiny,7,72);
  assert.equal(short[0],0);
  assert.equal(short[short.length-1],moneyRows.length-1);
  assert.ok(short.length<=2,"narrow phones must not get crowded date labels");
  const native=source("FinanceNativeChart.jsx");
  assert.match(native,/chartTimeTickIndices\(data,view/);
  assert.match(native,/\(position\(index-1\)\+position\(index\)\)\/2/);
  assert.match(native,/\(position\(index\)\+position\(index\+1\)\)\/2/);
});

test("P3 #10: null future balance stays a real gap with date-correct threshold crossing",()=>{
  const rows=[
    {dateKey:"2026-11-01",balanceGreen:1800,balanceRed:null},
    {dateKey:"2026-11-11",balanceGreen:null,balanceRed:900},
    {dateKey:"2026-11-21",balanceGreen:null,balanceRed:null},
    {dateKey:"2026-12-01",balanceGreen:null,balanceRed:null},
  ];
  const view=chartViewport(rows,"balance",540,250);
  const segments=chartBalanceSegments(rows,view,1500);
  assert.equal(segments.length,2,"crossing creates two exact colored line pieces");
  assert.ok(Math.abs(segments[0].x2-(view.x(0)+(view.x(1)-view.x(0))/3))<1e-8);
  assert.ok(!segments.some(s=>s.end>1),"future null actual never connects");
  assert.equal(chartLineRuns(rows,"balanceGreen",view).length,1);
  assert.equal(chartLineRuns(rows,"balanceGreen",view)[0].length,1);
});

test("P3 #11: zero or missing amounts produce NO bar; negative net remains visible",()=>{
  assert.equal(chartHasVisibleBar(0),false);
  assert.equal(chartHasVisibleBar("0.00"),false);
  assert.equal(chartHasVisibleBar(null),false);
  assert.equal(chartHasVisibleBar(undefined),false);
  assert.equal(chartHasVisibleBar(""),false);
  assert.equal(chartHasVisibleBar(100),true);
  assert.equal(chartHasVisibleBar(-50),true);
  assert.equal(chartHasVisibleBar("1.25"),true);
  for(const component of ["FinanceNativeChart.jsx","FinanceNativeMultiSeriesChart.jsx"]){
    const src=source(component);
    assert.match(src,/if\(!chartHasVisibleBar\(value\)\)return null/);
    assert.match(src,/Math\.max\(1\.\d+,Math\.abs\(baseline/);
  }
});

test("P3 #14: alert threshold is account scoped, persists reload and does not touch legacy key",()=>{
  const saved=new Map([["finance-balance-limit-v3","9300"]]);
  const storage={
    getItem:key=>saved.has(key)?saved.get(key):null,
    setItem:(key,value)=>saved.set(key,String(value)),
  };
  assert.equal(readFinanceBalanceAlert("userA",storage),DEFAULT_FINANCE_BALANCE_ALERT);
  assert.equal(readFinanceBalanceAlert("userB",storage),DEFAULT_FINANCE_BALANCE_ALERT);
  assert.equal(saveFinanceBalanceAlert("userA","0",storage),true);
  assert.equal(saveFinanceBalanceAlert("userB","2250.75",storage),true);
  assert.notEqual(financeBalanceAlertKey("userA"),financeBalanceAlertKey("userB"));
  assert.equal(readFinanceBalanceAlert("userA",storage),"0");
  assert.equal(readFinanceBalanceAlert("userB",storage),"2250.75");
  assert.equal(readFinanceBalanceAlert("userC",storage),"1500");
  assert.equal(saved.get("finance-balance-limit-v3"),"9300");
  assert.equal(saveFinanceBalanceAlert(null,"1500",storage),false);
  assert.equal(saveFinanceBalanceAlert("userA","bad",storage),false);
  assert.equal(readFinanceBalanceAlert("userA",storage),"0");
  assert.equal(readFinanceBalanceAlert(null,storage),"1500");
});

test("P3 #14: invalid and partially typed alert values never overwrite a good saved preference",()=>{
  for(const input of ["","-1","Infinity","NaN","25.555","1,000","2e3","1000000000001"])
    assert.equal(normalizedFinanceBalanceAlert(input),null,input);
  assert.equal(normalizedFinanceBalanceAlert("0"),"0");
  assert.equal(normalizedFinanceBalanceAlert("1499.99"),"1499.99");
  assert.equal(normalizedFinanceBalanceAlert("1500"),"1500");
  const app=source("App.jsx");
  assert.match(app,/balanceLimitPreference\.owner===user\?\.id/);
  assert.match(app,/balanceLimitPreference\.owner!==user\.id/);
  assert.match(app,/readFinanceBalanceAlert\(owner/);
  assert.match(app,/saveFinanceBalanceAlert\(user\.id,balanceLimitPreference\.value/);
  assert.doesNotMatch(app,/localStorage\.setItem\(BALANCE_LIMIT_KEY/);
  assert.doesNotMatch(app,/localStorage\.getItem\(BALANCE_LIMIT_KEY/);
  const helper=source("financeBalanceAlertPreference.js");
  assert.doesNotMatch(helper,/\.from\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});

test("P3 #17: year scope covers all 12 calendar months, even with no spending",()=>{
  const scope=heatmapScopeMonths("year",[],"2024");
  assert.deepEqual(scope,{first:"2024-01",last:"2024-12"});
  const months=[];
  for(let page=scope.first;page;page=heatmapShiftMonth(page,1,scope))months.push(page);
  assert.equal(months.length,12);
  assert.equal(months[0],"2024-01");
  assert.equal(months.at(-1),"2024-12");
  const feb=heatmapMonthCalendarDays("2024-02",[]);
  assert.equal(feb.length,29);
  assert.equal(feb.at(-1).date,"2024-02-29");
  assert.ok(feb.every(d=>d.amount===0));
  assert.equal(heatmapShiftMonth("2024-01",-1,scope),null);
  assert.equal(heatmapShiftMonth("2024-12",1,scope),null);
  assert.equal(heatmapPageMonth(scope,"","2024-06-30"),"2024-06");
});

test("P3 #17: all-history scope navigates every month, not latest 35 active days",()=>{
  const rows=[
    {date:"2018-01-01",type:"income",amount:2000},
    {date:"2026-11-23",type:"expense",amount:20},
  ];
  const copy=JSON.stringify(rows);
  const scope=heatmapScopeMonths("all",rows,"");
  assert.deepEqual(scope,{first:"2018-01",last:"2026-11"});
  const total=heatmapMonthIndex(scope.last)-heatmapMonthIndex(scope.first)+1;
  assert.ok(total>35,"more than 35 whole months are reachable without huge DOM");
  let months=0;
  for(let page=scope.first;page;page=heatmapShiftMonth(page,1,scope))months++;
  assert.equal(months,total);
  const first=heatmapMonthCalendarDays("2018-01",[{date:"2018-01-01",amount:0}]);
  const last=heatmapMonthCalendarDays("2026-11",[{date:"2026-11-23",amount:20}]);
  assert.equal(first[0].amount,0);
  assert.equal(last.find(row=>row.date==="2026-11-23").amount,20);
  assert.equal(last.length,30);
  assert.equal(heatmapPageMonth(scope,"2020-07","2026-11-23"),"2020-07");
  assert.equal(heatmapPageMonth(scope,"2028-12","2026-11-23"),"2026-11");
  assert.equal(heatmapScopeMonths("all",[],""),null);
  assert.equal(JSON.stringify(rows),copy);
});

test("P3 #17: daily popup remains accessible while heatmap only renders one month at a time",()=>{
  const app=source("App.jsx");
  assert.doesNotMatch(app,/\.slice\(-35\)/);
  assert.match(app,/heatmapMonthCalendarDays\(page,days\)/);
  assert.match(app,/filterMode==="year"\|\|filterMode==="all"/);
  assert.match(app,/aria-label="Complete spending heatmap month navigation"/);
  assert.match(app,/type="month" value=\{page\} min=\{scope.first\} max=\{scope.last\}/);
  assert.match(app,/onClick=\{event=>\{heatmapTriggerRef\.current=event\.currentTarget;[\s\S]*?setSelectedOwner\(ownerKey\);setSelectedDate\(d\.date\);\}\}/);
  assert.match(app,/<FinanceHeatmapDayDetails/);
  assert.match(app,/ownerKey=\{user\?\.id\}/);
  assert.match(app,/selectedDay=selectedOwner===ownerKey/);
  assert.match(app,/setSelectedOwner\(null\)/);
  assert.match(app,/Math\.max\(largest,day\.amount\|\|0\)/);
});
