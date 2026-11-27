import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {createBillPaymentExpense,recurringBillRequestId,checkBillPaymentEligibility} from "../src/financeBillPayment.js";
import {validateReviewState,findReviewCandidates,DEFAULT_REVIEW_RULES,withBillOccurrence} from "../src/financeStage2.js";

const user="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const bill={id:"bill-safe123",title:"Test internet bill",amount:89.9,category:"住房",method:"BANK",
  anchorDate:"2026-11-17",cycle:"monthly",leadDays:3,active:true,occurrences:[]};
const due="2026-11-17",paidDate="2026-11-15";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
function mockRecordsDB(){
  const rows=new Map();let inserts=0,nextId=10,loseAck=false;
  const client={
    from(table){
      assert.equal(table,"records");
      return {
        select(columns){
          assert.match(columns,/deleted_at/);
          return {eq(a,id){
            assert.equal(a,"user_id");
            return {eq(b,key){
              assert.equal(b,"client_request_id");
              return {async maybeSingle(){
                return {data:rows.get(id+":"+key)||null,error:null};
              }};
            }};
          }};
        },
        insert(payload){
          return {select(columns){
            return {async single(){
              inserts++;
              const key=payload.user_id+":"+payload.client_request_id;
              if(rows.has(key))return {data:null,error:{code:"23505",message:"duplicate key"}};
              const data={...payload,id:++nextId,created_at:"2026-11-15T00:00:00Z",
                updated_at:"2026-11-15T00:00:00Z",version:1,deleted_at:null};
              rows.set(key,data);
              if(loseAck){loseAck=false;throw Error("lost HTTPS acknowledgement");}
              return {data,error:null};
            }};
          }};
        }
      };
    }
  };
  return {client,rows,loseNextAck:()=>{loseAck=true;},get inserts(){return inserts;}};
}

test("Stage 2.1 stable bill request ID is one valid UUID across sessions and differs for users/periods",async()=>{
  const a=await recurringBillRequestId(user,bill.id,due,webcrypto);
  const b=await recurringBillRequestId(user,bill.id,due,webcrypto);
  assert.equal(a,b);
  assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a,await recurringBillRequestId(user,bill.id,"2026-12-17",webcrypto));
  assert.notEqual(a,await recurringBillRequestId(other,bill.id,due,webcrypto));
  await assert.rejects(recurringBillRequestId(user,bill.id,"2026-02-29",webcrypto));
});

