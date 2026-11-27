import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {
  getRecordRequestId,confirmRecordRequest,
  assertRecoveredRecordMatchesPayload,assertRecoveredTransferMatchesPayload,
} from "../src/financeSaveIdempotency.js";

function storage(){
  const data=new Map();
  return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
const base={type:"expense",amount:40,category:"饮食",method:"BANK",note:"Lunch",date:"2026-11-18"};
const fx=(fx_currency,fx_amount,fx_rate)=>({...base,fx_currency,fx_amount,fx_rate,fx_rate_date:"2026-11-18",fx_provider:"frankfurter-v2"});

test("PR47 fix: FX transactions with identical rounded RM but distinct foreign originals get unique pending IDs",async()=>{
  const cache=storage(),user="test-user";
  const first=await getRecordRequestId(user,fx("USD","10.00","4.0"),cache,webcrypto);
  const retry=await getRecordRequestId(user,fx("USD","10.00","4.0"),cache,webcrypto);
  assert.equal(first,retry);
  const sameDecimals=await getRecordRequestId(user,fx("USD","10.0","4.000"),cache,webcrypto);
  assert.equal(sameDecimals,first,"numeric formatting alone must not duplicate a pending FX entry");
  const other=await getRecordRequestId(user,fx("USD","8.00","5.0"),cache,webcrypto);
  assert.notEqual(first,other);
  const another=await getRecordRequestId(user,fx("EUR","8.00","5.0"),cache,webcrypto);
  assert.notEqual(other,another);
  const stored=Array.from(cache.data.values()).join("");
  assert.doesNotMatch(stored,/Lunch|BANK|USD|EUR|10\.00|8\.00|frankfurter-v2/);
  confirmRecordRequest(user,another,cache);
  assert.equal(cache.data.size,0);
});

test("PR47 fix: RM intent remains retry-stable, switching MYR to FX creates a fresh ID",async()=>{
  const cache=storage(),user="test-user";
  const initial=await getRecordRequestId(user,base,cache,webcrypto);
  assert.equal(initial,await getRecordRequestId(user,{...base},cache,webcrypto));
  const foreign=await getRecordRequestId(user,fx("USD","10.00","4.0"),cache,webcrypto);
  assert.notEqual(initial,foreign);
});

test("PR47 fix: legacy FX pending ID is preserved for safe server-side verification",async()=>{
  const cache=storage(),user="test-user";
  const old=await getRecordRequestId(user,base,cache,webcrypto);
  const key=Array.from(cache.data.keys())[0];
  const stored=JSON.parse(cache.data.get(key));
  delete stored.intent; // stored by the pre-fix v1 app; contains no FX intent marker
  cache.data.set(key,JSON.stringify(stored));
  const recovered=await getRecordRequestId(user,fx("USD","10.00","4.0"),cache,webcrypto);
  assert.equal(recovered,old);
});

test("PR47 fix: existing MYR and FX rows must match BEFORE successful recovery is acknowledged",()=>{
  const row={...base,amount:"40.00",deleted_at:null};
  assert.equal(assertRecoveredRecordMatchesPayload(row,base),row);
  assert.throws(()=>assertRecoveredRecordMatchesPayload({...row,amount:"41.00"},base),/differs/);
  assert.throws(()=>assertRecoveredRecordMatchesPayload({...row,note:"Edited"},base),/differs/);
  const original=fx("USD","10.00","4.00000");
  assert.equal(assertRecoveredRecordMatchesPayload({...row,fx_currency:"USD",fx_amount:"10",fx_rate:"4",fx_rate_date:"2026-11-18",fx_provider:"frankfurter-v2"},original).amount,"40.00");
  assert.throws(()=>assertRecoveredRecordMatchesPayload({...row,fx_currency:"EUR",fx_amount:"10",fx_rate:"4",fx_rate_date:"2026-11-18",fx_provider:"frankfurter-v2"},original),/differs/);
  assert.throws(()=>assertRecoveredRecordMatchesPayload({...row,fx_currency:"USD",fx_amount:"8",fx_rate:"5",fx_rate_date:"2026-11-18",fx_provider:"frankfurter-v2"},original),/FX record/);
});

test("PR47 fix: recovered Transfers with edited source/target, date, note or amount are refused",()=>{
  const tx={from_method:"BANK",to_method:"TNG",amount:85.40,date:"2026-11-18",note:"Test transfer"};
  assert.equal(assertRecoveredTransferMatchesPayload({...tx,amount:"85.40"},tx).amount,"85.40");
  for(const other of [
    {...tx,from_method:"CASH"}, {...tx,to_method:"CASH"},
    {...tx,amount:84.40}, {...tx,date:"2026-11-17"},{...tx,note:"Changed"}
  ]) assert.throws(()=>assertRecoveredTransferMatchesPayload(other,tx),/differs/);
});

test("PR47 fix: automated safety workflow covers UI branches, keeps strict full high/critical audit",()=>{
  const flow=readFileSync(new URL("../.github/workflows/finance-safety.yml",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(app,/assertRecoveredRecordMatchesPayload\(resolved\.data,payload\)/);
  assert.match(app,/assertRecoveredTransferMatchesPayload\(found\.data,payload\)/);

  assert.match(flow,/- "ui\/\*\*"/);
  assert.match(flow,/npm audit --omit=dev --audit-level=high/);
  assert.match(flow,/npm audit --json/);
  assert.match(flow,/Number\(counts\.high \|\| 0\) > 0/);
  assert.match(flow,/Number\(counts\.critical \|\| 0\) > 0/);
});
