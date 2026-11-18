import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {readFileSync} from "node:fs";
import {calculateSavingsAvailable,savingsGoalProgress} from "../src/financePlanning.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";

const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const rows=(wb,name)=>XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:""});

test("PR52: every savings goal uses its own saved amount, not one shared available balance",()=>{
  const first={id:"goal-000001",title:"Travel",target:2000,saved:500,deadline:""};
  const second={id:"goal-000002",title:"PC",target:3000,saved:1200,deadline:""};
  assert.equal(savingsGoalProgress(first).percent,25);
  assert.equal(savingsGoalProgress(second).percent,40);
  assert.equal(savingsGoalProgress(first).completed,false);
  const ui=read("FinanceSavingsGoals.jsx");
  assert.match(ui,/savingsGoalProgress\(g,autoContext\)/);
  assert.match(ui,/value=\{draft\.saved\}/);
  assert.match(ui,/does not create an Income or Transfer/);
  assert.doesNotMatch(ui,/savingsGoalProgress\(\{\.\.\.g,saved:available\}\)/);
});

test("PR52: shared savings reserves only the unspent category budget, never expenses twice",()=>{
  const planned={Food:"600",Transport:"300",Other:""};
  const spent=[{type:"expense",category:"Food",amount:100},{type:"expense",category:"Transport",amount:25.45}];
  // The RM4,000 current balance already includes both recorded expenses.
  const result=calculateSavingsAvailable(4000,planned,spent);
  assert.equal(result.monthlyBudgetTotal,900);
  assert.equal(result.spentAgainstBudget,125.45);
  assert.equal(result.monthlyBudget,774.55);
  assert.equal(result.available,3225.45);
  assert.deepEqual(calculateSavingsAvailable(100,{Food:"50"},[{type:"expense",category:"Food",amount:75}]).monthlyBudget,0);
  assert.equal(calculateSavingsAvailable(-10,{Food:"0"},[]).shortfall,10);
  assert.throws(()=>calculateSavingsAvailable(10,{Food:"1"},[{type:"expense",category:"Food",amount:Infinity}]),/Invalid/);
  assert.throws(()=>calculateSavingsAvailable(10,{Food:"1"},null),/not verified/);
  // Supplied budgets and records are never rewritten.
  assert.equal(planned.Food,"600");assert.equal(spent[0].amount,100);
});

test("PR52: workbook includes all additional cloud settings, planning fields and activity links",()=>{
  const source={
    records:[{id:1,type:"expense",amount:9.5,date:"2026-11-18",category:"Food",method:"TNG",note:"Test"}],
    savingsGoals:[{id:"goal-000001",title:"=HYPERLINK(1)",target:2000,saved:500,deadline:""}],
    recurringBills:[{id:"bill-00001",title:"Rent",amount:1500,category:"Housing",method:"BANK",cycle:"monthly",anchorDate:"2026-11-01",leadDays:3,active:true,occurrences:[{due:"2026-11-01",status:"paid",recordId:"1"}]}],
    activities:[{id:"act-00001",userId:"fake-owner",title:"Trip",budget:500,status:"active",startedOn:"2026-11-01",endedOn:null,version:1}],
    activityLinks:[{id:"link-0001",userId:"fake-owner",activityId:"act-00001",recordId:"1",removedAt:null,version:1}],
    reviewState:{threshold:500,enabled:{large:true},decisions:[{recordId:"1",fingerprint:"abc",checkedAt:"2026-11-18"}]},
    accountChecks:[{id:"check-001",method:"BANK",date:"2026-11-18",actual:100,ledger:99.5,difference:0.5,note:"verify"}],
    savedFilters:[{id:"filter-001",name:"Food",filters:{categories:["Food"]}}],
    customOptions:{expenseCategories:["Food"],incomeMethods:["BANK"]},
  };
  const frozen=JSON.stringify(source);
  const {workbook,stats}=buildFinanceWorkbook(source);
  for(const name of ["Cloud Settings JSON","Savings Goals","Recurring Bills","Activities","Activity Links",
    "Review Decisions","Account Checks","Saved Filters","Custom Options"])
    assert.ok(workbook.SheetNames.includes(name),name);
  assert.equal(rows(workbook,"Savings Goals")[0]["Saved (RM)"],500);
  assert.equal(rows(workbook,"Savings Goals")[0]["Goal Name"][0],"'");
  assert.equal(rows(workbook,"Recurring Bills").length,1);
  assert.equal(rows(workbook,"Activity Links").length,1);
  assert.equal(stats.savingsGoals,1);assert.equal(stats.activityLinks,1);
  const encoded=rows(workbook,"Cloud Settings JSON");
  const recover=key=>JSON.parse(encoded.filter(r=>r.Setting===key).sort((a,b)=>a.Part-b.Part)
    .map(r=>r["JSON fragment (remove json: prefix and concatenate)"].slice(5)).join(""));
  for(const [key,field] of [["savings_goals","savingsGoals"],["recurring_bills","recurringBills"],
    ["review_state","reviewState"],["account_checks","accountChecks"],["saved_filters","savedFilters"],
    ["custom_options","customOptions"],["activities","activities"],["activity_links","activityLinks"]])
    assert.deepEqual(recover(key),source[field]);
  verifyFinanceWorkbook(workbook,stats);
  assert.equal(JSON.stringify(source),frozen,"never mutate exported data");
});

