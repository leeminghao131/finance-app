import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {canonicalFinanceMethod,canonicalFinanceMethodList} from "../src/financeMethodKeys.js";
import {
  planReconciliationTransfers,rm,reconciliationTransferId,reconciliationSignature,
  writeReconciliationTransfer
} from "../src/financeReconciliationTransfers.js";
import {createBillPaymentExpense} from "../src/financeBillPayment.js";

const src=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const userId="11111111-1111-4111-8111-111111111111";
const balances=[
  {method:"TNG",balance:1000},
  {method:"CASH",balance:100},
  {method:"BANK",balance:1000},
  {method:"GRAB PAY",balance:100},
];
const actual={TNG:"1150",CASH:"100",BANK:"880","GRAB PAY":"100"};
function stubDB(){
  let inserts=0,seq=1,dropAck=false;
  const rows=new Map();
  return {
    get rows(){return rows},get inserts(){return inserts},
    loseOnce(){dropAck=true},
    from(table){
      assert.equal(table,"transfers");
      return {
        select(fields){assert.match(fields,/from_method/);return{eq(k1,v1){
          assert.equal(k1,"user_id");return {eq(k2,v2){
            assert.equal(k2,"client_request_id");return{
              async maybeSingle(){return{data:rows.get(v1+":"+v2)||null,error:null}}
            };
          }};}}},
        insert(payload){return {select(){
          return {async single(){
            inserts++;
            const key=payload.user_id+":"+payload.client_request_id;
            if(rows.has(key))return {data:null,error:{code:"23505",message:"duplicate"}};
            const data={...payload,id:seq++,deleted_at:null,version:1,date:payload.date,created_at:"2026-11-15T00:00:00Z"};
            rows.set(key,data);
            if(dropAck){dropAck=false;throw Error("response lost after server write")}
            return {data,error:null};
          }};
        }};}
      };
    }
  };
}

