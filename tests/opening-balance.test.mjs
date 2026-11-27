import test from "node:test";
import assert from "node:assert/strict";
import {parseOpeningAmount,openingTotal,calculateMethodBalances} from "../src/financeOpeningBalance.js";
import {calculateCashForecast} from "../src/financeInsights.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";

test("Opening balances parse RM amounts, including zero and debt",()=>{
  assert.equal(parseOpeningAmount("100"),100);
  assert.equal(parseOpeningAmount("24.55"),24.55);
  assert.equal(parseOpeningAmount("-12.30"),-12.3);
  for (const bad of ["1.234","abc","1e5","Infinity",""]) assert.throws(()=>parseOpeningAmount(bad));
});
test("Transfer changes methods but not total; opening is not Income",()=>{
  const records=[{method:"BANK",type:"income",amount:200},{method:"CASH",type:"expense",amount:30}];
  const transfers=[{fromMethod:"BANK",toMethod:"TNG",amount:75}];
  const rows=calculateMethodBalances(records,transfers,["BANK","CASH","TNG"],{BANK:100,CASH:50,TNG:0});
  assert.deepEqual(rows.map(r=>r.balance),[225,20,75]);
  assert.equal(rows.reduce((s,r)=>s+Math.round(r.balance*100),0)/100,openingTotal({BANK:100,CASH:50,TNG:0})+200-30);
  assert.equal(rows.reduce((s,r)=>s+r.income,0),200);
});
test("Historic and custom methods persist, soft deleted data excluded",()=>{
  const rows=calculateMethodBalances([{method:"Custom Wallet",type:"expense",amount:1.2},{method:"BANK",type:"income",amount:999,deleted_at:"2026-11-12"}],[],["BANK"],{"Custom Wallet":12.5});
  assert.equal(rows.find(r=>r.method==="Custom Wallet").balance,11.3);
  assert.equal(rows.find(r=>r.method==="BANK").balance,0);
});

test("Forecast adds opening once to current, historic and projected ledger, not expected income",()=>{
  const records=[{type:"income",amount:100,date:"2026-11-02"},{type:"expense",amount:25,date:"2026-11-03"}];
  const opts={asOfDate:"2026-11-12",selectedMonth:"2026-11",trailingDays:30,horizon:"30days",plannedIncomes:[],openingBalanceTotal:400};
  const baseline=calculateCashForecast(records,{...opts,openingBalanceTotal:0});
  const actual=calculateCashForecast(records,opts);
  assert.equal(actual.currentBalance-baseline.currentBalance,400);
  assert.equal(actual.predictedBalance-baseline.predictedBalance,400);
  assert.equal(actual.expectedIncome,0);
  assert.equal(actual.timeline[0].actual-baseline.timeline[0].actual,400);
  const historic=calculateCashForecast(records,{...opts,selectedMonth:"2026-10",horizon:"monthEnd"});
  assert.equal(historic.currentBalance,400);
});
test("Opening Balance export is separate from Income, and monthly net change excludes it",()=>{
  const fixture={records:[{id:1,type:"income",date:"2026-11-05",amount:50,method:"BANK"}],openingBalances:{BANK:100,CASH:25}};
  const {workbook,stats}=buildFinanceWorkbook(fixture);
  assert.equal(stats.income,50);assert.equal(stats.openingTotalCents,12500);
  assert.ok(workbook.SheetNames.includes("Opening Balances"));
  verifyFinanceWorkbook(workbook,stats);
  const monthly=buildFinanceWorkbook({...fixture,scope:"month",month:"2026-11"});
  assert.equal(monthly.stats.income,50);
  assert.equal(monthly.stats.openingTotalCents,12500);
  verifyFinanceWorkbook(monthly.workbook,monthly.stats);
});
