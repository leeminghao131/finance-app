import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateFinanceSnapshotRows } from "../src/financeIntegrity.js";
import { calculateMethodBalances,openingTotal } from "../src/financeOpeningBalance.js";
import { calculateCashForecast } from "../src/financeInsights.js";

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const safeRows=[
 {id:1,type:"income",amount:"100.25",category:"Salary",method:"BANK",date:"2026-11-12"},
 {id:2,type:"expense",amount:"30.10",category:"Food",method:"CASH",date:"2026-11-12"}
];
const safeTransfers=[{id:"t-1",from_method:"BANK",to_method:"CASH",amount:"10.00",date:"2026-11-12"}];

test("integrated snapshot allows valid currency and opening balances",()=>{
 assert.equal(validateFinanceSnapshotRows(safeRows,safeTransfers,{opening_balances:{BANK:"500.00",CASH:"-2.50"}}),true);
 assert.equal(openingTotal({BANK:"500.00",CASH:"-2.50"}),497.5);
});

test("integrated snapshot never coerces corrupt database money to zero",()=>{
 for(const invalid of [null,"",0,"0","-1","1.234","NaN","Infinity","9999999999999999"]){
   const altered=[{...safeRows[0],amount:invalid}];
   assert.throws(()=>validateFinanceSnapshotRows(altered,safeTransfers));
 }
 for(const changed of [{type:"transfer"},{type:null},{date:"2026-02-30"},{method:null},{category:""}]){
   assert.throws(()=>validateFinanceSnapshotRows([{...safeRows[0],...changed}],safeTransfers));
 }
 assert.throws(()=>validateFinanceSnapshotRows(safeRows,[{...safeTransfers[0],amount:"0"}]));
 assert.throws(()=>validateFinanceSnapshotRows(safeRows,safeTransfers,{opening_balances:{BANK:"not-money"}}));
});

test("integrated method balances include opening amounts, transfers remain net zero",()=>{
 const records=[{type:"income",method:"BANK",amount:100.25},{type:"expense",method:"CASH",amount:30.10}];
 const transfers=[{fromMethod:"BANK",toMethod:"CASH",amount:10}];
 const methods=calculateMethodBalances(records,transfers,["BANK","CASH"],{BANK:"500.00",CASH:"-2.50"});
 const sum=methods.reduce((n,x)=>n+Math.round(x.balance*100),0);
 assert.equal(sum,Math.round((497.5+100.25-30.10)*100));
 assert.equal(methods.find(x=>x.method==="BANK").balance,590.25);
 assert.equal(methods.find(x=>x.method==="CASH").balance,-22.6);
});

test("integrated forecast includes opening balance but not transfer as income",()=>{
 const forecast=calculateCashForecast([{type:"income",amount:100,date:"2026-11-01"}],{
   asOfDate:"2026-11-12",selectedMonth:"2026-11",horizon:"monthEnd",
   trailingDays:30,plannedIncomes:[],openingBalanceTotal:500
 });
 assert.equal(forecast.currentBalance,600);
 assert.equal(forecast.expectedIncome,0);
});

test("integrated UI fails closed on background sync error and scopes personal card storage",()=>{
 const x=app.indexOf("async function loadCloudData(");
 const y=app.indexOf("  // Settings writes",x);
 assert.ok(x>=0&&y>x);
 const source=app.slice(x,y);
 assert.match(source,/catch\(error\)[\s\S]*setInitialDataReady\(false\)/);
 assert.match(app,/CUSTOM_CARD_TEXT_KEY \+ ":" \+ user\.id/);
 assert.match(app,/CUSTOM_CARD_IMAGE_KEY \+ ":" \+ user\.id/);
 assert.doesNotMatch(app,/localStorage\.setItem\(CUSTOM_CARD_TEXT_KEY,/);
 assert.doesNotMatch(app,/localStorage\.getItem\(CUSTOM_CARD_TEXT_KEY\)/);
});