test("Stage2.2 Chinese display aliases use stable keys, preserving custom Method",()=>{
  assert.equal(canonicalFinanceMethod("银行账户"),"BANK");
  assert.equal(canonicalFinanceMethod("TNG 电子钱包"),"TNG");
  assert.equal(canonicalFinanceMethod("现金"),"CASH");
  assert.equal(canonicalFinanceMethod("GrabPay"),"GRAB PAY");
  assert.equal(canonicalFinanceMethod("BANK IN"),"BANK");
  assert.equal(canonicalFinanceMethod("CIMB savings custom"),"CIMB savings custom");
  assert.deepEqual(canonicalFinanceMethodList(["BANK","银行账户","现金","TNG 电子钱包"]),["BANK","CASH","TNG"]);
});
test("Stage2.2 legacy Chinese bill Method may now create one bank Expense",async()=>{
  const bill={id:"bill-safe123",title:"住房",amount:275,category:"住房",method:"银行账户",
    anchorDate:"2026-11-15",cycle:"monthly",leadDays:3,active:true,occurrences:[]};
  let existing=null,inserted=null;
  const client={from(table){assert.equal(table,"records");return{
    select(){return{eq(){return{eq(){return{async maybeSingle(){return{data:existing,error:null}}}}}}}},
    insert(payload){inserted=payload;return{select(){return{async single(){
      const data={...payload,id:9,deleted_at:null,version:1,updated_at:"2026-11-15T00:00:00Z"};
      existing=data;return {data,error:null};
    }}}}}
  }}};
  const first=await createBillPaymentExpense(client,userId,bill,"2026-11-15","2026-11-15",webcrypto);
  assert.equal(inserted.method,"BANK");
  assert.equal(first.record.amount,275);
  assert.equal(first.record.category,"住房");
  assert.equal(first.record.method,"BANK");
  const second=await createBillPaymentExpense(client,userId,bill,"2026-11-15","2026-11-15",webcrypto);
  assert.equal(second.created,false);
  assert.equal(second.record.id,first.record.id);
});
test("Stage2.2 BANK->TNG RM120 is correct for TNG surplus +150 and BANK shortage -120",()=>{
  const p=planReconciliationTransfers(balances,actual);
  assert.deepEqual(p.transfers,[{fromMethod:"BANK",toMethod:"TNG",amount:120}]);
  assert.equal(p.remainingIncome,30);
  assert.equal(p.remainingExpense,0);
  assert.equal(p.difference,30);
  assert.deepEqual(p.remainders,[{method:"TNG",type:"income",amount:30}]);
  assert.equal(p.ledgerTotal,2200);assert.equal(p.actualTotal,2230);
  assert.deepEqual(p.rows.map(x=>x.difference),[150,0,-120,0]);
});
test("Stage2.2 multiple-to-multiple greedily balances without changing sum of Methods",()=>{
 const p=planReconciliationTransfers(balances,{TNG:"1150",CASH:"50",BANK:"880","GRAB PAY":"130"});
 assert.deepEqual(p.transfers,[
   {fromMethod:"CASH",toMethod:"TNG",amount:50},
   {fromMethod:"BANK",toMethod:"TNG",amount:100},
   {fromMethod:"BANK",toMethod:"GRAB PAY",amount:20},
 ]);
 assert.equal(p.remainingIncome,10);
 assert.equal(p.difference,10);
 assert.deepEqual(p.remainders,[{method:"GRAB PAY",type:"income",amount:10}]);
});
test("Stage2.2 one or more short accounts result in suggested Expense, not automatic Expenses",()=>{
 const p=planReconciliationTransfers(balances,{TNG:"990",CASH:"100",BANK:"950","GRAB PAY":"100"});
 assert.deepEqual(p.transfers,[]);
 assert.equal(p.remainingExpense,60);
 assert.equal(p.remainingIncome,0);
 assert.equal(p.difference,-60);
 assert.deepEqual(p.remainders,[{method:"TNG",type:"expense",amount:10},{method:"BANK",type:"expense",amount:50}]);
});
test("Stage2.2 all accounts must be filled; blanks are not zero, exact sen preserved",()=>{
 assert.throws(()=>planReconciliationTransfers(balances,{TNG:"",CASH:"100",BANK:"880","GRAB PAY":"100"}));
 assert.throws(()=>planReconciliationTransfers(balances,{TNG:"1150",CASH:"100",BANK:"880"}),/every Method/);
 assert.throws(()=>planReconciliationTransfers(balances,{...actual,TNG:"1150.123"}),/two decimals/);
 const p=planReconciliationTransfers(
   [{method:"TNG",balance:1.12},{method:"BANK",balance:0}],
   {TNG:"1.14",BANK:"-0.02"}
 );
 assert.deepEqual(p.transfers,[{fromMethod:"BANK",toMethod:"TNG",amount:.02}]);
 assert.equal(p.difference,0);
});
test("Stage2.2 zero diff means no transfers, no residual, no finance writes",()=>{
 const p=planReconciliationTransfers(balances,
  Object.fromEntries(balances.map(b=>[b.method,String(b.balance)])));
 assert.deepEqual(p.transfers,[]);
 assert.deepEqual(p.remainders,[]);
 assert.equal(p.difference,0);
});
test("Stage2.2 deterministic signed transfers are idempotent per owner/plan/step",async()=>{
 const p=planReconciliationTransfers(balances,actual),date="2026-11-15";
 const signature=reconciliationSignature(p,date);
 const a=await reconciliationTransferId(userId,signature,0,webcrypto);
 assert.match(a,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
 assert.equal(a,await reconciliationTransferId(userId,signature,0,webcrypto));
 assert.notEqual(a,await reconciliationTransferId("22222222-2222-4222-8222-222222222222",signature,0,webcrypto));
 const db=stubDB();
 const first=await writeReconciliationTransfer(db,userId,p,date,0,webcrypto);
 assert.equal(first.created,true);assert.equal(first.transfer.fromMethod,"BANK");
 assert.equal(first.transfer.toMethod,"TNG");assert.equal(first.transfer.amount,120);
 const second=await writeReconciliationTransfer(db,userId,p,date,0,webcrypto);
 assert.equal(second.created,false);
 assert.equal(second.transfer.id,first.transfer.id);
 assert.equal(db.inserts,1);
});
test("Stage2.2 two devices confirming same plan step cannot double transfer",async()=>{
 const db=stubDB(),p=planReconciliationTransfers(balances,actual);
 const [a,b]=await Promise.all([
 writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto),
 writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto)]);
 assert.equal(a.transfer.id,b.transfer.id);assert.equal(db.rows.size,1);
});
test("Stage2.2 lost HTTPS acknowledgement recovers same Transfer",async()=>{
 const db=stubDB(),p=planReconciliationTransfers(balances,actual);db.loseOnce();
 const first=await writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto);
 const second=await writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto);
 assert.equal(first.created,false);assert.equal(second.created,false);
 assert.equal(first.transfer.id,second.transfer.id);assert.equal(db.rows.size,1);
});
test("Stage2.2 deleted or edited previous transfer never re-created",async()=>{
 const db=stubDB(),p=planReconciliationTransfers(balances,actual);
 const first=await writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto);
 const k=[...db.rows.keys()][0],data=db.rows.get(k);
 db.rows.set(k,{...data,deleted_at:"2026-11-16T00:00:00Z"});
 await assert.rejects(writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto),/Recycle Bin/);
 db.rows.set(k,{...data,to_method:"CASH"});
 await assert.rejects(writeReconciliationTransfer(db,userId,p,"2026-11-15",0,webcrypto),/differs/);
 assert.equal(db.rows.size,1);assert.equal(db.inserts,1);
});
test("Stage2.2 bill select options use explicit values independent of translated option text",()=>{
 const ui=src("FinanceRecurringBills.jsx"),app=src("App.jsx");
 assert.ok(ui.includes('<option key={m} value={m}>{m}</option>'));
 assert.ok(ui.includes("canonicalFinanceMethod(draft.method)"));
 assert.match(app,/expenseMethodOptions.includes\(canonicalFinanceMethod\(bill.method\)\)/);
 assert.match(src("financeBillPayment.js"),/method:canonicalFinanceMethod\(verified.method\)/);
});
test("Stage2.2 all-Method reconciliation is legible and confirmation required for every transfer",()=>{
 const ui=src("FinanceAccountReconciliation.jsx"),transfer=src("FinanceTransferPanel.jsx");
 assert.match(ui,/normalizedBalances.map/);
 assert.match(ui,/actualByMethod/);
 assert.match(ui,/planReconciliationTransfers/);
 assert.match(ui,/window.confirm\(warning\+lines\+tail\)/);
 assert.match(ui,/onExecuteTransfers\(plan\)/);
 assert.match(ui,/plan.remainders.map/);
 assert.ok(!ui.includes("xl:grid-cols-4"));
 assert.ok(!ui.includes("sm:grid-cols-4"));
 assert.match(transfer,/onExecuteTransfers=\{onExecuteTransfers\}/);
});
test("Stage2.2 execution checks fresh cloud snapshot before every transfer and stops on mismatch",()=>{
 const app=src("App.jsx"),service=src("financeReconciliationTransfers.js");
 assert.match(app,/async function executeStage2Reconciliation/);
 assert.match(app,/await fetchFinanceSnapshot\(supabase,accountId\)/);
 assert.match(app,/remoteMap.get\(method\)!==sen/);
 assert.match(app,/writeReconciliationTransfer\(supabase,accountId,validated,today\(\),i,crypto\)/);
 assert.match(app,/await loadCloudData\(\{background:true\}\)/);
 assert.ok(!service.includes('.update('));
 assert.ok(!service.includes('.delete('));
 assert.ok(!service.includes('.upsert('));
 assert.match(app,/onExecuteTransfers=\{executeStage2Reconciliation\}/);
});
