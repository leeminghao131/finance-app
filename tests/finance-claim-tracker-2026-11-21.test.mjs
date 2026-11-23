import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as XLSX from "xlsx";
import {claimSen,validateClaimDraft,validateClaimRepayment,validateClaimSnapshot,
  claimCashMovements,claimCashSenUntil,claimSummary,withClaimMethodBalances} from "../src/financeClaims.js";
import {calculateCashForecast,summarizeMonthlyBudget} from "../src/financeInsights.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";
import {FINANCE_DOCK_IDS,normalizeDockOrder} from "../src/financeDockOrder.js";
import {createFinanceClaimRepayment} from "../src/financeClaimService.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const sql=()=>readFileSync(new URL("../docs/database/test_only_claim_tracker_20261121.sql",import.meta.url),"utf8");
const owner="11111111-1111-4111-8111-111111111111";
const claimId="22222222-2222-4222-8222-222222222222";
const repayId="33333333-3333-4333-8333-333333333333";
const baseClaim={id:claimId,user_id:owner,client_request_id:"44444444-4444-4444-8444-444444444444",
  title:"Company lunch",claimant:"Employer",amount:"100.00",method:"BANK",
  paid_on:"2026-11-16",note:"",submitted_on:"2026-11-17",cancelled_at:null,
  version:1,created_at:"2026-11-16T00:00:00Z"};
const repayment={id:repayId,user_id:owner,claim_id:claimId,
  client_request_id:"55555555-5555-4555-8555-555555555555",
  amount:"60.00",method:"TNG",received_on:"2026-11-19",note:"",
  voided_at:null,version:1};

test("money parsing uses RM typing, not cents keypad, with integer sen",()=>{
  assert.equal(claimSen("100"),10000);
  assert.equal(claimSen("24.55"),2455);
  assert.equal(claimSen("0.01"),1);
  for(const bad of ["0","0.00","-1","1.234","1,000","hello","","NaN","Infinity"]){
    assert.throws(()=>claimSen(bad),bad);
  }
  assert.deepEqual(validateClaimDraft({
    title:"Team lunch",claimant:"Employer",amount:"100",method:"BANK",
    paid_on:"2026-11-16",note:"food"
  },"2026-11-21"),{
    title:"Team lunch",claimant:"Employer",amount:100,method:"BANK",
    paid_on:"2026-11-16",note:"food"
  });
  assert.throws(()=>validateClaimDraft({...baseClaim,amount:"120",paid_on:"2026-11-23"},"2026-11-21"));
});

test("RM100 advance and RM60 reimbursement preserve true cash without personal Income/Expense",()=>{
  validateClaimSnapshot([baseClaim],[repayment],owner);
  const events=claimCashMovements([baseClaim],[repayment]);
  assert.deepEqual(events.map(event=>[event.kind,event.method,event.sen]),
    [["advance","BANK",-10000],["reimbursement","TNG",6000]]);
  assert.equal(claimCashSenUntil(events,"2026-11-17"),-10000);
  assert.equal(claimCashSenUntil(events,"2026-11-19"),-4000);
  const summary=claimSummary([baseClaim],[repayment],"2026-11-21");
  assert.equal(summary.outstanding,40);
  assert.equal(summary.reimbursed,60);
  assert.equal(summary.open.length,1);
  assert.equal(summary.rows[0].status,"submitted");
  const method=withClaimMethodBalances([
    {method:"BANK",openingBalance:1000,income:0,expense:0,transferIn:0,transferOut:0,balance:1000},
    {method:"TNG",openingBalance:50,income:0,expense:0,transferIn:0,transferOut:0,balance:50}
  ],events,"2026-11-21");
  assert.equal(method.find(m=>m.method==="BANK").balance,900);
  assert.equal(method.find(m=>m.method==="TNG").balance,110);
  assert.equal(method.reduce((n,m)=>n+m.balance,0),1010);
  assert.equal(method.reduce((n,m)=>n+m.expense,0),0);
  assert.equal(method.reduce((n,m)=>n+m.income,0),0);
  assert.equal(summarizeMonthlyBudget([],{"饮食":"200"},"2026-11",["饮食"]).totalExpense,0);
});