test("PR52: exported settings larger than a single Excel cell remain lossless and inert",()=>{
  const payload="=SAFE?"+("中文🧾Test".repeat(7000));
  const {workbook,stats}=buildFinanceWorkbook({reviewState:{threshold:500,note:payload}});
  const items=rows(workbook,"Cloud Settings JSON").filter(row=>row.Setting==="review_state");
  assert.ok(items.length>1);
  const joined=items.sort((a,b)=>a.Part-b.Part)
    .map(row=>{assert.ok(row["JSON fragment (remove json: prefix and concatenate)"].startsWith("json:"));return row["JSON fragment (remove json: prefix and concatenate)"].slice(5);}).join("");
  assert.equal(JSON.parse(joined).note,payload);
  verifyFinanceWorkbook(workbook,stats);
});

test("PR52: current balances exclude future-dated records but report historical periods unmodified",()=>{
  const app=read("App.jsx");
  assert.match(app,/const income = sumType\(records\.filter\(row => row\.date <= localToday\), "income"\)/);
  assert.match(app,/const expense = sumType\(records\.filter\(row => row\.date <= localToday\), "expense"\)/);
  assert.match(app,/const currentTransfers = useMemo\(\(\) => transfers\.filter\(row => row\.date <= localToday\)/);
  assert.match(app,/const earlier = firstDate \? records\.filter\(row => row\.date < firstDate\)/);
  assert.match(app,/if \(date > localToday\) return/);
  assert.match(app,/calculateSavingsAvailable\(totalBalance, savingsBudgetCategories, currentMonthExpenses\)/);
  assert.doesNotMatch(app,/delete nextBudgets\[value\]/);
});

test("PR52: failed automatic budget changes cannot appear as verified, and offer an explicit retry",()=>{
  const app=read("App.jsx");
  assert.match(app,/pendingBudgetTemplateRef\.current = next/);
  assert.match(app,/setBudgetTemplateSaveStatus\("pending"\)/);
  assert.match(app,/setBudgetTemplateSaveStatus\("failed"\)/);
  assert.match(app,/setBudgetTemplateSaveStatus\("saved"\)/);
  assert.match(app,/saveBudgets\(draft\)/);
  assert.match(app,/budgetTemplateSaveStatus !== "saved"/);
  assert.match(app,/JSON\.stringify\(budgetsRef\.current\)!==JSON\.stringify\(pendingBudgetBaselineRef\.current\)/);
});


test("PR52: financial UI explanations translate while saved keys and values remain untouched",async()=>{
  const {translateFinanceText}=await import("../src/financeLanguage.js");
  for(const [en,zh] of [
    ["Through today","截至今天"],["Today Net","今日净收支"],
    ["Saved towards this goal (RM)","此目标已存金额（RM）"],
    ["Entire period income (comparison baseline)","同期全部收入（比较基准）"],
    ["Expense in selected category","所选分类支出"],
  ]) {
    assert.equal(translateFinanceText(en,"zh"),zh);
    assert.equal(translateFinanceText(zh,"en"),en);
  }
  assert.equal(translateFinanceText("私人类别","en"),"私人类别");
});

test("PR52: full synced snapshot still demands two count-verified passes per owned table",()=>{
  const cloud=read("financeCloudService.js"),pagination=read("financeData.js");
  assert.match(cloud,/\[recordRows,transferRows,activityRows,linkRows\] = await Promise\.all\(/);
  for(const name of ["records","transfers","finance_activities","finance_activity_links"])
    assert.match(cloud,new RegExp('loadEveryOwnedRow\\(client,"'+name+'"'));
  assert.match(cloud,/validateFinanceSnapshotRows\(recordRows,transferRows,settingsRow\)/);
  assert.match(pagination,/const first = await readPass\(\)/);
  assert.match(pagination,/const second = await readPass\(\)/);
  assert.match(pagination,/JSON\.stringify\(row\) === JSON\.stringify\(second\[index\]\)/);
});
