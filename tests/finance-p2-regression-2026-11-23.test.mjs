import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as XLSX from "xlsx";
import {answerFinanceQuestion} from "../src/financeAssistantRules.js";
import {reconciliationRecentActivity} from "../src/financeReconciliationActivity.js";
import {csvFxAwareFingerprint,resolveImportedFxRows} from "../src/financeFxImport.js";
import {inspectCsvText} from "../src/financeCsv.js";
import {FX_SOURCE} from "../src/financeFx.js";
import {validateBills,withBillOccurrence} from "../src/financeStage2.js";
import {shiftCalendarDay} from "../src/financeCalendar.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";
import {compareFinanceMonths} from "../src/financePlanning.js";
import {normalizeBudgetsInput,summarizeMonthlyBudget} from "../src/financeInsights.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("P2 #07: monthly Excel summary clearly labels balance vs period cash and does not modify amounts",()=>{
  const records=[
    {id:"past",date:"2026-10-20",type:"income",amount:1000,category:"Salary",method:"BANK",note:""},
    {id:"current",date:"2026-11-20",type:"expense",amount:25,category:"Food",method:"TNG",note:""},
    {id:"future",date:"2026-12-01",type:"income",amount:900,category:"Salary",method:"BANK",note:"Future"}
  ];
  const before=JSON.stringify(records);
  const options={records,transfers:[],monthRows:[],budgetTemplate:{},openingBalances:{BANK:"500"},
    scope:"month",month:"2026-11",exportedOn:"2026-11-23"};
  const {workbook,stats}=buildFinanceWorkbook(options);
  const roundtrip=XLSX.read(verifyFinanceWorkbook(workbook,stats),{type:"array"});
  const summary=XLSX.utils.sheet_to_json(roundtrip.Sheets["Export Summary"]);
  const metric=key=>summary.find(r=>r.Metric===key)?.Value;
  assert.equal(metric("Actual ledger-estimated balance through export date (RM)"),1475);
  assert.equal(metric("Selected-scope net cash movement through export date (RM)"),-25);
  assert.equal(metric("Opening balance total (RM)"),500);
  assert.equal(stats.records,1);
  assert.equal(JSON.stringify(records),before);
});

test("P2 #09: reconciliation details include cash claim advance and repayment, never personal expense/income",()=>{
  const records=[{id:"i",date:"2026-11-22",type:"income",amount:100,method:"BANK",note:"Pay"},
    {id:"future",date:"2026-12-01",type:"income",amount:200,method:"BANK"},
    {id:"gone",date:"2026-11-22",type:"expense",amount:1000,method:"BANK",deleted_at:"2026-11-22"}];
  const transfers=[{id:"t",date:"2026-11-22",amount:20,fromMethod:"BANK",toMethod:"TNG"}];
  const claimMovements=[
    {id:"claim:one",date:"2026-11-20",kind:"advance",method:"BANK",sen:-5500},
    {id:"repayment:one",date:"2026-11-23",kind:"reimbursement",method:"BANK",sen:1500},
    {id:"claim:future",date:"2026-12-01",kind:"advance",method:"BANK",sen:-99900},
  ];
  const result=reconciliationRecentActivity(records,transfers,claimMovements,"BANK","2026-11-23");
  assert.equal(result.length,4);
  assert.deepEqual(result.map(r=>[r.kind,r.amount]),[
    ["claim-reimbursement",15],["income",100],["transfer",-20],["claim-advance",-55]
  ]);
  assert.ok(result.every(r=>r.kind!=="expense"));
  assert.equal(reconciliationRecentActivity(records,transfers,claimMovements,"TNG","2026-11-23")[0].amount,20);
  assert.equal(reconciliationRecentActivity(records,transfers,claimMovements,"CASH","2026-11-23").length,0);
  assert.match(src("FinanceAccountReconciliation.jsx"),/reconciliationRecentActivity/);
  assert.match(src("FinanceStage2Hub.jsx"),/claimMovements=\{claimMovements\}/);
  assert.match(src("App.jsx"),/transfers=\{transfers\} claimMovements=\{claimMovements\}/);
});

