import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as XLSX from "xlsx";
import {answerFinanceQuestion} from "../src/financeAssistantRules.js";
import {calculateCashForecast} from "../src/financeInsights.js";
import {billOccurrences} from "../src/financeStage2.js";
import {previousCalendarDays,shiftCalendarDay} from "../src/financeCalendar.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

const records=[
  {id:"i1",date:"2026-11-18",type:"income",amount:1000,category:"Salary",method:"BANK",note:""},
  {id:"e1",date:"2026-11-21",type:"expense",amount:100,category:"饮食",method:"BANK",note:""},
  {id:"i2",date:"2026-12-01",type:"income",amount:300,category:"Salary",method:"BANK",note:"Future"}
];
const claim={id:"claim-1111",user_id:"user-1",title:"Team meal",claimant:"Company",
  amount:200,method:"BANK",paid_on:"2026-11-20",note:"",
  submitted_on:null,cancelled_at:null,version:1};
const repayment={id:"repay-1111",user_id:"user-1",claim_id:claim.id,
  amount:50,method:"TNG",received_on:"2026-11-22",note:"",voided_at:null,version:1};
const claimMovements=[
  {id:"claim:claim-1111",date:"2026-11-20",kind:"advance",method:"BANK",sen:-20000},
  {id:"repayment:repay-1111",date:"2026-11-22",kind:"reimbursement",method:"TNG",sen:5000}
];

test("P1 assistant and Dashboard month-end forecast share Claim cash movements",()=>{
  const ctx={records,ready:true,forecastPlans:[],forecastMonth:"2026-11",asOfDate:"2026-11-23",
    openingBalanceTotal:0,claimMovements};
  const answer=answerFinanceQuestion("月底预测？",ctx,true).answer;
  const opts={asOfDate:"2026-11-23",selectedMonth:"2026-11",horizon:"monthEnd",
    trailingDays:30,plannedIncomes:[],openingBalanceTotal:0,claimMovements};
  const correct=calculateCashForecast(records,opts);
  const wrong=calculateCashForecast(records,{...opts,claimMovements:[]});
  assert.ok(answer.includes("RM"+correct.predictedBalance.toFixed(2)));
  assert.equal(Math.round((wrong.predictedBalance-correct.predictedBalance)*100),15000);
  assert.match(src("App.jsx"),/claimMovements,asOfDate:localToday,forecastMonth/);
});

test("P1 future trend balance is unknown, never a false RM0 alert",()=>{
  const chart=src("FinanceExpandedTrendOverlay.jsx");
  assert.match(chart,/balance == null \? \(language==="zh" \? "尚无实际余额" : "No actual balance yet"\) : rm\(balance\)/);
  assert.match(chart,/balance == null \? "Future actual balance is unknown — no alert\."/);
});

test("P1 reconciliation checks same MY as-of date as Dashboard balance",()=>{
  const app=src("App.jsx");
  assert.match(app,/latest\.records\.filter\(r=>r\.date<=localToday\)\.map/);
  assert.match(app,/latest\.transfers\.filter\(t=>t\.date<=localToday\)/);
  assert.match(app,/claimCashMovements\(latest\.claims,latest\.repayments\),localToday/);
});

test("P1 oldest unpaid bill remains actionable after 70 days; bounded calendar unchanged",()=>{
  const b={id:"bill-test-1111",title:"Rent",amount:"50",category:"住房",method:"BANK",
    anchorDate:"2026-01-01",cycle:"monthly",leadDays:3,active:true,occurrences:[]};
  const asOf="2026-11-23",cutoff=shiftCalendarDay(asOf,-70);
  const old=billOccurrences([b],asOf,[],70,40,true).filter(x=>x.due<cutoff);
  assert.equal(old.length,1);
  assert.equal(old[0].due,"2026-01-01");
  assert.equal(old[0].visible,true);
  assert.equal(billOccurrences([b],asOf,[],70,40).filter(x=>x.due<cutoff).length,0);
  const skipped={...b,occurrences:[{due:"2026-01-01",status:"skipped"}]};
  assert.equal(billOccurrences([skipped],asOf,[],70,40,true).filter(x=>x.due<cutoff)[0].due,"2026-02-01");
  const snoozed={...b,occurrences:[{due:"2026-01-01",status:"snoozed",remindOn:"2026-12-01"}]};
  assert.equal(billOccurrences([snoozed],asOf,[],70,40,true).filter(x=>x.due<cutoff)[0].due,"2026-02-01");
});

test("P1 weekly bill founded over ten years ago remains discoverable",()=>{
  const b={id:"bill-old-weekly",title:"Old plan",amount:"10",category:"住房",method:"BANK",
    anchorDate:"2010-01-01",cycle:"weekly",leadDays:0,active:true,occurrences:[]};
  const a=billOccurrences([b],"2026-11-23",[],70,35,true);
  assert.ok(a.some(x=>x.due==="2010-01-01"&&x.visible));
  assert.ok(a.some(x=>x.due>="2026-10-01"&&x.due<="2026-12-28"));
});

test("P1 recent filters and heatmap refresh after Kuala Lumpur midnight",()=>{
  assert.equal(previousCalendarDays(7,"2026-11-23"),"2026-11-17");
  assert.equal(previousCalendarDays(7,"2026-11-24"),"2026-11-18");
  const app=src("App.jsx");
  assert.match(app,/filterRecords\(records, filterMode, selectedMonth, selectedYear, "", localToday\)/);
  assert.match(app,/filterRecords\(records, filterMode, selectedMonth, selectedYear, keyword, localToday\)/);
  assert.match(app,/\[records, filterMode, selectedMonth, selectedYear, localToday\]/);
  assert.match(app,/\[expenseRecords, periodRecords, filterMode, selectedMonth, localToday\]/);
  assert.match(app,/record\.date === localToday/);
});

test("P1 Excel includes future raw records yet reports as-of ledger and monthly movement separately",()=>{
  const props={records,transfers:[],monthRows:[],budgetTemplate:{},
    openingBalances:{BANK:"1000"},forecastPlans:[],
    claims:[claim],claimRepayments:[repayment],exportedOn:"2026-11-23"};
  const all=buildFinanceWorkbook(props);
  const wb=XLSX.read(verifyFinanceWorkbook(all.workbook,all.stats),{type:"array"});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets["Export Summary"]);
  const val=key=>rows.find(r=>r.Metric===key)?.Value;
  assert.equal(val("Actual ledger-estimated balance through export date (RM)"),1750);
  assert.equal(val("Selected-scope net cash movement through export date (RM)"),750);
  assert.equal(val("Future-dated finance records retained in export"),1);
  assert.equal(val("Total income (RM)"),1300);
  assert.equal(all.stats.records,3);
  const month=buildFinanceWorkbook({...props,scope:"month",month:"2026-11"});
  const monthSummary=XLSX.utils.sheet_to_json(month.workbook.Sheets["Export Summary"]);
  const mv=key=>monthSummary.find(r=>r.Metric===key)?.Value;
  assert.equal(mv("Actual ledger-estimated balance through export date (RM)"),1750);
  assert.equal(mv("Selected-scope net cash movement through export date (RM)"),750);
  assert.equal(month.stats.records,2);
});
