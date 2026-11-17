import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currencyDigits,normalizeFxInput,normalizeFxRate,convertForeignToMYR,makeFxSnapshot,getReferenceFxRate,FX_SOURCE} from "../src/financeFx.js";
import {inspectCsvText} from "../src/financeCsv.js";
import {resolveImportedFxRows} from "../src/financeFxImport.js";
import {answerFinanceQuestion} from "../src/financeAssistantRules.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const quote={currency:"JPY",requestedDate:"2026-01-05",date:"2026-01-05",rate:"0.03",source:FX_SOURCE};

test("Stage4 reference FX keeps original JPY exact and stores MYR as base",()=>{
  assert.equal(currencyDigits("JPY"),0);
  assert.equal(currencyDigits("USD"),2);
  assert.equal(currencyDigits("KWD"),3);
  assert.equal(normalizeFxInput("3000","JPY"),"3000");
  assert.equal(normalizeFxInput("19.50","USD"),"19.50");
  assert.throws(()=>normalizeFxInput("3000.1","JPY"),/Invalid/);
  assert.throws(()=>normalizeFxInput("1.001","USD"),/Invalid/);
  assert.throws(()=>normalizeFxInput("-100","JPY"),/Invalid/);
  assert.throws(()=>normalizeFxInput("0","JPY"),/range/);
  const snapshot=makeFxSnapshot({currency:"JPY",foreignAmount:"3000",quote,recordDate:"2026-01-05"});
  assert.equal(snapshot.amount,90);
  assert.equal(snapshot.fx_amount,"3000");
  assert.equal(snapshot.fx_currency,"JPY");
  assert.equal(snapshot.fx_rate,"0.03");
  assert.equal(snapshot.fx_provider,FX_SOURCE);
  assert.equal(convertForeignToMYR("1","0.005","USD"),.01);
  assert.equal(convertForeignToMYR("3","0.004","USD"),.01);
  assert.equal(normalizeFxRate("0.030000"),"0.03");
});

test("Stage4 FX quote mismatches and invalid rate fail closed",()=>{
  assert.throws(()=>makeFxSnapshot({currency:"USD",foreignAmount:"100",quote,recordDate:"2026-01-05"}),/missing/);
  assert.throws(()=>makeFxSnapshot({currency:"JPY",foreignAmount:"100",quote,recordDate:"2026-01-06"}),/missing/);
  assert.throws(()=>makeFxSnapshot({currency:"JPY",foreignAmount:"100",quote:{...quote,date:"2026-01-06"},recordDate:"2026-01-05"}),/later/);
  assert.throws(()=>normalizeFxRate("0"),/Invalid/);
  assert.throws(()=>convertForeignToMYR("1","0.00000000001","USD"),/range/);
});

test("Stage4 fetches published historical reference rate with verified pair and date",async()=>{
  let requested="";
  const mock=async url=>{requested=url;return {ok:true,json:async()=>({date:"2026-01-02",base:"USD",quote:"MYR",rate:4.2345})}};
  const result=await getReferenceFxRate("USD","2026-01-05",mock);
  assert.equal(result.rate,"4.2345");assert.equal(result.date,"2026-01-02");
  assert.equal(result.requestedDate,"2026-01-05");
  assert.match(requested,/api\.frankfurter\.dev\/v2\/rate\/USD\/MYR\?date=2026-01-05/);
  await assert.rejects(()=>getReferenceFxRate("USD","2026-01-05",async()=>({ok:true,json:async()=>({date:"2026-01-02",base:"EUR",quote:"MYR",rate:1})})),/mismatched/);
  await assert.rejects(()=>getReferenceFxRate("USD","2026-01-05",async()=>({ok:false,status:429})),/unavailable/);
  await assert.rejects(()=>getReferenceFxRate("USD","2026-01-05",async()=>({ok:true,json:async()=>({date:"2025-12-01",base:"USD",quote:"MYR",rate:1})})),/recent-enough/);
});

test("Stage4 optional FX CSV uses dated automatic rate, leaves original MYR CSV intact",async()=>{
  const head="Date,Type,Category,Method,Amount,Note,Currency,Foreign_Amount";
  const input=head+"\n2026-01-05,expense,Food,BANK,,Japan lunch,JPY,3000\n2026-01-05,income,Salary,BANK,100.50,Local,MYR,\n";
  const preview=inspectCsvText(input);
  assert.equal(preview.length,2);
  assert.equal(preview[0].record.fx_amount,"3000");
  const converted=await resolveImportedFxRows(preview,async(currency,date)=>({currency,requestedDate:date,date,rate:".03",source:FX_SOURCE}));
  assert.equal(converted[0].record.amount,"90.00");
  assert.equal(converted[0].record.fx_currency,"JPY");
  assert.equal(converted[0].record.fx_rate,"0.03");
  assert.equal(converted[1].record.amount,"100.50");
  const legacy=inspectCsvText("Date,Type,Category,Method,Amount,Note\n2026-01-05,expense,Food,CASH,9.99,Old");
  assert.equal(legacy[0].record.amount,"9.99");
  assert.throws(()=>inspectCsvText("Date,Type,Category,Method,Amount,Note,Currency\n2026-01-05,expense,Food,CASH,,FX,USD"),/both/);
  assert.equal((await resolveImportedFxRows(preview,async()=>{throw Error("offline")}))[0].invalid,true);
});

