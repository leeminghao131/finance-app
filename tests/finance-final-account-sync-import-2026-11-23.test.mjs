import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadSnapshotAfterWriteStability} from "../src/financeSnapshotReadGuard.js";
import {importReviewedCsvRows} from "../src/financeImportService.js";
import {checkBillPaymentEligibility} from "../src/financeBillPayment.js";
import {billOccurrences} from "../src/financeStage2.js";
import {makeDashboardCategoryChoices,selectedDashboardCategory,categoryOnlyRows} from "../src/financeDashboardCategoryFilter.js";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("FINAL P0-03: new user renders no previously verified owner data before first effect",()=>{
  const app=read("App.jsx");
  assert.match(app,/verifiedDataOwnerId!==user\?\.id/);
  assert.match(app,/setVerifiedDataOwnerId\(null\)/);
  assert.match(app,/setVerifiedDataOwnerId\(accountId\)/);
  assert.match(app,/liveUserIdRef\.current = nextSession\?\.user\?\.id \|\| null/);
  assert.match(app,/recordsLoadCounterRef\.current \+= 1/);
});

test("FINAL P1-04: an acknowledged write invalidates a prior cloud snapshot and retries whole read",async()=>{
  let epoch=0,reads=0;
  const result=await loadSnapshotAfterWriteStability(async()=>{
    reads++;
    if(reads===1){epoch++;return {balance:10,claims:[]};}
    return {balance:20,claims:[{id:"fresh"}]};
  },()=>epoch,()=>true);
  assert.equal(reads,2);
  assert.deepEqual(result,{balance:20,claims:[{id:"fresh"}]});
});

test("FINAL P1-04: persistent mutation overlap fails closed, owner switch cancels outstanding read",async()=>{
  let epoch=0,reads=0;
  await assert.rejects(loadSnapshotAfterWriteStability(async()=>{reads++;epoch++;return {old:true};},
    ()=>epoch,()=>true,3),/Old snapshot rejected/);
  assert.equal(reads,3);
  let owner=true;
  const dropped=await loadSnapshotAfterWriteStability(async()=>{owner=false;return {secret:"old-account"};},
    ()=>0,()=>owner);
  assert.equal(dropped,null);
  assert.equal(await loadSnapshotAfterWriteStability(async()=>{throw Error("should not read");},()=>0,()=>false),null);
});

test("FINAL P0-02: abort 101-row CSV import when login switches after first batch",async()=>{
  let owner="A",writes=0,getUserCalls=0;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:"token-"+owner}},error:null}),getUser:async(token)=>{getUserCalls++;return {data:{user:{id:token.slice(6)}},error:null};}},
    rpc:(_name,params)=>({setHeader:async(name,value)=>{
      writes++;
      assert.equal(name,"Authorization");assert.equal(value,"Bearer token-A");
      assert.equal(params.p_rows.length,100);
      owner="B";
      return {data:params.p_rows.map(r=>({source_row:r.source_row,import_status:"inserted"})),error:null};
    }}),
  };
  const rows=Array.from({length:101},(_,i)=>({source_row:i+2,amount:"1.00"}));
  await assert.rejects(importReviewedCsvRows(client,"hash",rows,()=>{},{ownerId:"A",isOwnerCurrent:()=>owner==="A"}),/account changed/);
  assert.equal(writes,1,"must NEVER send second batch under new account");
  assert.ok(getUserCalls>=1);
});

test("FINAL P0-02: even without visible account switch, server auth mismatch prevents first import",async()=>{
  let writes=0;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:"A"},access_token:"token-A"}},error:null}),getUser:async()=>({data:{user:{id:"B"}},error:null})},
    rpc:async()=>{writes++;return {data:[],error:null};},
  };
  await assert.rejects(importReviewedCsvRows(client,"hash",[{source_row:2}],undefined,
    {ownerId:"A",isOwnerCurrent:()=>true}),/authenticated account changed/);
  assert.equal(writes,0);
  const app=read("App.jsx");
  assert.match(app,/ownerIsCurrent=\{\(\)=>liveUserIdRef\.current===user\?\.id\}/);
  const panel=read("FinanceCsvImportPanel.jsx");
  assert.match(panel,/ownerId:user\.id,isOwnerCurrent:ownerIsCurrent/);
});

test("FINAL P2-01: the same oldest overdue bill offered in UI can be confirmed",()=>{
  const now="2026-11-23";
  const plans=[{id:"bill-rent-123",title:"Rent",amount:250,category:"住房",
    method:"BANK",cycle:"monthly",anchorDate:"2026-01-01",leadDays:0,active:true,occurrences:[]}];
  const displayed=billOccurrences(plans,now,[],70,40,true);
  const oldest=displayed.find(row=>row.due==="2026-01-01");
  assert.ok(oldest&&oldest.visible);
  const eligible=checkBillPaymentEligibility(plans,oldest.billId,oldest.due,[],now);
  assert.equal(eligible.id,oldest.billId);
});

test("FINAL P2-08: deleted custom categories remain filterable through real history",()=>{
  const records=[{id:1,type:"expense",category:"History Custom",amount:32},
    {id:2,type:"expense",category:"饮食",amount:11}];
  const choices=makeDashboardCategoryChoices(["饮食","History Custom"],["Salary"]);
  const choice=selectedDashboardCategory(choices,"expense:"+encodeURIComponent("History Custom"));
  assert.equal(categoryOnlyRows(records,choice).length,1);
  assert.match(read("App.jsx"),/uniqueOptions\(expenseCategoryOptions,records\.filter\(r=>r\.type==="expense"\)/);
});

test("FINAL P1-05: period net movement cannot use account low-balance warning",()=>{
  const app=read("App.jsx");
  assert.match(app,/const low=alertEnabled&&value<safeLimit/);
  assert.match(app,/<BalanceCard title="Filtered Balance"[^>]*limit=\{null\}/);
  assert.match(app,/title="Balance"\s+value=\{totalBalance\}/);
});

test("FINAL P1-07: warn on matching claim advance, never auto-collapse legitimate identical payments",()=>{
  const claim=read("FinanceClaimTracker.jsx");
  assert.match(claim,/const matchingClaims=proposedSen===null\?\[\]:claims\.filter/);
  assert.match(claim,/const duplicate=matchingClaims\.some\(c=>!c\.cancelled_at\)/);
  assert.match(claim,/localizedFinanceConfirm/);
  assert.doesNotMatch(claim,/claims\.filter\(c=>.*duplicate/);
});
