import test from "node:test";
import assert from "node:assert/strict";
import {parseOpeningAmount,openingTotal,calculateMethodBalances} from "../src/financeOpeningBalance.js";

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