test("Stage4 read-only assistant answers only from complete MYR records and refuses incomplete cloud",()=>{
  const records=[{id:1,date:"2026-11-03",type:"income",amount:3000,category:"Salary"},
    {id:2,date:"2026-11-05",type:"expense",amount:40,category:"饮食"},
    {id:3,date:"2026-11-06",type:"expense",amount:20,category:"交通",fx_currency:"JPY",fx_amount:"700"},
    {id:4,date:"2026-11-06",type:"expense",amount:100000,category:"饮食",deleted_at:"2026-11-07"}];
  const ctx={ready:true,records,totalBalance:2940,methods:[{method:"BANK",balance:2940}],bills:[],activities:[],activityLinks:[],reviewState:{threshold:500,decisions:[]},monthRows:[],budgets:{"饮食":100},goals:[]};
  assert.match(answerFinanceQuestion("这个月花了多少钱？",ctx,true).answer,/RM60.00/);
  assert.match(answerFinanceQuestion("这个月收入多少？",ctx,true).answer,/RM3000.00/);
  assert.match(answerFinanceQuestion("我还剩多少钱？",ctx,true).answer,/RM2940.00/);
  assert.match(answerFinanceQuestion("哪类消费最多？",ctx,true).answer,/饮食 RM40.00/);
  assert.match(answerFinanceQuestion("预算还剩多少？",ctx,true).answer,/RM40.00/);
  assert.match(answerFinanceQuestion("这个月花了多少？",{...ctx,ready:false},true).answer,/尚未同步/);
  assert.equal(answerFinanceQuestion("如何转账？",ctx,true).action,"transfer");
});

test("Stage4 Excel exports original FX fields without corrupting RM totals",()=>{
  const sample={id:101,date:"2026-01-05",type:"expense",amount:90,category:"饮食",method:"BANK",note:"Japan",version:1,
    fx_currency:"JPY",fx_amount:"3000",fx_rate:"0.03",fx_rate_date:"2026-01-05",fx_provider:FX_SOURCE};
  const {workbook,stats}=buildFinanceWorkbook({records:[sample],scope:"all"});
  const sheet=workbook.Sheets["Finance Records"];
  assert.equal(sheet["J2"].v,"JPY");
  assert.equal(sheet["K2"].v,3000);
  assert.equal(sheet["L2"].v,0.03);
  assert.equal(sheet["F2"].v,90);
  assert.ok(verifyFinanceWorkbook(workbook,stats).byteLength>100);
});

test("Stage4 source keeps transfer accounting, existing record save, and fail-closed Test Supabase guard",()=>{
  const app=src("App.jsx"),transfer=src("FinanceTransferPanel.jsx"),corners=src("FinanceTransferCorners.jsx"),cloud=src("financeCloudService.js");
  assert.match(app,/getRecordRequestId\(user\.id, payload, sessionStorage, crypto\)/);
  assert.match(app,/updateForeignRecord/);
  assert.match(app,/\.eq\("version",current\.version\)/);
  assert.match(cloud,/fx_currency,fx_amount,fx_rate,fx_rate_date,fx_provider/);
  assert.match(transfer,/<FinanceTransferCorners/);
  assert.match(transfer,/<FinanceOverlay open=\{historyOpen\}/);
  assert.match(corners,/onFrom\(d\.method\);onTo\(dest\)/);
  assert.match(src("supabaseClient.js"),/SANDBOX_PROJECT_ID/);
  assert.match(src("financeImportService.js"),/finance_import_fx_csv_rows/);
  assert.ok(!src("FinanceRuleAssistant.jsx").includes("supabase.from("));
});


test("Stage4 currency catalog dynamically includes supported non-favorite ISO codes",async()=>{
  const {getSupportedFxCurrencies}=await import("../src/financeFx.js");
  const all=await getSupportedFxCurrencies(async()=>({ok:true,json:async()=>[{iso_code:"ZAR"},{iso_code:"PHP"}]}));
  assert.ok(all.includes("MYR")&&all.includes("JPY")&&all.includes("ZAR")&&all.includes("PHP"));
  await assert.rejects(()=>getSupportedFxCurrencies(async()=>({ok:false})),/unavailable/);
});

test("Stage4 assistant uses existing forecast and budget calculators and savings progress",()=>{
  const today=await import("../src/financeCalendar.js").then(m=>m.localDateMY());
  const ctx={ready:true,records:[{id:1,type:"expense",amount:30,category:"饮食",date:today}],
    totalBalance:500,openingBalanceTotal:500,forecastPlans:[],monthRows:[],
    budgets:{"饮食":"100"},goals:[{id:"goal-12345678",title:"Holiday",target:1000,saved:250,deadline:""}],
    bills:[],activities:[],activityLinks:[],reviewState:{threshold:500,decisions:[]}};
  assert.match(answerFinanceQuestion("本月预算还剩多少？",ctx,true).answer,/RM70.00/);
  assert.match(answerFinanceQuestion("储蓄目标进度？",ctx,true).answer,/25%/);
  assert.match(answerFinanceQuestion("月底预测？",ctx,true).answer,/RM/);
});
