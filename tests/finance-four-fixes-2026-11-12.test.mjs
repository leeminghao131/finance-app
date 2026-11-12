import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { loadEveryOwnedRow, parseEditedAmount } from "../src/financeData.js";
import { buildFinanceWorkbook, verifyFinanceWorkbook } from "../src/financeExcel.js";

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
function functionSource(name,until="\n}") {
  const start=app.indexOf((name==="addRecord"?"async ":"")+"function "+name+"(");
  assert.ok(start>=0,"Missing "+name);
  const end=app.indexOf(until,start);
  assert.ok(end>start,"Missing closing marker "+name);
  return app.slice(start,end+until.length);
}
function appFunction(name,context={}) {
  return vm.runInNewContext(functionSource(name)+"\n"+name,context,{timeout:1000});
}

test("calculator uses normal RM for quantities and integer amounts",()=>{
  const calculate=appFunction("calculate");
  assert.equal(calculate("3.50+12.90+2*5.40"),27.2);
  assert.equal(calculate("100+50"),150);
  assert.equal(calculate("24.55+10"),34.55);
  assert.equal(calculate("(2+3)*5.40"),27);
  assert.equal(calculate("3*0.01"),0.03);
  assert.throws(()=>calculate("1/0"));
  assert.throws(()=>calculate("abc"));
  assert.equal(parseEditedAmount("100"),100);
  assert.match(app,/amount: amountEntryMode === "cents" \? formatMoneyTyping/);
});

test("double click submits one income/expense while first insert is pending", async()=>{
  let complete;
  let inserts=0;
  const state=[];
  const ref={current:false};
  const context={
    user:{id:"fake-test-user"},
    recordCreationPendingRef:ref,
    getRecordRequestId:async()=> "10000000-0000-4000-8000-000000000001",
    confirmRecordRequest:()=>{},
    sessionStorage:{},crypto:{},
    amountEntryMode:"rm",
    form:{type:"expense",amount:"100",category:"Food",method:"CASH",note:"Test",date:"2026-11-12"},
    parseEditedAmount,
    toRecordPayload:(v,user_id)=>({...v,user_id}),
    supabase:{from:(name)=>{assert.equal(name,"records");return {
      insert:()=>{inserts++;return {
        select:()=>({single:()=>new Promise(resolve=>{complete=resolve;})}),
      };},
    };}},
    liveUserIdRef:{current:"fake-test-user"},
    normalizeRecord:r=>r,
    setRecords:fn=>state.splice(0,state.length,...fn(state)),
    setForm:()=>{},
    setSyncStatus:()=>{},
    playCoinRainSound:()=>{},
    setCoinRainTrigger:()=>{},
    localizedFinanceAlert:()=>assert.fail("Unexpected alert"),
    today:()=> "2026-11-12",
    Date,
  };
  const submit=appFunction("addRecord",context);
  const event={preventDefault(){}};
  const first=submit(event);
  await submit(event);
  assert.equal(inserts,1);
  assert.equal(ref.current,true);
  complete({data:{id:99,type:"expense",amount:100},error:null});
  await first;
  assert.equal(ref.current,false);
  assert.equal(state.length,1);
  assert.equal(state[0].amount,100);
});

test("same-count simultaneous edit cannot pass a cloud snapshot",async()=>{
  const rows=[{id:1,user_id:"test",amount:10,version:1},{id:2,user_id:"test",amount:20,version:1}];
  let pages=0;
  let countCalls=0;
  const db={from:()=>({
    select(_fields,opt={}){this.head=Boolean(opt.head);return this;},
    eq(){return this;},order(){return this;},
    async range(start,end){
      pages++;
      // One edit after first pass but before second pass; count remains 2.
      if(pages===2){rows[0]={...rows[0],amount:30,version:2};}
      return {data:rows.slice(start,end+1).map(r=>({...r})),error:null};
    },
    then(ok,fail){countCalls++;return Promise.resolve({count:2,error:null}).then(ok,fail);}
  })};
  const result=await loadEveryOwnedRow(db,"records","id,amount,version","test",null,500);
  assert.equal(result[0].amount,30);
  assert.ok(pages>=4, "Must repeat the read when same-count content changes");
  assert.ok(countCalls>=8);
});

test("Excel roundtrip checks transfers, budgets, expected income and all sheets",()=>{
  const {workbook,stats}=buildFinanceWorkbook({
    records:[{id:1,date:"2026-11-12",type:"expense",category:"Food",method:"CASH",amount:10.1,note:"中文"}],
    transfers:[{id:"t",date:"2026-11-12",fromMethod:"CASH",toMethod:"TNG",amount:24.55}],
    monthRows:[{month:"2026-11",category_budgets:{Food:"200.25"}}],
    budgetTemplate:{Food:"300.00"},
    forecastPlans:[{id:"p",date:"2026-11-30",amount:2500,note:"Next salary"}],
  });
  assert.ok(verifyFinanceWorkbook(workbook,stats).byteLength>100);
  assert.equal(stats.transferTotalCents,2455);
  assert.equal(stats.budgetTotalCents,20025);
  assert.equal(stats.plannedTotalCents,250000);
  assert.throws(()=>verifyFinanceWorkbook(workbook,{...stats,transferTotalCents:1}),/transfer, budget or expected income/);
  const changed={...stats,expectedSheets:{...stats.expectedSheets, "Budget Template":[["Category","Default Budget (RM)"],["Food",999]]}};
  assert.throws(()=>verifyFinanceWorkbook(workbook,changed),/cell data changed/);
});

test("custom options persistence failures revert the current optimistic value",async()=>{
  assert.match(app,/confirmedCustomOptionsRef\.current = loadedOptions/);
  assert.match(app,/setCustomOptions\(current => current === nextOptions \? confirmedCustomOptionsRef\.current : current\)/);
  assert.match(app,/localizedFinanceAlert\("Custom categories\/methods were not saved/);
});