test("Stage 2.1 a single confirmed bill creates exactly one real Expense with RM89.90",async()=>{
  const db=mockRecordsDB();
  const snapshot=JSON.stringify(bill);
  const result=await createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto);
  assert.equal(result.created,true);
  assert.equal(db.rows.size,1);
  assert.equal(db.inserts,1);
  assert.equal(result.record.type,"expense");
  assert.equal(result.record.amount,89.9);
  assert.equal(result.record.date,paidDate);
  assert.equal(result.record.category,"住房");
  assert.equal(result.record.method,"BANK");
  assert.equal(result.record.note,bill.title);
  assert.equal(JSON.stringify(bill),snapshot);
  const already=await createBillPaymentExpense(db.client,user,bill,due,"2026-11-16",webcrypto);
  assert.equal(already.created,false);
  assert.equal(already.record.id,result.record.id);
  assert.equal(db.inserts,1);
});
test("Stage 2.1 simultaneous two-device confirmation never creates duplicate Expense",async()=>{
  const db=mockRecordsDB();
  const result=await Promise.all([
    createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto),
    createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto),
  ]);
  assert.equal(result[0].record.id,result[1].record.id);
  assert.equal(db.rows.size,1);
  assert.ok(db.inserts>=1);
});
test("Stage 2.1 lost server response recovers persisted Expense, not a new transaction",async()=>{
  const db=mockRecordsDB();db.loseNextAck();
  const result=await createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto);
  assert.equal(result.created,false);
  assert.equal(db.rows.size,1);
  const before=db.inserts;
  const retry=await createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto);
  assert.equal(retry.record.id,result.record.id);
  assert.equal(db.inserts,before);
  assert.equal(db.rows.size,1);
});
test("Stage 2.1 deleted/edited original Expense fails closed and never creates new one",async()=>{
  const db=mockRecordsDB();
  const result=await createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto);
  const key=user+":"+result.requestId,original=db.rows.get(key);
  db.rows.set(key,{...original,deleted_at:"2026-11-16T00:00:00Z"});
  await assert.rejects(createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto),/Recycle Bin/);
  db.rows.set(key,{...original,note:"edited by another device"});
  await assert.rejects(createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto),/modified/);
  assert.equal(db.inserts,1);
});
test("Stage 2.1 paid occurrence or skipped period cannot create a second Expense",()=>{
  assert.equal(checkBillPaymentEligibility([bill],bill.id,due,[],paidDate).id,bill.id);
  const paid=withBillOccurrence([bill],bill.id,due,{status:"paid",recordId:"record-123"});
  assert.throws(()=>checkBillPaymentEligibility(paid,bill.id,due,[],paidDate),/already marked paid/);
  const skipped=withBillOccurrence([bill],bill.id,due,{status:"skipped"});
  assert.throws(()=>checkBillPaymentEligibility(skipped,bill.id,due,[],paidDate),/skipped/);
});
test("Stage 2.1 two test users with identical bill occurrences have separate request IDs and records",async()=>{
  const db=mockRecordsDB();
  await createBillPaymentExpense(db.client,user,bill,due,paidDate,webcrypto);
  await createBillPaymentExpense(db.client,other,bill,due,paidDate,webcrypto);
  assert.equal(db.rows.size,2);
});
const anomalyRows=[
 {id:"1",date:"2026-11-15",type:"expense",amount:500,category:"饮食",method:"TNG",note:""},
 {id:"2",date:"2026-11-12",type:"expense",amount:10,category:"交通",method:"CASH",note:"bus"},
 {id:"3",date:"2026-11-12",type:"expense",amount:10,category:"交通",method:"CASH",note:"bus"},
 {id:"4",date:"2026-11-20",type:"income",amount:40,category:"Gift",method:"BANK",note:"gift"}
];
test("Stage 2.1 four anomaly switches default ON for old cloud settings and work independently",()=>{
  assert.deepEqual(validateReviewState({threshold:500,decisions:[]}).enabled,DEFAULT_REVIEW_RULES);
  const baseline=findReviewCandidates(anomalyRows,{threshold:500,decisions:[]},paidDate);
  assert.ok(baseline.find(r=>r.id==="1").reasons.includes("large"));
  assert.ok(baseline.find(r=>r.id==="1").reasons.includes("missingNote"));
  assert.ok(baseline.find(r=>r.id==="2").reasons.includes("duplicate"));
  assert.ok(baseline.find(r=>r.id==="4").reasons.includes("futureDate"));
  for(const rule of Object.keys(DEFAULT_REVIEW_RULES)){
    const state=validateReviewState({threshold:500,decisions:[],enabled:{...DEFAULT_REVIEW_RULES,[rule]:false}});
    const candidates=findReviewCandidates(anomalyRows,state,paidDate);
    assert.ok(candidates.every(r=>!r.reasons.includes(rule)),rule);
    assert.ok(candidates.some(r=>r.reasons.length>0),rule);
  }
  assert.deepEqual(findReviewCandidates(anomalyRows,{
    threshold:500,decisions:[],enabled:Object.fromEntries(Object.keys(DEFAULT_REVIEW_RULES).map(k=>[k,false]))
  },paidDate),[]);
  assert.throws(()=>validateReviewState({enabled:{large:"false"}}),/switch/);
});
test("Stage 2.1 review popup switches are controlled by per-owner cloud setting CAS",()=>{
  const component=src("FinanceReviewInbox.jsx"),app=src("App.jsx");
  assert.match(component,/role="switch"/);
  assert.match(component,/REVIEW_RULE_KEYS.map/);
  assert.match(component,/await saveSnapshot\(next,JSON.stringify\(reviewState\)\)/);
  assert.match(app,/saveStage2Field\("review_state",next,baseline\)/);
  assert.match(src("financeStage2.js"),/state.enabled.duplicate/);
});
test("Stage 2.6 Balance Reconciliation remains in a floating dialog without auto-difference alerts",()=>{
  const transfer=src("FinanceTransferPanel.jsx"),hub=src("FinanceStage2Hub.jsx"),app=src("App.jsx");
  assert.match(hub,/FinanceAccountReconciliation/);
  assert.match(transfer,/onTransfer/);
  assert.match(hub,/mode==="accounts"&&<FinanceAccountReconciliation/);
  assert.match(app,/onTransfer=\{addTransfer\}/); // App still uses original transfer handler
  assert.ok(!transfer.includes("<FinanceAccountReconciliation"));
  assert.match(src("FinanceInsightsDock.jsx"),/onOpenStage2Tool\("accounts",e\.currentTarget\)/);
  assert.match(app,/onOpenAccountCheck=\{openStage2AccountCheck\}/);
  assert.match(app,/onSaveChecks=\{\(next,baseline\)=>saveStage2Field\("account_checks",next,baseline\)\}/);
});
test("Stage 2.1 independent payment service uses only INSERT/select and not finance record update/delete",()=>{
 const source=src("financeBillPayment.js"),app=src("App.jsx");
 assert.match(source,/client.from\("records"\).insert\(payload\)/);
 assert.match(source,/client.from\("records"\).select\(fields\)/);
 assert.ok(!source.includes('.update('));
 assert.ok(!source.includes('.upsert('));
 assert.ok(!source.includes('.delete('));
 assert.match(source,/recurringBillRequestId/);
 assert.match(app,/saveStage2Field\("recurring_bills",paid,baseline\)/);
 assert.match(app,/recordSaved=true/);
});
