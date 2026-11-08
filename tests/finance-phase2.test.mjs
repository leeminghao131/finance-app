import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  malaysiaDate,malaysiaMonth,malaysiaYear,validCalendarDate,
  shiftCalendarDate,recentCalendarStart,daysInCalendarMonth,
  summarizeMonthlyBudget,forecastCashFlow,
} from "../src/financePhase2.js";

test("Malaysia midnight & year boundary resolve from actual timestamp, not UTC",()=>{
  assert.equal(malaysiaDate(new Date("2026-11-30T15:59:59Z")),"2026-11-30");
  assert.equal(malaysiaDate(new Date("2026-11-30T16:30:00Z")),"2026-12-01");
  assert.equal(malaysiaMonth(new Date("2026-12-31T16:45:00Z")),"2027-01");
  assert.equal(malaysiaYear(new Date("2026-12-31T16:45:00Z")),"2027");
});

test("safe Malaysia calendar operations work over month and leap-year boundaries",()=>{
  assert.equal(shiftCalendarDate("2026-12-31",1),"2027-01-01");
  assert.equal(shiftCalendarDate("2027-01-01",-1),"2026-12-31");
  assert.equal(shiftCalendarDate("2024-02-28",1),"2024-02-29");
  assert.equal(shiftCalendarDate("2024-02-29",1),"2024-03-01");
  assert.equal(recentCalendarStart(7,"2027-01-03"),"2026-12-28");
  assert.equal(daysInCalendarMonth("2024-02"),29);
  assert.equal(daysInCalendarMonth("2026-02"),28);
  for(const s of ["2026-02-29","2026-04-31","invalid","2026-13-01"]) assert.equal(validCalendarDate(s),false);
  assert.equal(validCalendarDate("2024-02-29"),true);
});

test("budget counts only current calendar month and explicitly budgeted categories",()=>{
  const rows=[
    {type:"expense",category:"Food",date:"2026-10-31",amount:900},
    {type:"expense",category:"Food",date:"2026-11-01",amount:100.25},
    {type:"expense",category:"Food",date:"2026-11-07",amount:10.12},
    {type:"expense",category:"School",date:"2026-11-08",amount:50.08},
    {type:"expense",category:"Food",date:"2026-11-09",amount:700,deleted_at:"2026-11-09T15:00:00Z"},
    {type:"income",category:"Food",date:"2026-11-08",amount:500},
  ];
  const m=summarizeMonthlyBudget(rows,{Food:"200.00",School:"",Transport:"300.00"},"2026-11");
  assert.equal(m.budget,500);
  assert.equal(m.spent,110.37);
  assert.equal(m.unbudgetedSpent,50.08);
  assert.equal(m.remaining,389.63);
  const school=m.categories.find(x=>x.name==="School");
  assert.equal(school.budget,null);
  assert.equal(school.percentage,null);
  assert.equal(school.spent,50.08);
  const ten=summarizeMonthlyBudget(rows,{Food:"200"},"2026-10");
  assert.equal(ten.spent,900);
});

test("forecast starts at all-time balance, expected income is not actual ledger money",()=>{
  const records=[
    {type:"income",date:"2026-10-20",amount:1000},
    {type:"expense",date:"2026-10-25",amount:200},
    {type:"expense",date:"2026-11-08",amount:90},
    {type:"income",date:"2026-11-08",amount:200},
    {type:"expense",date:"2026-11-08",amount:900,deleted_at:"2026-11-08T01:00:00Z"},
  ];
  const plans=[{date:"2026-11-10",amount:2500,label:"Future salary"}];
  const result=forecastCashFlow({
    records,expectedIncome:plans,selectedMonth:"2026-11",referenceDate:"2026-11-08",daysWindow:30,horizon:"30",
  });
  assert.equal(result.currentBalance,910);
  assert.equal(result.expectedIncome,2500);
  assert.equal(result.daysLeft,30);
  assert.equal(result.entries[0].actual,910);
  assert.equal(result.entries[0].projected,910);
  assert.equal(result.entries[2].day,"2026-11-10");
  assert.equal(result.entries[2].actual,null);
  assert.ok(result.predictedBalance>910);
  assert.equal(records.length,5);
});

test("historic months use actual month end, never future plans",()=>{
  const records=[
    {type:"income",date:"2026-09-01",amount:1000},
    {type:"expense",date:"2026-10-31",amount:120},
    {type:"income",date:"2026-11-07",amount:10000},
  ];
  const r=forecastCashFlow({
    records,expectedIncome:[{date:"2026-11-08",amount:99999}],selectedMonth:"2026-10",
    referenceDate:"2026-11-08",daysWindow:30,horizon:"month",
  });
  assert.equal(r.historic,true);
  assert.equal(r.currentBalance,880);
  assert.equal(r.predictedBalance,880);
  assert.equal(r.expectedIncome,0);
  assert.equal(r.entries.at(-1).day,"2026-10-31");
  assert.ok(r.entries.every(x=>x.projected===null));
});

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const schema=readFileSync(new URL("../docs/database/preview_finance_phase2.sql",import.meta.url),"utf8");
test("transfer edit/delete/restore uses version, owner and soft-delete; no permanent deletes",()=>{
  for(const fn of ["updateTransfer","deleteTransfer","restoreTransfer"]){
    assert.match(app,new RegExp("async function "+fn+"\\("));
  }
  assert.match(app,/\.eq\("version",transfer\.version\)/);
  assert.match(app,/\.eq\("user_id",user\.id\)/);
  assert.match(app,/\.update\(\{deleted_at:new Date\(\)\.toISOString\(\)\}\)/);
  assert.match(app,/\.update\(\{deleted_at:null\}\)/);
  assert.doesNotMatch(app,/\.from\("transfers"\)\s*\.delete\(/);
  assert.match(schema,/DROP POLICY IF EXISTS "Users can delete own transfers"/);
  assert.match(schema,/ALTER TABLE public\.monthly_budgets ENABLE ROW LEVEL SECURITY/);
  assert.match(schema,/user_id uuid NOT NULL REFERENCES auth\.users/);
});
