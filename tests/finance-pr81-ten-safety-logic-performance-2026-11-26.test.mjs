import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {getClaimRequest,confirmClaimRequest} from "../src/financeClaimRequestId.js";
import {createFinanceClaim} from "../src/financeClaimService.js";
import {importReviewedCsvRows} from "../src/financeImportService.js";
import {financeCalendarAllScope,financeCalendarEventsForRange} from "../src/financeCalendarEvents.js";
import {billOccurrences} from "../src/financeStage2.js";
import {compareFinanceMonths} from "../src/financePlanning.js";
import {discoverSpendingPatterns} from "../src/financeSpendingPatterns.js";

const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const draft={title:"Example claim",claimant:"Example company",amount:"120.50",method:"BANK",paid_on:"2026-10-01",note:"synthetic"};
const claimOwner="owner-A";
const asOf="2026-11-26";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("07: each CSV RPC keeps verified owner A token even if auth changes before the request is sent",async()=>{
  let owner="A",writes=0;
  const client={
    auth:{getSession:async()=>({data:{session:{access_token:"test-"+owner,user:{id:owner}}}}),
      getUser:async token=>({data:{user:{id:token.slice(5)}}})},
    rpc:(_name,params)=>{
      owner="B"; // switch after verification, before RPC execution
      return {setHeader:async(name,value)=>{
        writes++;
        assert.equal(name,"Authorization");assert.equal(value,"Bearer test-A");
        assert.equal(params.p_rows.length,100);
        return {data:params.p_rows.map(row=>({source_row:row.source_row,import_status:"inserted"}))};
      }};
    }
  };
  const rows=Array.from({length:101},(_,i)=>({source_row:i+2}));
  await assert.rejects(importReviewedCsvRows(client,"test-hash",rows,null,{ownerId:"A",isOwnerCurrent:()=>owner==="A"}),/account changed/);
  assert.equal(writes,1);
});

test("07: no write when the SDK cannot bind a verified per-request token",async()=>{
  const client={auth:{getSession:async()=>({data:{session:{access_token:"test-A",user:{id:"A"}}}}),
    getUser:async()=>({data:{user:{id:"A"}}})},rpc:()=>({})};
  await assert.rejects(importReviewedCsvRows(client,"test-hash",[{source_row:2}],null,{ownerId:"A",isOwnerCurrent:()=>true}),/cannot safely bind/);
});

test("08: devices share a claim ID for the same verified history, distinct confirmed generation remains possible",async()=>{
  const a=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,[]);
  const b=await getClaimRequest(claimOwner,"advance",{...draft,note:"other note"},store(),webcrypto,null,[]);
  assert.equal(a.requestId,b.requestId);
  const anotherOwner=await getClaimRequest("owner-B","advance",draft,store(),webcrypto,null,[]);
  assert.notEqual(a.requestId,anotherOwner.requestId);
  const next=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,["saved-id"]);
  assert.notEqual(a.requestId,next.requestId);
  const pending=store();
  const legacy=await getClaimRequest(claimOwner,"advance",draft,pending,webcrypto);
  assert.equal((await getClaimRequest(claimOwner,"advance",draft,pending,webcrypto,null,[])).requestId,legacy.requestId);
  assert.equal(confirmClaimRequest(claimOwner,"advance",legacy,pending),true);
});

function fakeClaimDb(){
  const rows=[];
  const query=()=>{
    const filters={};
    const matching=()=>rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
    return {eq(k,v){filters[k]=v;return this;},
      async maybeSingle(){return {data:matching()[0]??null,error:null};},
      then(resolve,reject){return Promise.resolve({data:matching(),error:null}).then(resolve,reject);}};
  };
  return {rows,client:{from:()=>({select:()=>query(),
    insert:payload=>({select:()=>({single:async()=>{
      if(rows.some(r=>r.user_id===payload.user_id&&r.client_request_id===payload.client_request_id))
        return {data:null,error:{message:"synthetic unique constraint"}};
      const data={...payload,id:"claim-"+(rows.length+1),cancelled_at:null};
      rows.push(data);return {data,error:null};
    }})})})}};
}

test("08: simultaneous devices with the same generation cannot double-create under existing unique constraint",async()=>{
  const {rows,client}=fakeClaimDb();
  const a=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,[]);
  const b=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,[]);
  const outcomes=await Promise.allSettled([
    createFinanceClaim(client,claimOwner,draft,a.requestId,[]),
    createFinanceClaim(client,claimOwner,draft,b.requestId,[])
  ]);
  assert.ok(outcomes.some(r=>r.status==="fulfilled"));
  assert.equal(rows.length,1);
  const existing=rows[0];
  const next=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,[existing.id]);
  await assert.rejects(createFinanceClaim(client,claimOwner,draft,next.requestId,[]),/matching advance appeared/);
  await createFinanceClaim(client,claimOwner,draft,next.requestId,[existing.id]);
  assert.equal(rows.length,2,"two explicitly separate genuine payments remain possible");
  assert.equal(rows[0].id,existing.id);
});

test("08: recovered cancelled claim is never presented as a new active cash payment",async()=>{
  const {rows,client}=fakeClaimDb();
  const req=await getClaimRequest(claimOwner,"advance",draft,store(),webcrypto,null,[]);
  await createFinanceClaim(client,claimOwner,draft,req.requestId,[]);
  rows[0].cancelled_at="2026-11-01T00:00:00Z";
  await assert.rejects(createFinanceClaim(client,claimOwner,draft,req.requestId,[]),/cancelled payment/);
  assert.equal(rows.length,1);
});