test("P2 #12: explicit forecast words win over balance/account/cash, normal balance remains unchanged",()=>{
  const ctx={ready:true,records:[{id:"i",date:"2026-11-20",type:"income",amount:500,
    method:"BANK",category:"Salary",note:""}],asOfDate:"2026-11-23",forecastMonth:"2026-11",
    methods:[{method:"BANK",balance:500}],totalBalance:500,
    openingBalanceTotal:0,claimMovements:[],forecastPlans:[],budgets:{},monthRows:[]};
  const forecastTerms=["月底余额预测","预计月底还剩多少钱","balance forecast","cash flow forecast","predict balance"];
  for(const q of forecastTerms){
    const result=answerFinanceQuestion(q,ctx,false);
    assert.match(result.answer,/Month-end estimate/,q);
  }
  assert.match(answerFinanceQuestion("What's my ledger balance?",ctx,false).answer,/Verified ledger balance/);
  assert.equal(answerFinanceQuestion("bank balances",ctx,false).action,"accounts");
});

test("P2 #15: reserved custom category labels are legitimate data, not JS object properties",()=>{
  const ctx={ready:true,records:[
    {id:"a",date:"2026-11-20",type:"expense",category:"__proto__",method:"BANK",amount:50,note:""},
    {id:"b",date:"2026-11-21",type:"expense",category:"constructor",method:"BANK",amount:80,note:""},
    {id:"c",date:"2026-11-22",type:"expense",category:"toString",method:"BANK",amount:40,note:""}
  ],asOfDate:"2026-11-23"};
  const answer=answerFinanceQuestion("top spending category",ctx,false).answer;
  assert.match(answer,/constructor RM80\.00/);
  const app=src("App.jsx"),assistant=src("financeAssistantRules.js");
  assert.match(app,/const totals=new Map\(\)/);
  assert.match(app,/const categoryTotals=new Map\(\)/);
  assert.match(app,/return Object\.fromEntries\(totals\)/);
  assert.match(assistant,/const totals=new Map\(\)/);
  assert.doesNotMatch(app,/out\[key\] = \(out\[key\] \|\| 0\)/);
});

test("P2 #13: two different original FX amounts can round to identical RM but are not duplicates",async()=>{
  const csv="date,type,category,method,amount,note,currency,foreign_amount\n"+
    "2026-11-10,expense,Food,BANK,,Meal,USD,10.00\n"+
    "2026-11-10,expense,Food,BANK,,Meal,USD,10.01\n"+
    "2026-11-10,expense,Food,BANK,,Meal,USD,10.00\n";
  const rate=async(currency,date)=>({currency,requestedDate:date,date,rate:"0.4",source:FX_SOURCE});
  const before=inspectCsvText(csv);
  const after=await resolveImportedFxRows(before,rate,[]);
  assert.equal(after.length,3);
  assert.ok(after.every(x=>x.record.amount==="4.00"));
  assert.equal(after[0].issue,null);
  assert.equal(after[1].issue,null);
  assert.match(after[2].issue,/earlier in this CSV/);
  const otherExisting={...after[0].record,id:"old"};
  const sameExisting=await resolveImportedFxRows(before.slice(0,2),rate,[otherExisting]);
  assert.match(sameExisting[0].issue,/already exists/);
  assert.equal(sameExisting[1].issue,null);
  const myr={date:"2026-11-10",type:"expense",category:"Food",method:"BANK",amount:"4.00",note:"Meal"};
  const separated=await resolveImportedFxRows(before.slice(0,2),rate,[myr]);
  assert.equal(separated[0].issue,null);
  assert.notEqual(csvFxAwareFingerprint(after[0].record),csvFxAwareFingerprint(after[1].record));
  assert.equal(csvFxAwareFingerprint({...after[0].record,fx_amount:"10.0"}),
    csvFxAwareFingerprint(after[0].record));
});

