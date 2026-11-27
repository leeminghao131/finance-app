import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {financeCalendarDayGrid,financeCalendarEventsForRange,financeCalendarDaySummary} from "../src/financeCalendarEvents.js";

const src=file=>readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const data=()=>({
  records:[{id:"e1",date:"2026-11-23",type:"expense",category:"饮食",method:"CASH",amount:18,note:"Lunch"},
    {id:"i1",date:"2026-11-23",type:"income",category:"Salary",method:"BANK",amount:100}],
  transfers:[{id:"t1",date:"2026-11-23",amount:30,fromMethod:"BANK",toMethod:"TNG"}],
  claims:[{id:"c1",amount:90,paid_on:"2026-11-23",method:"BANK",title:"Company",claimant:"Company"}],
  repayments:[{id:"r1",claim_id:"c1",received_on:"2026-11-24",amount:40,method:"TNG"}],
  bills:[],plannedIncomes:[{id:"p1",date:"2026-11-30",amount:2500,note:"Expected salary"}],
  first:"2026-11-23",last:"2026-11-30",asOfDate:"2026-11-25"
});

test("seven-column grid preserves dates and pads weekday without adjusting saved amounts",()=>{
  const days=[{date:"2026-11-01",amount:18},{date:"2026-11-02",amount:0}];
  assert.deepEqual(financeCalendarDayGrid(days),days);
  assert.deepEqual(financeCalendarDayGrid([{date:"2026-11-23",amount:18}]).slice(0,2),[null,{date:"2026-11-23",amount:18}]);
});

test("calendar totals separate personal income/expense, claim cash, and zero-net transfer",()=>{
  const f=data(),original=JSON.stringify(f);
  const events=financeCalendarEventsForRange(f);
  const daily=financeCalendarDaySummary(events,"2026-11-23");
  assert.equal(daily.incomeSen,10000);
  assert.equal(daily.expenseSen,1800);
  assert.equal(daily.cashSen,-800);
  assert.equal(daily.events.filter(e=>e.kind==="transfer")[0].cashSen,0);
  const reimbursement=financeCalendarDaySummary(events,"2026-11-24");
  assert.equal(reimbursement.cashSen,4000);
  assert.equal(reimbursement.incomeSen,0);
  assert.equal(events.find(e=>e.kind==="expected").cashSen,0);
  assert.equal(JSON.stringify(f),original);
});

test("future-dated saved Income and Expense cannot enter actual cash or personal totals",()=>{
  const f=data();
  f.records.push({id:"future",date:"2026-11-30",type:"income",amount:600,category:"Salary"});
  const future=financeCalendarDaySummary(financeCalendarEventsForRange(f),"2026-11-30");
  assert.equal(future.cashSen,0);
  assert.equal(future.incomeSen,0);
  assert.equal(future.events.length,2);
  assert.ok(future.events.every(e=>e.planned));
});

test("bill due appears as planned, paid linked bill is never duplicated",()=>{
  const f=data();
  f.first="2026-11-01";f.last="2026-11-30";
  f.bills=[{id:"11111111-1111-4111-8111-111111111111",title:"Rent",amount:"200",category:"住房",method:"BANK",cycle:"monthly",anchorDate:"2026-11-23",leadDays:0,active:true,occurrences:[]}];
  let events=financeCalendarEventsForRange(f);
  const bill=events.find(e=>e.kind==="bill");
  assert.ok(bill);
  assert.equal(bill.cashSen,0);
  assert.equal(bill.status,"overdue");
  f.bills[0].occurrences=[{due:"2026-11-23",status:"paid",recordId:"e1"}];
  events=financeCalendarEventsForRange(f);
  assert.equal(events.filter(e=>e.kind==="bill").length,0);
});

test("void, cancelled, deleted and out-of-range events never show up",()=>{
  const f=data();
  f.claims[0].cancelled_at="2026-11-25T01:00:00Z";
  f.repayments[0].voided_at="2026-11-25T01:00:00Z";
  f.records[0].deleted_at="2026-11-25T01:00:00Z";
  const events=financeCalendarEventsForRange(f);
  assert.equal(events.some(e=>e.kind.startsWith("claim")),false);
  assert.equal(events.some(e=>e.id==="record:e1"),false);
});

test("invalid or incomplete snapshots fail closed, no zero-filled misleading totals",()=>{
  const f=data();f.transfers=null;
  assert.throws(()=>financeCalendarEventsForRange(f),/Incomplete/);
  const n=data();n.records[0].amount=0.004;
  assert.throws(()=>financeCalendarEventsForRange(n),/amount/i);
  assert.throws(()=>financeCalendarEventsForRange({...data(),first:"2026-11-31"}),/Invalid/);
});

test("calendar is one integrated heatmap, not a separate mode, with read-only drilldown",()=>{
  const app=src("App.jsx"),detail=src("FinanceHeatmapDayDetails.jsx"),css=src("financeHeatmapCalendar.css");
  assert.match(app,/financeCalendarEventsForRange/);
  assert.match(app,/financeCalendarDayGrid\(visibleDays\)/);
  assert.match(app,/mh-finance-calendar__markers/);
  assert.match(app,/events=\{calendarEvents\}/);
  assert.match(app,/recurringBills=\{recurringBills\}/);
  assert.match(detail,/financeCalendarDaySummary/);
  assert.match(detail,/Claim \/ Transfer/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/animation:.*infinite/);
});
