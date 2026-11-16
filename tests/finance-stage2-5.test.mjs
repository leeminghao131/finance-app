import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const scope=(src,a,b)=>{
  const start=src.indexOf(a),end=src.indexOf(b,start);
  assert.ok(start>=0&&end>start,"Expected unchanged handler scope: "+a);
  return src.slice(start,end);
};

test("Stage 2.5 account inputs fit responsive 2x2 cards on desktop, one column on Android",()=>{
  const source=ui("FinanceAccountReconciliation.jsx");
  assert.match(source,/grid grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(source,/normalizedBalances\.map\(b=>/);
  assert.match(source,/actualByMethod\[b\.method\]/);
  assert.match(source,/onChange=\{e=>update\(b.method,e.target.value\)\}/);
  assert.match(source,/aria-label=\{b.method\+/);
  assert.match(source,/money\(b.balance\)/);
  assert.match(source,/diff>0\?"\+":""/);
  assert.ok(!source.includes("sm:grid-cols-4"));
});

test("Stage 2.5 reconciliation keeps operations visible and collapses secondary history",()=>{
  const source=ui("FinanceAccountReconciliation.jsx");
  const pending=scope(source,"  async function saveAllChecks(){","  async function executePlan(){");
  const transfers=scope(source,"  async function executePlan(){","  const fillResidual=(x)=>{");
  const residual=scope(source,"  const fillResidual=(x)=>{","  return <>");
  assert.match(pending,/validateAccountChecks\(\[\.\.\.checks,\.\.\.entries\]\)/);
  assert.match(pending,/await onSave\(verified,baseline\)/);
  assert.match(transfers,/window\.confirm\(warning\+lines\+tail\)/);
  assert.match(transfers,/onExecuteTransfers\(plan\)/);
  assert.match(residual,/note:"balance"/);
  assert.match(residual,/onPrefillRecord\(\{/);
  assert.match(source,/planReconciliationTransfers\(normalizedBalances,actualByMethod\)/);
  assert.match(source,/plan\.transfers\.map/);
  assert.match(source,/plan\.remainders\.map/);
  assert.match(source,/onClick=\{saveAllChecks\}/);
  assert.match(source,/onClick=\{executePlan\}/);
  assert.match(source,/onClick=\{\(\)=>fillResidual\(x\)\}/);
  assert.equal((source.match(/<details className="rounded-xl border border-slate-200 p-3">/g)||[]).length,2);
  assert.match(source,/<summary className="cursor-pointer text-sm font-bold">/);
  assert.match(source,/近期活动/);
  assert.match(source,/历史对账/);
});

test("Stage 2.5 recurring bills separate work and plans into exactly two tabs",()=>{
  const source=ui("FinanceRecurringBills.jsx");
  assert.match(source,/const \[activeTab,setActiveTab\]=useState\("pending"\)/);
  assert.match(source,/role="tablist"/);
  assert.match(source,/role="tab" aria-selected=\{activeTab==="pending"\}/);
  assert.match(source,/role="tab" aria-selected=\{activeTab==="plans"\}/);
  assert.match(source,/activeTab==="pending"&&<section role="tabpanel"/);
  assert.match(source,/activeTab==="plans"&&<section role="tabpanel"/);
  assert.match(source,/bills\.map\(b=>/);
  assert.match(source,/onClick=\{\(\)=>start\(b\)\}/);
  assert.match(source,/onClick=\{\(\)=>remove\(b\)\}/);
  assert.match(source,/onClick=\{\(\)=>start\(\)\}/);
  assert.ok(source.indexOf('activeTab==="plans"')>source.indexOf('activeTab==="pending"'));
});

test("Stage 2.5 due alert rules and actual payment handlers have not been changed",()=>{
  const source=ui("FinanceRecurringBills.jsx"),service=ui("financeStage2.js");
  assert.match(source,/const pending=events\.filter\(e=>e\.visible\)/);
  assert.match(source,/const nextTwoWeeks=shiftCalendarDay\(today,14\)/);
  assert.match(source,/e\.status!=="paid"&&e\.status!=="skipped"/);
  assert.match(source,/e\.visible\|\|\(e\.due>=today&&e\.due<=nextTwoWeeks\)/);
  assert.match(source,/const finishedItems=selected\.filter\(e=>e\.status==="paid"\|\|e\.status==="skipped"\)/);
  assert.match(source,/onClick=\{\(\)=>markPaid\(e\)\}/);
  assert.match(source,/onClick=\{\(\)=>act\(e,\{status:"skipped"\}\)\}/);
  assert.match(source,/remindOn:shiftCalendarDay\(today,1\)/);
  assert.match(source,/onConfirmPayment\(\{billId:event.billId,due:event.due\}\)/);
  assert.match(source,/validateBills\(next\)/);
  assert.match(service,/const noticeDate=status\?\.status==="snoozed"\?status\.remindOn:shiftCalendarDay\(due,-b\.leadDays\)/);
  assert.match(source,/cycle:"monthly",leadDays:0,active:true,occurrences:\[\]/);
});

test("Stage 2.5 paid/skipped occurrences and calendar are both folded by default",()=>{
  const source=ui("FinanceRecurringBills.jsx");
  const section=scope(source,'activeTab==="pending"&&<section','{activeTab==="plans"&&<section');
  assert.match(section,/<details className="rounded-xl border border-slate-200 bg-white p-2\.5">/);
  assert.match(section,/calendarEvents\.some\(e=>e\.due===date\)/);
  assert.match(source,/calendarMonthDays\(calendarMonth\)/);
  assert.match(section,/<summary className="cursor-pointer text-sm font-semibold">/);
  assert.match(section,/finishedItems\.map\(e=>/);
  assert.match(section,/e\.linkedRecordId/);
  assert.match(section,/max-h-\[48dvh\]/);
  assert.ok(!source.includes("<details open"),"Both secondary areas start collapsed");
});

test("Stage 2.5 no financial data service or record entrypoint is replaced",()=>{
  const app=ui("App.jsx"),hub=ui("FinanceStage2Hub.jsx"),dock=ui("FinanceInsightsDock.jsx");
  for(const action of ["addRecord","updateRecord","deleteRecord","loadCloudData",
    "saveStage2Field","executeStage2Reconciliation","confirmStage2BillPayment"])
    assert.ok(app.includes(action),action);
  assert.match(hub,/mode==="bill"&&<FinanceRecurringBills/);
  assert.match(hub,/mode==="accounts"&&<FinanceAccountReconciliation/);
  assert.match(hub,/onConfirmPayment=\{onConfirmBillPayment\}/);
  assert.match(dock,/onOpenStage2Tool\("bill",e\.currentTarget\)/);
  assert.match(dock,/onOpenStage2Tool\("accounts",e\.currentTarget\)/);
  assert.match(ui("FinanceAccountReconciliation.jsx"),/note:"balance"/);
});
