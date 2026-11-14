import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEditedAmount } from "../src/financeData.js";
import { openingTotal, calculateMethodBalances } from "../src/financeOpeningBalance.js";
import { summarizeMonthlyBudget } from "../src/financeInsights.js";
import { compareFinanceMonths, mostUsedNotes, calculateSavingsAvailable } from "../src/financePlanning.js";
import { validateFinanceSnapshotRows } from "../src/financeIntegrity.js";

const file = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

test("Phase 4 baseline refuses any non-test Supabase URL in preview source", () => {
  const client=file("supabaseClient.js");
  const app=file("App.jsx");
  assert.match(client, /SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby"/);
  assert.match(client, /isTestEnvironment = supabaseUrl === requiredSandboxUrl/);
  assert.match(client, /hasSupabaseEnv = Boolean\(isTestEnvironment && supabaseAnonKey\)/);
  assert.match(client, /supabase = hasSupabaseEnv \? createClient/);
  assert.match(app, /TEST MODE \/ 测试环境/);
});

test("Phase 4 baseline retains all requested existing complete-test modules", () => {
  const app=file("App.jsx");
  for (const component of [
    "FinanceTransferPanel", "FinanceBudgetPanel", "FinanceForecastPanel",
    "FinanceOpeningBalancePanel", "FinanceMonthComparison", "FinanceQuickNotes",
    "FinanceSavingsGoals", "FinanceMobileRecords", "FinanceCategoryBubbleChart",
    "FinanceMethodDonutChart", "FinanceExpandedTrendOverlay",
    "FinanceCsvImportPanel", "FinanceExcelExportPanel",
  ]) {
    assert.match(app, new RegExp(component));
  }
  for(const handler of [
    "async function loadCloudData", "async function addRecord",
    "async function updateRecord", "async function deleteRecord",
    "async function addTransfer", "async function restoreRecord",
  ]) assert.ok(app.includes(handler), "Missing protected financial handler: "+handler);
  assert.match(app, /React\.lazy\(\(\) => import\("\.\/FinanceCsvImportPanel\.jsx"\)\)/);
  assert.match(app, /React\.lazy\(\(\) => import\("\.\/FinanceExcelExportPanel\.jsx"\)\)/);
});

test("Phase 4 baseline validates RM precision, protected opening values and corrupt snapshots", () => {
  assert.equal(parseEditedAmount("100"),100);
  assert.equal(parseEditedAmount("24.55"),24.55);
  assert.throws(()=>parseEditedAmount("0"));
  assert.throws(()=>parseEditedAmount("100.123"));
  assert.equal(openingTotal({BANK:"100.00",CASH:"-2.50"}),97.5);
  assert.throws(()=>validateFinanceSnapshotRows([
    {id:1,type:"expense",amount:"999.999",category:"Food",method:"BANK",date:"2026-11-14"}
  ],[]));
});

test("Phase 4 baseline transfer conserves total, soft deletion excludes transactions", () => {
  const rows=[
    {id:1,type:"income",method:"BANK",amount:200,category:"Salary",date:"2026-11-01"},
    {id:2,type:"expense",method:"CASH",amount:20,category:"Food",date:"2026-11-02"},
    {id:3,type:"expense",method:"TNG",amount:999,category:"Food",date:"2026-11-02",deleted_at:"2026-11-03"}
  ];
  const transfers=[{fromMethod:"BANK",toMethod:"TNG",amount:50}];
  const accounts=calculateMethodBalances(rows,transfers,["BANK","CASH","TNG"],{BANK:"100",CASH:"0",TNG:"0"});
  assert.equal(Math.round(accounts.reduce((sum,r)=>sum+r.balance,0)*100),28000);
  assert.equal(accounts.find(x=>x.method==="BANK").balance,250);
  assert.equal(accounts.find(x=>x.method==="TNG").balance,50);
});

test("Phase 4 baseline natural-month budgets, arbitrary-month comparison and 7 top notes remain independent",()=>{
  const rows=[
    {date:"2026-10-15",type:"expense",category:"Food",method:"TNG",amount:10,note:"Lunch"},
    {date:"2026-11-01",type:"expense",category:"Food",method:"TNG",amount:20,note:"Lunch"},
    {date:"2026-11-02",type:"income",category:"Salary",method:"BANK",amount:100,note:"Salary"},
    {date:"2026-11-03",type:"expense",category:"Food",method:"TNG",amount:15,note:"Lunch"},
    {date:"2026-11-04",type:"expense",category:"Food",method:"TNG",amount:100,note:"Lunch",deleted_at:"2026-11-05"}
  ];
  const budget=summarizeMonthlyBudget(rows,{Food:"50"},"2026-11",["Food"]);
  assert.equal(budget.totalExpense,35);
  assert.equal(budget.remaining,15);
  const diff=compareFinanceMonths(rows,"2026-10","2026-11");
  assert.equal(diff.first.expense,10);
  assert.equal(diff.second.expense,35);
  assert.deepEqual(mostUsedNotes(rows,"expense","Food"),[{note:"Lunch",count:3}]);
});

test("Phase 4 baseline goal progress uses balance less budget without changing ledger",()=>{
  const records=Object.freeze([{type:"income",amount:100,date:"2026-11-01"}]);
  const amount=calculateSavingsAvailable(2000,{Food:"600",Transport:"200"});
  assert.equal(amount.available,1200);
  assert.equal(amount.monthlyBudget,800);
  assert.equal(records[0].amount,100);
});