test("02: All calendar includes transfer-only, claim-only and scheduled-event months",()=>{
  const scope=financeCalendarAllScope({
    records:[{date:"2026-05-01"},{date:"2010-01-01",deleted_at:"x"}],
    transfers:[{date:"2025-12-01"}],
    claims:[{id:"active",paid_on:"2026-03-01"},{id:"cancelled",paid_on:"2011-01-01",cancelled_at:"x"}],
    repayments:[{claim_id:"active",received_on:"2026-11-01"},{claim_id:"cancelled",received_on:"2035-01-01"}],
    plannedIncomes:[{date:"2027-01-01"}],asOfDate:asOf
  });
  assert.deepEqual(scope,{first:"2025-12",last:"2027-01"});
  assert.deepEqual(financeCalendarAllScope({transfers:[{date:"2026-07-03"}],asOfDate:asOf}),{first:"2026-07",last:"2026-07"});
  assert.deepEqual(financeCalendarAllScope({bills:[{anchorDate:"2020-01-31",occurrences:[]}],asOfDate:asOf}),{first:"2020-01",last:"2026-11"});
});

test("03 and 11: future-dated ledger rows are not counted as actual calendar cash or monthly totals",()=>{
  const records=[{id:"past",date:"2026-11-20",type:"expense",amount:12.34,category:"Food"},
    {id:"future",date:"2026-11-30",type:"expense",amount:100,category:"Food"},
    {id:"future-income",date:"2026-11-30",type:"income",amount:2500,category:"Salary"}];
  const before=JSON.stringify(records);
  const comparison=compareFinanceMonths(records,"2026-10","2026-11",asOf);
  assert.equal(comparison.second.expense,12.34);assert.equal(comparison.second.income,0);
  assert.equal(comparison.second.net,-12.34);assert.equal(comparison.second.count,1);
  const events=financeCalendarEventsForRange({records,first:"2026-11-01",last:"2026-11-30",asOfDate:asOf});
  assert.equal(events.find(e=>e.sourceId==="future").planned,true);
  assert.equal(events.find(e=>e.sourceId==="future").cashSen,0);
  assert.equal(JSON.stringify(records),before);
  assert.match(src("App.jsx"),/if\(r\.date<=localToday\)amounts\[r\.date\]/);
  assert.match(src("FinanceMonthComparison.jsx"),/compareFinanceMonths\(records,firstMonth,secondMonth,asOfDate\)/);
});

test("13: recurrence jump returns exactly the same visible dates and statuses as the full oldest-overdue scan",()=>{
  const bills=["weekly","monthly","quarterly","yearly"].map((cycle,i)=>({
    id:"old-bill-"+i,title:cycle,amount:25,category:"Bills",method:"BANK",cycle,
    anchorDate:"2000-01-31",leadDays:2,active:true,occurrences:[]}));
  const first="2026-11-01",last="2026-11-30";
  const fast=billOccurrences(bills,first,[],0,29,false);
  const reference=billOccurrences(bills,first,[],0,29,true).filter(x=>x.due>=first&&x.due<=last);
  assert.deepEqual(fast,reference);
  assert.ok(fast.length>0);
});

test("04: radar findings use dimensionless threshold multiples instead of ranking raw RM and counts",()=>{
  const records=[];
  for(const month of ["2026-07","2026-08","2026-09","2026-10"])
    for(let i=1;i<=4;i++)records.push({id:month+"-"+i,date:month+"-0"+i,type:"expense",category:"Food",amount:20});
  for(let i=1;i<=10;i++)records.push({id:"now-"+i,date:"2026-11-"+String(i).padStart(2,"0"),type:"expense",category:"Food",amount:30});
  const result=discoverSpendingPatterns(records,{asOfDate:asOf,baselineMonths:3});
  const category=result.findings.find(f=>f.kind==="category");
  const frequency=result.findings.find(f=>f.kind==="frequency");
  assert.ok(category&&frequency);
  assert.ok(Math.abs(category.rankScore-Math.min((300-80)/30,(300/80-1)/.35))<1e-9);
  assert.ok(Math.abs(frequency.rankScore-Math.min((10-4)/3,(10/4-1)/.5))<1e-9);
  assert.ok(result.findings.every((f,i,a)=>Number.isFinite(f.rankScore)&&f.rankScore>=1&&(i===0||a[i-1].rankScore>=f.rankScore)));
});

test("01, 14 and 16: calendar errors remain local and immutable display totals reuse caches",()=>{
  const app=src("App.jsx"),comparison=src("FinanceMonthComparison.jsx");
  assert.match(app,/calendarResult\.error/);
  assert.match(app,/open=\{Boolean\(selectedDay\)&&!calendarResult\.error\}/);
  assert.match(app,/calendarResult=useMemo/);
  assert.match(app,/const income = useMemo\(\(\)=>sumType/);
  assert.match(app,/const periodIncome = useMemo\(\(\)=>sumType/);
  assert.match(app,/const filteredExpense = useMemo\(\(\)=>sumType/);
  assert.match(comparison,/const formatter = new Intl\.NumberFormat/);
});
