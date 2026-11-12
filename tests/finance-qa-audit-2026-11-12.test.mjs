import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseEditedAmount } from "../src/financeData.js";
import { translateFinanceText } from "../src/financeLanguage.js";

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
function extractAsync(name){
  const start=app.indexOf("async function "+name+"(");
  assert.ok(start>=0,name+" missing");
  const end=app.indexOf("\n}",start);
  assert.ok(end>start,name+" closing brace missing");
  return app.slice(start,end+2);
}

test("QA: network-rejected add-record keeps draft and warns result is uncertain",async()=>{
  const events=[];
  let submits=0;
  const ref={current:false};
  const ctx={
    user:{id:"fake-user"},
    form:{type:"expense",amount:"123.45",category:"Food",method:"BANK",note:"unconfirmed",date:"2026-11-12"},
    recordCreationPendingRef:ref,
    getRecordRequestId:async()=> "10000000-0000-4000-8000-000000000001",
    confirmRecordRequest:()=>{},
    sessionStorage:{},crypto:{},
    liveUserIdRef:{current:"fake-user"},
    parseEditedAmount,
    toRecordPayload:(record,user_id)=>({...record,user_id}),
    supabase:{from:()=>({insert:()=>{submits++;return {
      select:()=>({single:async()=>{throw new Error("network connection lost");}})
    };}})},
    setForm:()=>events.push("draft-cleared"),
    setRecords:()=>events.push("record-added"),
    setSyncStatus:text=>events.push(text),
    localizedFinanceAlert:text=>events.push(text),
    Date,console,
  };
  const add=vm.runInNewContext(extractAsync("addRecord")+"\naddRecord",ctx,{timeout:1000});
  await add({preventDefault(){}});
  assert.equal(submits,1);
  assert.equal(ref.current,false);
  assert.ok(events.some(s=>s.includes("save not confirmed")));
  assert.ok(events.some(s=>s.includes("Check the refreshed transaction list")));
  assert.ok(!events.includes("draft-cleared"));
  assert.ok(!events.includes("record-added"));
});

test("QA: core language switch covers previous untranslated visible captions",()=>{
  for(const [english,chinese] of [
    ["Transfer only moves money between methods.","转账只在不同支付账户之间移动资金。"],
    ["No expense data for this category.","这个分类暂无支出数据。"],
    ["Record save not confirmed — refresh cloud records before retrying.","记录保存状态未确认，请先刷新云端数据再重试。"],
  ]){
    assert.equal(translateFinanceText(english,"zh"),chinese);
    assert.equal(translateFinanceText(chinese,"en"),english);
  }
  assert.equal(translateFinanceText("My personal note","zh"),"My personal note");
  assert.equal(translateFinanceText("100.00","en"),"100.00");
});