test("full reimbursement clears reminder; void and cancellation preserve cloud history and accounting",()=>{
  const all=[repayment,{...repayment,id:"66666666-6666-4666-8666-666666666666",
    client_request_id:"77777777-7777-4777-8777-777777777777",
    amount:"40.00",received_on:"2026-11-20"}];
  assert.equal(claimSummary([baseClaim],all,"2026-11-21").open.length,0);
  assert.equal(claimCashSenUntil(claimCashMovements([baseClaim],all),"2026-11-21"),0);
  const voided=[repayment,{...all[1],voided_at:"2026-11-21T00:00:00Z",version:2}];
  assert.equal(claimSummary([baseClaim],voided,"2026-11-21").outstanding,40);
  const cancelled={...baseClaim,cancelled_at:"2026-11-21T00:00:00Z"};
  assert.equal(claimCashMovements([cancelled],[]).length,0);
  assert.equal(claimSummary([cancelled],[]).open.length,0);
  assert.equal(claimSummary([cancelled],[]).rows.length,1);
  assert.equal(claimSummary([cancelled],[]).rows[0].status,"cancelled");
  assert.equal(claimSummary([cancelled],[]).rows[0].outstanding,0);
  assert.throws(()=>validateClaimSnapshot([cancelled],[repayment],owner),/Cancelled/);
  assert.throws(()=>validateClaimSnapshot([baseClaim],all.concat(all[1]),owner),/duplicate/);
});

test("account isolation, orphan payments, invalid amounts and overpayments fail closed",()=>{
  assert.throws(()=>validateClaimSnapshot([baseClaim],[], "other-user"),/owner/);
  assert.throws(()=>validateClaimSnapshot([baseClaim],[{...repayment,claim_id:"00000000-0000-4000-8000-000000000009"}],owner),/visible claim/);
  assert.throws(()=>validateClaimSnapshot([baseClaim],[{...repayment,amount:"200.00"}],owner),/over-reimbursed/);
  assert.throws(()=>validateClaimRepayment({
    amount:"50.00",received_on:"2026-11-21",method:"CASH"
  },baseClaim,[repayment],"2026-11-21"),/exceed/);
  assert.throws(()=>validateClaimRepayment({
    amount:"1",received_on:"2026-11-15",method:"BANK"
  },baseClaim,[],"2026-11-21"),/date/);
});

test("lost-network confirmation retries reuse exact reimbursement ID, even after balance reached zero",async()=>{
  const existing={...repayment,amount:"100.00",received_on:"2026-11-19"};
  let queries=0,writes=0;
  const client={from(table){
    assert.equal(table,"finance_claim_repayments");
    return {
      select(){return {eq(){return this;},maybeSingle:async()=>{queries++;return {data:existing,error:null};}};},
      insert(){writes++;throw new Error("Retry must not insert twice.");},
    };
  }};
  const draft={amount:"100",method:"TNG",received_on:"2026-11-19",note:""};
  const restored=await createFinanceClaimRepayment(client,owner,baseClaim,draft,[existing],existing.client_request_id);
  assert.equal(restored.id,existing.id);
  assert.equal(writes,0);assert.equal(queries,1);
  await assert.rejects(()=>createFinanceClaimRepayment(client,owner,baseClaim,
    {...draft,amount:"99"},[existing],existing.client_request_id),/different payment/);
  assert.equal(writes,0);
});

test("forecast actual balance includes claim cash flows but personal spending average excludes advances",()=>{
  const events=claimCashMovements([baseClaim],[repayment]);
  const options={asOfDate:"2026-11-21",selectedMonth:"2026-11",
    horizon:"monthEnd",trailingDays:30,openingBalanceTotal:500,claimMovements:events};
  const f=calculateCashForecast([],options);
  assert.equal(f.currentBalance,460);
  assert.equal(f.averageDailyExpense,0);
  assert.equal(f.expectedIncome,0);
  assert.equal(f.timeline.find(x=>x.date==="2026-11-16").actual,400);
  assert.equal(f.timeline.find(x=>x.date==="2026-11-19").actual,460);
  assert.equal(f.predictedBalance,460);
  const baseline=calculateCashForecast([], {...options,claimMovements:[]});
  assert.equal(baseline.currentBalance,500);
});

