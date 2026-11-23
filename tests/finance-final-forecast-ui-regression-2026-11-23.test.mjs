import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateCashForecast} from "../src/financeInsights.js";
import {validateAccountChecks,validateReviewState,validateBills} from "../src/financeStage2.js";
import {buildFinanceWorkbook} from "../src/financeExcel.js";
import {claimCashMovements} from "../src/financeClaims.js";
const src=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");

function oldReferenceForecast(records,{asOfDate,plannedIncomes=[],openingBalanceTotal=0,claimMovements=[],trailingDays=30,horizonDays=30}){
  const inc=records.filter(x=>x.type==="income"&&x.date<=asOfDate).reduce((x,r)=>x+Math.round(r.amount*100),0);
  const exp=records.filter(x=>x.type==="expense"&&x.date<=asOfDate).reduce((x,r)=>x+Math.round(r.amount*100),0);
  const base=Math.round(openingBalanceTotal*100)+inc-exp+
    claimMovements.filter(e=>e.date<=asOfDate).reduce((x,e)=>x+e.sen,0);
  const start=new Date(asOfDate+"T00:00:00Z");
  const days=[];
  const recordsByDay=(date)=>Math.round(openingBalanceTotal*100)+
    records.filter(r=>r.date<=date).reduce((n,r)=>n+(r.type==="income"?1:-1)*Math.round(r.amount*100),0)+
    claimMovements.filter(e=>e.date<=date).reduce((n,e)=>n+e.sen,0);
  for(let i=29;i>=0;i--){
    const d=new Date(start.getTime()-i*86400000).toISOString().slice(0,10);
    days.push({date:d,actual:recordsByDay(d)/100,forecast:null});
  }
  days[days.length-1].forecast=base/100;
  const first=new Date(start.getTime()-(trailingDays-1)*86400000).toISOString().slice(0,10);
  const spending=records.filter(r=>r.type==="expense"&&r.date>=first&&r.date<=asOfDate)
    .reduce((n,r)=>n+Math.round(r.amount*100),0);
  for(let i=1;i<=horizonDays;i++){
    const d=new Date(start.getTime()+i*86400000).toISOString().slice(0,10);
    const income=plannedIncomes.filter(p=>p.date>asOfDate&&p.date<=d)
      .reduce((n,p)=>n+Math.round(p.amount*100),0);
    days.push({date:d,actual:null,forecast:Math.round(base+income-Math.round(spending/trailingDays*i))/100});
  }
  return days;
}

test("FINAL P2-11: optimized forecast reproduces exact historic and future MYR cents",()=>{
  const rows=[];
  const first=Date.parse("2026-09-01T00:00:00Z");
  for(let i=0;i<180;i++){
    const date=new Date(first+(i%100)*86400000).toISOString().slice(0,10);
    rows.push({date,type:i%9===0?"income":"expense",amount:((i*29)%340+1)/100});
  }
  const plans=[{id:"income-1",date:"2026-12-01",amount:2500},{id:"income-2",date:"2026-12-15",amount:100.50}];
  const claims=[{id:"c1",paid_on:"2026-11-02",amount:75,method:"BANK",user_id:"A"}];
  const repayments=[{id:"r1",claim_id:"c1",amount:20,received_on:"2026-11-12",method:"BANK",user_id:"A"}];
  const movements=claimCashMovements(claims,repayments);
  const opts={asOfDate:"2026-11-23",selectedMonth:"2026-11",horizon:"30days",
    trailingDays:30,plannedIncomes:plans,openingBalanceTotal:125.75,claimMovements:movements};
  const modern=calculateCashForecast(rows,opts);
  const reference=oldReferenceForecast(rows,{...opts,horizonDays:30});
  assert.equal(modern.timeline.length,reference.length);
  for(let i=0;i<reference.length;i++){
    assert.equal(modern.timeline[i].date,reference[i].date);
    assert.equal(modern.timeline[i].actual,reference[i].actual);
    assert.equal(modern.timeline[i].forecast,reference[i].forecast);
  }
  assert.match(src("financeInsights.js"),/const changes=new Map\(\)/);
  assert.match(src("financeInsights.js"),/while\(cursor<dated\.length&&dated\[cursor\]\[0\]<=date\)/);
  assert.doesNotMatch(src("financeInsights.js"),/usedRecords\.filter\(r=>r\.date<=date\)\.reduce/);
});

