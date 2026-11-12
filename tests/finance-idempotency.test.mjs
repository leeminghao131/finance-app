import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { getRecordRequestId,confirmRecordRequest,getTransferRequestId,confirmTransferRequest } from "../src/financeSaveIdempotency.js";
import { parseEditedAmount } from "../src/financeData.js";

function cache(){
 const data=new Map();
 return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
const payload={user_id:"fake-test-user",type:"expense",amount:24.55,category:"Food",method:"TNG",note:"Sample",date:"2026-11-12"};

test("request ID persists for the same retry, but never stores financial details",async()=>{
 const store=cache();
 const first=await getRecordRequestId("fake-test-user",payload,store,webcrypto);
 const same=await getRecordRequestId("fake-test-user",{...payload},store,webcrypto);
 assert.equal(first,same);
 const persisted=Array.from(store.data.values()).join("");
 assert.doesNotMatch(persisted,/24\.55|Sample|Food|TNG/);
 const other=await getRecordRequestId("other-user",payload,store,webcrypto);
 assert.notEqual(other,first);
 confirmRecordRequest("fake-test-user",first,store);
 assert.equal(store.data.size,1);
 const fresh=await getRecordRequestId("fake-test-user",payload,store,webcrypto);
 assert.notEqual(fresh,first);
});

test("changed payload gets a distinct request ID and cannot be mistaken for prior transaction",async()=>{
 const store=cache();
 const a=await getRecordRequestId("fake",payload,store,webcrypto);
 const b=await getRecordRequestId("fake",{...payload,amount:25.55},store,webcrypto);
 assert.notEqual(a,b);
});

test("unique-conflict recovery selects the first server record, without inserting another",async()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const start=app.indexOf("async function addRecord(");
 const end=app.indexOf("\n}",start);
 assert.ok(start>=0&&end>start);
 const func=app.slice(start,end+2);
 let inserts=0,readBacks=0,stored=0;
 const record={id:12,type:"expense",amount:24.55,category:"Food",method:"TNG",note:"Sample",date:"2026-11-12",deleted_at:null};
 const client={
   from(table){
     assert.equal(table,"records");
     return {
       insert(){
         inserts++;
         return {select:()=>({single:async()=>({data:null,error:{code:"23505",message:"duplicate client request"}})})};
       },
       select(){
         const builder={
           eq(){return builder;},
           async maybeSingle(){readBacks++;return {data:record,error:null};}
         };
         return builder;
       }
     };
   }
 };
 const state=[];
 const context={
   user:{id:"fake-test-user"},
   recordCreationPendingRef:{current:false},
   form:{type:"expense",amount:"24.55",category:"Food",method:"TNG",note:"Sample",date:"2026-11-12"},
   parseEditedAmount,
   toRecordPayload:(rec,user_id)=>({...rec,user_id}),
   getRecordRequestId:async()=> "10000000-0000-4000-8000-000000000001",
   confirmRecordRequest:()=>{stored++;},
   sessionStorage:{},crypto:{},
   supabase:client,
   liveUserIdRef:{current:"fake-test-user"},
   normalizeRecord:r=>r,
   setRecords:fn=>state.splice(0,state.length,...fn(state)),
   setForm:()=>{},setSyncStatus:()=>{},
   amountEntryMode:"rm",today:()=>"2026-11-12",Date,
   playCoinRainSound:()=>{},setCoinRainTrigger:()=>{},
   localizedFinanceAlert:msg=>assert.fail("unexpected alert "+msg)
 };
 const add=vm.runInNewContext(func+"\naddRecord",context,{timeout:1000});
 await add({preventDefault(){}});
 assert.equal(inserts,1);
 assert.equal(readBacks,1);
 assert.equal(stored,1);
 assert.equal(state.length,1);
 assert.equal(state[0].id,12);
});

test("transfer retries preserve the request identity without storing notes or amounts",async()=>{
 const store=cache();
 const transfer={user_id:"fake-test-user",from_method:"BANK",to_method:"TNG",amount:85.40,note:"private",date:"2026-11-12"};
 const a=await getTransferRequestId("fake-test-user",transfer,store,webcrypto);
 const b=await getTransferRequestId("fake-test-user",{...transfer},store,webcrypto);
 assert.equal(a,b);
 assert.doesNotMatch(Array.from(store.data.values()).join(""),/85\.4|private|BANK/);
 confirmTransferRequest("fake-test-user",a,store);
 const c=await getTransferRequestId("fake-test-user",transfer,store,webcrypto);
 assert.notEqual(a,c);
});

test("Money Transfer unique conflict resolves existing transfer without an extra insert",async()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const start=app.indexOf("async function addTransfer(");
 const end=app.indexOf("\n  }",start);
 assert.ok(start>0&&end>start);
 const script=app.slice(start,end+4);
 let inserts=0,readBacks=0,confirmed=0;
 const saved={id:"tx-previous",from_method:"BANK",to_method:"TNG",amount:85.40,date:"2026-11-12",deleted_at:null};
 const db={from:table=>{
   assert.equal(table,"transfers");
   return {
     insert:()=>{inserts++;return {select:()=>({single:async()=>({data:null,error:{code:"23505"}})})};},
     select:()=>{const chain={eq:()=>chain,maybeSingle:async()=>{readBacks++;return {data:saved,error:null}}};return chain;}
   };
 }};
 const state=[];
 const ctx={
   user:{id:"fake-test-user"},
   transferCreationPendingRef:{current:false},
   transferForm:{amount:"85.40",fromMethod:"BANK",toMethod:"TNG",note:"sample",date:"2026-11-12"},
   parseMoneyInput:()=>85.4,requireCalendarDate:value=>value,
   getTransferRequestId:async()=> "10000000-0000-4000-8000-000000000001",
   confirmTransferRequest:()=>confirmed++,
   sessionStorage:{},crypto:{},supabase:db,
   liveUserIdRef:{current:"fake-test-user"},
   normalizeTransfer:row=>({id:row.id,amount:row.amount}),
   setTransfers:fn=>state.splice(0,state.length,...fn(state)),
   setTransferForm:()=>{},setSyncStatus:()=>{},
   today:()=>"2026-11-12",
   localizedFinanceAlert:()=>assert.fail("unexpected transfer error"),
   Date,
 };
 const add=vm.runInNewContext(script+"\naddTransfer",ctx,{timeout:1000});
 await add({preventDefault(){}});
 assert.equal(inserts,1);
 assert.equal(readBacks,1);
 assert.equal(confirmed,1);
 assert.equal(state.length,1);
 assert.equal(state[0].id,"tx-previous");
});
