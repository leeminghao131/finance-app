import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {financeRevisionSignature,verifyFinanceSnapshotRevisions} from "../src/financeSnapshotConsistency.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const names=["records","transfers","finance_activities","finance_activity_links",
  "finance_claims","finance_claim_repayments"];

function mockCloud(tables,settings=null,months=[]){
  return {from(table){
    if(table==="user_settings")return {
      select(){return {eq(){return {async maybeSingle(){return {data:settings,error:null};}}}};}
    };
    if(table==="monthly_budgets")return {
      select(){return {eq(){return {order(){return {async limit(){
        return {data:months,error:null};
      }};}};}};}
    };
    assert.ok(tables[table],"unknown fake table "+table);
    return {select(_columns,options){
      if(options?.head)return {eq(){return Promise.resolve({count:tables[table].length,error:null});}};
      return {eq(){return {order(){return {async range(start,end){
        return {data:tables[table].slice(start,end+1).map(row=>({...row})),error:null};
      }};}};}};
    }};
  }};
}

test("P1 cloud revision signature detects edited, inserted, dropped and duplicate IDs",()=>{
  const a=[{id:"a",version:1},{id:"b",version:4}];
  assert.equal(financeRevisionSignature(a),financeRevisionSignature([...a].reverse()));
  assert.notEqual(financeRevisionSignature(a),financeRevisionSignature([{id:"a",version:2},a[1]]));
  assert.notEqual(financeRevisionSignature(a),financeRevisionSignature([a[0]]));
  assert.notEqual(financeRevisionSignature(a),financeRevisionSignature([...a,{id:"c",version:1}]));
  assert.throws(()=>financeRevisionSignature([a[0],a[0]]),/duplicate/);
  assert.throws(()=>financeRevisionSignature([{id:"x",version:0}]),/version/);
});

test("P1 all six cross-table revision checks plus settings/budgets fail closed on drift",async()=>{
  const tables=Object.fromEntries(names.map((name,i)=>[name,[{id:"id"+i,version:1}]]));
  const initial=structuredClone(tables);
  const settings={version:2,category_budgets:{},custom_options:{}};
  const months=[{month:"2026-11",version:1,category_budgets:{}}];
  const verify=async (s=settings,m=months)=>verifyFinanceSnapshotRevisions(
    mockCloud(tables,s,m),"user-1",initial,settings,months);
  assert.equal(await verify(),true);
  tables.finance_claim_repayments[0].version=2;
  assert.equal(await verify(),false);
  tables.finance_claim_repayments[0].version=1;
  assert.equal(await verify({...settings,version:3}),false);
  assert.equal(await verify(settings,[{...months[0],version:2}]),false);
  delete tables.finance_claim_repayments;
  await assert.rejects(verify(),/unknown fake table/);
});

test("P1 cloud snapshot only applies a complete cross-table revision-verified result",()=>{
  const cloud=src("financeCloudService.js");
  const check=src("financeSnapshotConsistency.js");
  assert.match(cloud,/verifyFinanceSnapshotRevisions\(client,userId/);
  assert.match(cloud,/error\.financeSnapshotDrift=true/);
  assert.match(cloud,/for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(cloud,/Totals are withheld/);
  assert.match(cloud,/return \{records,deletedRecords,transfers,deletedTransfers,/);
  assert.doesNotMatch(check,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|service_role/);
  assert.match(check,/loadEveryOwnedRow\(client,table,"id,version",userId\)/);
  assert.match(cloud,/validateFinanceSnapshotRows\(recordRows,transferRows,settingsRow\)/);
});