test("FINAL P2-11: past month and zero-spending future remain correct",()=>{
  const rows=[{date:"2026-02-01",type:"income",amount:100},{date:"2026-02-05",type:"expense",amount:12.31}];
  const historical=calculateCashForecast(rows,{asOfDate:"2026-11-23",selectedMonth:"2026-02",horizon:"monthEnd",openingBalanceTotal:20});
  assert.equal(historical.historical,true);
  assert.equal(historical.predictedBalance,107.69);
  assert.equal(historical.expectedIncome,0);
  assert.equal(historical.timeline.length,28);
  const zero=calculateCashForecast([],{asOfDate:"2026-11-23",selectedMonth:"2026-11",horizon:"30days",openingBalanceTotal:10});
  assert.equal(zero.predictedBalance,10);
  assert.equal(zero.timeline.at(-1).forecast,10);
});

test("FINAL P2-09/13: date-responsive review and scenario caches track Malaysia midnight",()=>{
  const inbox=src("FinanceReviewInbox.jsx"),hub=src("FinanceStage2Hub.jsx");
  const scenario=src("FinanceScenarioSimulator.jsx"),dock=src("FinanceInsightsDock.jsx"),app=src("App.jsx");
  assert.match(inbox,/findReviewCandidates\(records,reviewState,asOfDate\)/);
  assert.match(inbox,/\[records,reviewState,asOfDate\]/);
  assert.match(hub,/const today=asOfDate/);
  assert.match(scenario,/currentBalance:totalBalance,asOfDate,months/);
  assert.match(scenario,/\[saved,records,totalBalance,asOfDate\]/);
  assert.match(dock,/asOfDate=\{asOfDate\} disabled=\{disabled\} dockButton/);
  assert.match(app,/userId=\{user\?\.id\} asOfDate=\{localToday\}/);
});

test("FINAL P2-12: Android/other coarse-pointer devices keep accessible bubbles without RAF physics",()=>{
  const bubble=src("FinanceCategoryBubbleChart.jsx");
  assert.match(bubble,/window\.matchMedia\?\.\("\(pointer: coarse\)"\)\?\.matches/);
  assert.match(bubble,/if \(now - last < 33\)/);
  assert.match(bubble,/role="button" tabIndex=\{0\}/);
  assert.match(bubble,/aria-label=\{name \+ " " \+ percent/);
});

test("FINAL P2-10: inline editing keeps original version and draft unless server confirms save",()=>{
  const app=src("App.jsx");
  assert.match(app,/const saved=await onSave\(draft,opened\.version\)/);
  assert.match(app,/if\(!saved\)throw Error/);
  assert.match(app,/setEditing\(false\);\s*\}catch\(error\)/);
  assert.match(app,/setEditSaveError\(msg\)/);
  assert.match(app,/setEditSaveError\(""\); openedRef\.current=\{value/);
});

test("FINAL P3-15: stacked dialogs restore scroll/focus only at final close",()=>{
  const overlay=src("FinanceOverlay.jsx");
  assert.match(overlay,/if\(bodyScrollLock\.count\+\+>0\)return/);
  assert.match(overlay,/if\(--bodyScrollLock\.count>0\)return/);
  assert.match(overlay,/const wasTop=index===openDialogStack\.length-1/);
  assert.match(overlay,/if\(wasTop\)/);
  assert.match(overlay,/openDialogStack\[openDialogStack\.length - 1\] !== currentDialog/);
});

test("FINAL P3-14: export labels all-account claim outstanding explicitly, not monthly",()=>{
  const {workbook}=buildFinanceWorkbook({
    records:[],transfers:[],openingBalances:{BANK:"10.00"},
    claims:[],claimRepayments:[],scope:"month",month:"2026-11",
  });
  const worksheet=workbook.Sheets["Export Summary"];
  assert.ok(worksheet);
  const cells=Object.values(worksheet).map(x=>typeof x?.v==="string"?x.v:"");
  assert.ok(cells.some(text=>text.includes("NOT month-scoped")));
});

test("FINAL P3-16: financial history size limits remain explicit and FAIL CLOSED, never truncate rows",()=>{
  assert.throws(()=>validateAccountChecks(Array.from({length:801},(_,i)=>({id:String(i)}))),/limit/);
  assert.throws(()=>validateReviewState({threshold:500,decisions:Array.from({length:5001},()=>({}))}),/safety limit/);
  assert.throws(()=>validateBills(Array.from({length:41},()=>({}))),/At most 40/);
  assert.match(src("financeCloudService.js"),/Monthly budget history reached the read cap/);
  assert.match(src("financeData.js"),/Finance records exceed the safe download limit/);
});