test("verified Excel export has full claim and reimbursement sheets and correctly adjusted balance",()=>{
  const options={records:[],transfers:[],monthRows:[],budgetTemplate:{},openingBalances:{BANK:"1000"},
    claims:[baseClaim],claimRepayments:[repayment],exportedOn:"2026-11-21"};
  const {workbook,stats}=buildFinanceWorkbook(options);
  assert.ok(workbook.SheetNames.includes("Claim Advances"));
  assert.ok(workbook.SheetNames.includes("Claim Reimbursements"));
  const bytes=verifyFinanceWorkbook(workbook,stats);
  assert.ok(bytes.byteLength>100);
  const recovered=XLSX.read(bytes,{type:"array"});
  const cl=XLSX.utils.sheet_to_json(recovered.Sheets["Claim Advances"]);
  const rep=XLSX.utils.sheet_to_json(recovered.Sheets["Claim Reimbursements"]);
  assert.equal(cl.length,1);
  assert.equal(cl[0]["Still Owed (RM)"],40);
  assert.equal(rep[0]["Amount (RM)"],60);
  assert.equal(stats.claims,1);
  assert.equal(stats.claimRepayments,1);
  assert.equal(stats.claimCashCents,-4000);
  const sum=XLSX.utils.sheet_to_json(recovered.Sheets["Export Summary"]);
  assert.equal(sum.find(r=>r.Metric==="Estimated ledger balance (RM)").Value,960);
  assert.equal(sum.find(r=>r.Metric==="Total expense (RM)").Value,0);
  assert.equal(sum.find(r=>r.Metric==="Total income (RM)").Value,0);
});

test("TEST-only SQL enforces ownership, no deletes, version guards and serialized repayments",()=>{
  const source=sql();
  for(const needle of [
    "create table public.finance_claims","create table public.finance_claim_repayments",
    "alter table public.finance_claims enable row level security",
    "alter table public.finance_claim_repayments enable row level security",
    "using ((select auth.uid())=user_id)",
    "with check ((select auth.uid())=user_id)",
    "for update","existing+new.amount>c.amount",
    "revoke delete on public.finance_claims from authenticated",
    "revoke delete on public.finance_claim_repayments from authenticated",
  ])assert.ok(source.includes(needle),needle);
  assert.doesNotMatch(source,/security definer/i);
  assert.doesNotMatch(source,/\btruncate\b|\bdrop table\b/i);
});

test("claim UI is a single drawer overlay with persistent claim bell; no protected CRUD alterations",()=>{
  const app=src("App.jsx"),dock=src("FinanceInsightsDock.jsx"),panel=src("FinanceClaimTracker.jsx");
  const hub=src("FinanceStage2Hub.jsx"),service=src("financeClaimService.js"),cloud=src("financeCloudService.js");
  assert.equal(FINANCE_DOCK_IDS.length,10);
  assert.equal(FINANCE_DOCK_IDS.filter(v=>v==="claims").length,1);
  assert.equal(normalizeDockOrder(["review","wrapped"]).length,10);
  assert.match(dock,/<FinanceClaimTracker /);
  assert.match(panel,/Claim Tracker/);
  assert.match(panel,/<FinanceOverlay open=\{open\}/);
  assert.match(panel,/onRepay\(claim,repayDraft,request\.requestId\)/);
  assert.match(panel,/confirmClaimRequest\(userId,"repayment",request,storage\)/);
  assert.match(panel,/Mark Submitted/);
  assert.match(hub,/type:"claim"/);
  assert.match(hub,/claims\.filter\(x=>x\.outstanding>0\)/);
  assert.match(hub,/onOpenClaim\(ref,source\)/);
  assert.match(cloud,/loadEveryOwnedRow\(client,"finance_claims"/);
  assert.match(cloud,/loadEveryOwnedRow\(client,"finance_claim_repayments"/);
  assert.match(cloud,/validateClaimSnapshot\(claimRows,repaymentRows,userId\)/);
  assert.match(app,/claimCashSenUntil\(claimMovements,localToday\)\/100/);
  assert.match(app,/withClaimMethodBalances\(calculateMethodBalances\(/);
  assert.match(app,/claims=\{claimOverview\.open\}/);
  assert.match(app,/claimMovements=\{claimMovements\}/);
  assert.match(service,/client_request_id:requestId/);
  assert.match(service,/\.eq\("version",claim\.version\)/);
  assert.match(service,/\.eq\("version",entry\.version\)/);
  assert.ok(!service.includes('from("records")'));
  assert.ok(!service.includes('from("transfers")'));
  assert.match(src("financeClaimTracker.css"),/prefers-reduced-motion:reduce/);
});
