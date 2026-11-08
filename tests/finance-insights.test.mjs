import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMonthlyBudget, normalizeBudgetsInput, calculateCashForecast } from "../src/financeInsights.js";

test("month-specific budget excludes current filter and separates categories without a budget",()=>{
  const records = [
    {type:"expense",date:"2026-10-31",category:"Food",amount:500},
    {type:"expense",date:"2026-11-04",category:"Food",amount:220},
    {type:"expense",date:"2026-11-05",category:"Food",amount:30},
    {type:"expense",date:"2026-11-05",category:"Transport",amount:50},
    {type:"expense",date:"2026-11-05",category:"Medical",amount:90},
    {type:"expense",date:"2026-11-06",category:"Food",amount:999,deleted_at:"2026-11-06T10:00:00Z"},
  ];
  const result=summarizeMonthlyBudget(records,{Food:"300",Transport:"100"}, "2026-11", ["Food","Transport","Medical"]);
  assert.equal(result.totalBudget,400);
  assert.equal(result.trackedExpense,300);
  assert.equal(result.unbudgetedExpense,90);
  assert.equal(result.totalExpense,390);
  assert.equal(result.remaining,100);
  assert.equal(result.usage,75);
  const medical=result.rows.find(r=>r.category==="Medical");
  assert.equal(medical.hasBudget,false);
  assert.equal(medical.usage,null);
  assert.equal(medical.spent,90);
});
test("budget fields validate cents and preserve unset values",()=>{
  assert.deepEqual(normalizeBudgetsInput({Food:"600.50",Transport:""}),{Food:"600.50",Transport:""});
  assert.throws(()=>normalizeBudgetsInput({Food:"1.234"}));
  assert.throws(()=>normalizeBudgetsInput({Food:"-2"}));
});

test("forecast includes previous months, planned income, expense trailing average, excludes transfers",()=>{
  const records=[
    {type:"income",date:"2026-10-30",amount:3000},
    {type:"expense",date:"2026-10-31",amount:500},
    {type:"expense",date:"2026-11-02",amount:120},
    {type:"expense",date:"2026-11-05",amount:180},
    {type:"income",date:"2026-11-06",amount:200},
    {type:"expense",date:"2026-11-06",amount:900,deleted_at:"2026-11-06T12:00:00Z"},
    {type:"expense",date:"2026-12-10",amount:1000},
  ];
  const data=calculateCashForecast(records,{
    asOfDate:"2026-11-10",selectedMonth:"2026-11",horizon:"monthEnd",trailingDays:30,
    plannedIncomes:[{id:"plan",date:"2026-11-25",amount:2500,note:"Salary"}],
  });
  assert.equal(data.currentBalance,2400); // 3000 - 500 -120 -180 +200
  assert.equal(data.expectedIncome,2500);
  assert.equal(data.daysLeft,20);
  assert.equal(data.averageDailyExpense,26.67);
  assert.equal(data.predictedBalance,4366.67); // 2400 + 2500 - 20*800/30
  assert.equal(data.timeline.at(-1).date,"2026-11-30");
  assert.equal(data.timeline.at(-1).forecast,4366.67);
  assert.equal(data.timeline.find(x=>x.date==="2026-11-10").actual,2400);
  assert.equal(data.timeline.at(-1).actual,null);
});

test("historical month uses actual cumulative ledger and never future plans",()=>{
 const records=[
  {type:"income",date:"2026-09-30",amount:500},
  {type:"income",date:"2026-10-02",amount:900},
  {type:"expense",date:"2026-10-31",amount:150},
  {type:"income",date:"2026-11-01",amount:400},
 ];
 const data=calculateCashForecast(records,{
  asOfDate:"2026-11-08",selectedMonth:"2026-10",horizon:"monthEnd",trailingDays:7,
  plannedIncomes:[{date:"2026-11-10",amount:1000}],
 });
 assert.equal(data.historical,true);
 assert.equal(data.currentBalance,1250);
 assert.equal(data.predictedBalance,1250);
 assert.equal(data.expectedIncome,0);
 assert.equal(data.daysLeft,0);
 assert.equal(data.timeline.at(-1).actual,1250);
});

test("future-dated actual records do not inflate current cash balance",()=>{
 const a=calculateCashForecast([{type:"income",date:"2026-12-10",amount:800}],{
  asOfDate:"2026-11-08",selectedMonth:"2026-11",trailingDays:30,
 });
 assert.equal(a.currentBalance,0);
 assert.equal(a.expectedIncome,0);
});