test("P2 #16: 161+ recurring confirmations stay intact after saving new occurrence",()=>{
  const bill={id:"bill-abcdefgh",title:"Weekly fee",amount:"10",category:"住房",method:"BANK",
    cycle:"weekly",anchorDate:"2020-01-01",leadDays:0,active:true,
    occurrences:Array.from({length:161},(_,i)=>({
      due:shiftCalendarDay("2020-01-01",i*7),status:"skipped"
    }))};
  const original=JSON.stringify(bill);
  const validated=validateBills([bill]);
  assert.equal(validated[0].occurrences.length,161);
  const next=withBillOccurrence([bill],bill.id,shiftCalendarDay("2020-01-01",161*7),
    {status:"skipped"});
  assert.equal(next[0].occurrences.length,162);
  assert.equal(JSON.stringify(bill),original);
  assert.equal(new Set(next[0].occurrences.map(x=>x.due)).size,162);
});

test("P2 #16: large history cannot be silently truncated or overwritten",()=>{
  const base={id:"bill-abcdefgh",title:"Weekly fee",amount:"10",category:"住房",method:"BANK",
    cycle:"weekly",anchorDate:"2020-01-01",leadDays:0,active:true,occurrences:[]};
  const many=Array.from({length:5001},(_,i)=>({
    due:shiftCalendarDay("2000-01-01",i),status:"skipped"
  }));
  assert.equal(validateBills([{...base,occurrences:many.slice(0,5000)}])[0].occurrences.length,5000);
  assert.throws(()=>validateBills([{...base,occurrences:many}]),/5,000 entries/);
});

test("P2 #20: original locked FX quote restored after date/currency revert; edit-start version still guarded",()=>{
  const source=src("FinanceFxRecordEditor.jsx");
  assert.match(source,/const originalQuoteRef=useRef\(null\)/);
  assert.match(source,/originalQuoteRef\.current=originalQuote/);
  assert.match(source,/if\(date===record\.date&&currency===record\.fx_currency\)\{/);
  assert.match(source,/setQuote\(originalQuoteRef\.current\)/);
  assert.match(source,/setLoading\(false\)/);
  assert.match(source,/return \(\)=>ctrl\.abort\(\)/);
  assert.match(source,/expectedVersion:openedVersionRef\.current/);
  assert.match(source,/if\(!ctrl\.signal\.aborted\)setQuote\(result\)/);
});


test("P2 reserved custom categories survive monthly comparisons and budget JSON roundtrip",()=>{
  const list=[
    {id:"a",date:"2026-10-05",type:"expense",amount:10,category:"__proto__",method:"BANK"},
    {id:"b",date:"2026-11-05",type:"expense",amount:35,category:"constructor",method:"BANK"},
    {id:"c",date:"2026-11-05",type:"expense",amount:7,category:"toString",method:"BANK"},
    {id:"d",date:"2026-11-06",type:"expense",amount:12,category:"__proto__",method:"TNG"}
  ];
  const raw=JSON.parse('{"__proto__":"20","constructor":"100","toString":"15"}');
  const before=JSON.stringify(raw);
  const normalized=normalizeBudgetsInput(raw);
  assert.equal(Object.getPrototypeOf(normalized),Object.prototype);
  assert.equal(Object.hasOwn(normalized,"__proto__"),true);
  assert.deepEqual(normalized,JSON.parse('{"__proto__":"20.00","constructor":"100.00","toString":"15.00"}'));
  assert.equal(JSON.stringify(raw),before);
  const compared=compareFinanceMonths(list,"2026-10","2026-11");
  assert.equal(compared.first.expense,10);
  assert.equal(compared.second.expense,54);
  // The long-standing first/second.categories internal contract is integer sen.
  assert.equal(compared.first.categories["__proto__"],1000);
  assert.equal(compared.second.categories.constructor,3500);
  assert.equal(compared.second.categories.toString,700);
  // Public cross-month category comparison is RM, with no rounding change.
  assert.equal(compared.categories.find(x=>x.category==="__proto__").first,10);
  assert.equal(compared.categories.find(x=>x.category==="constructor").second,35);
  const budget=summarizeMonthlyBudget(list,normalized,"2026-11");
  assert.equal(budget.rows.find(row=>row.category==="__proto__").spent,12);
  assert.equal(budget.rows.find(row=>row.category==="constructor").spent,35);
  assert.equal(budget.rows.find(row=>row.category==="toString").spent,7);
});
