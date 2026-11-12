import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compareFinanceMonths,mostUsedNotes,validateSavingsGoals,savingsGoalProgress,calculateSavingsAvailable} from "../src/financePlanning.js";

const records=[
  {id:1,date:"2026-10-05",type:"income",amount:1000,category:"Salary",note:"Monthly salary"},
  {id:2,date:"2026-10-12",type:"expense",amount:25.45,category:"饮食",note:"Lunch"},
  {id:3,date:"2026-11-01",type:"income",amount:800,category:"Salary",note:"Monthly salary"},
  {id:4,date:"2026-11-02",type:"expense",amount:50.20,category:"饮食",note:"Lunch"},
  {id:5,date:"2026-11-03",type:"expense",amount:10,category:"交通",note:"Fuel"},
  {id:6,date:"2026-11-05",type:"expense",amount:1000,category:"饮食",note:"Deleted",deleted_at:"2026-11-06T00:00:00Z"},
];
test("compare any chosen months, never count deleted records or transfers",()=>{
 const actual=compareFinanceMonths(records,"2026-10","2026-11");
 assert.equal(actual.first.income,1000);
 assert.equal(actual.second.income,800);
 assert.equal(actual.first.expense,25.45);
 assert.equal(actual.second.expense,60.2);
 assert.equal(actual.changes.expense,34.75);
 assert.equal(actual.changes.net,-234.75);
 assert.equal(actual.second.count,3);
 assert.deepEqual(actual.categories.map(c=>c.category),["饮食","交通"]);
 assert.equal(compareFinanceMonths(records,"2026-11","2026-10").changes.expense,-34.75);
 assert.deepEqual(compareFinanceMonths(records,"2027-12","2026-11").first.categories,{});
 assert.throws(()=>compareFinanceMonths(records,"2026-13","2026-11"));
});
test("top seven category notes strictly by type/category, no deleted notes",()=>{
 const many=Array.from({length:10},(_,i)=>({type:"expense",category:"饮食",note:"N"+i,date:"2026-11-01"}));
 const notes=[...many,...records,
  {type:"expense",category:"饮食",note:"Lunch",date:"2026-11-09"},
  {type:"expense",category:"饮食",note:"   Lunch  ",date:"2026-11-10"},
  {type:"income",category:"饮食",note:"Wrong type",date:"2026-11-11"},
  {type:"expense",category:"交通",note:"Wrong category",date:"2026-11-11"}];
 const result=mostUsedNotes(notes,"expense","饮食");
 assert.equal(result.length,7);
 assert.deepEqual(result[0],{note:"Lunch",count:4});
 assert.equal(result.some(r=>r.note==="Deleted"),false);
 assert.equal(result.some(r=>r.note==="Wrong category"),false);
 assert.deepEqual(mostUsedNotes([],"expense","饮食"),[]);
});
test("savings goal validates RM precision, target, date and unique IDs",()=>{
 const a={id:"goal-abcd1234",title:"Travel",target:"5000",saved:"245.55",deadline:"2027-01-20"};
 const v=validateSavingsGoals([a]);
 assert.equal(v[0].target,5000);assert.equal(v[0].saved,245.55);
 assert.equal(savingsGoalProgress(v[0]).remaining,4754.45);
 assert.equal(savingsGoalProgress(v[0]).percent,4.91);
 assert.deepEqual(savingsGoalProgress({...a,saved:"5001"}).completed,true);
 assert.throws(()=>validateSavingsGoals([a,a]),/duplicate/);
 assert.throws(()=>validateSavingsGoals([{...a,target:"0"}]));
 assert.throws(()=>validateSavingsGoals([{...a,saved:"10.555"}]));
 assert.throws(()=>validateSavingsGoals([{...a,deadline:"2026-02-29"}]));
 assert.throws(()=>validateSavingsGoals([{...a,title:"   "}]));
});

test("Savings Goals reserve the current monthly budget exactly once with RM cent precision",()=>{
 const estimate=calculateSavingsAvailable(4461.98,{饮食:"600",交通:"300",娱乐:"200",美容:"150",住房:""});
 assert.deepEqual(estimate,{
  totalBalance:4461.98,monthlyBudget:1250,available:3211.98,
  shortfall:0,netAfterBudget:3211.98,
 });
 const short=calculateSavingsAvailable(100,{food:"200"});
 assert.equal(short.available,0);
 assert.equal(short.shortfall,100);
 assert.equal(short.netAfterBudget,-100);
 assert.equal(calculateSavingsAvailable(-50,{food:""}).shortfall,50);
 assert.equal(calculateSavingsAvailable(100.01,{a:"0.01",b:"0.02"}).available,99.98);
 assert.throws(()=>calculateSavingsAvailable(100,{food:"2.333"}),/Invalid monthly budget/);
 assert.throws(()=>calculateSavingsAvailable(100,{food:"-1"}));
 assert.throws(()=>calculateSavingsAvailable(Infinity,{food:"10"}));
 const firstGoal={id:"goal-abcd1234",title:"Travel",target:5000,saved:3000,deadline:""};
 const progress=savingsGoalProgress({...firstGoal,saved:estimate.available});
 assert.equal(progress.remaining,1788.02);
 assert.equal(progress.percent,64.24);
 assert.equal(firstGoal.saved,3000,"legacy stored data remains untouched");
});
test("four requested UI changes are placed correctly and never overwrite ledger flows",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const cloud=readFileSync(new URL("../src/financeCloudService.js",import.meta.url),"utf8");
 const quick=readFileSync(new URL("../src/FinanceQuickNotes.jsx",import.meta.url),"utf8");
 const goalUI=readFileSync(new URL("../src/FinanceSavingsGoals.jsx",import.meta.url),"utf8");
 const opening=readFileSync(new URL("../src/FinanceOpeningBalancePanel.jsx",import.meta.url),"utf8");
 const comparison=app.indexOf("<FinanceMonthComparison records={records}");
 const savings=app.indexOf("<FinanceSavingsGoals goals={savingsGoals}");
 const filtered=app.indexOf('title="Filtered Balance"');
 const recordOverlay=app.indexOf('<FinanceOverlay open={recordsOpen}');
 const footer=app.indexOf("<footer");
 assert.ok(comparison>recordOverlay&&comparison<footer,"comparison moved to the end");
 assert.ok(savings>filtered&&savings<footer,"goals moved to the end");
 assert.match(app,/openingBalanceControl=\{<FinanceOpeningBalancePanel/);
 assert.match(app,/\{openingBalanceControl\}/);
 assert.ok(!app.includes('<FinanceOpeningBalancePanel methods='),"no standalone opening control");
 assert.match(opening,/🏦 Opening Balance/);
 assert.ok(quick.includes("mostUsedNotes(records, type, category, 7)"));
 assert.match(quick,/overflow-x-auto/);
 assert.ok(!quick.includes("FinanceOverlay"),"Quick Add remains inline");
 assert.ok(!app.includes("quickNotesOpen"),"no popup state");
 assert.match(app,/<FinanceQuickNotes records=\{records\} type=\{form.type\} category=\{form.category\}/);
 assert.match(app,/calculateSavingsAvailable\(totalBalance, savingsBudgetCategories\)/);
 assert.match(app,/monthRows.find\(row => row.month === savingsBudgetMonth\)/);
 assert.match(goalUI,/savingsGoalProgress\(\{\.\.\.g,saved:available\}\)/);
 assert.match(goalUI,/Saved amount \(auto\)/);
 assert.ok(!goalUI.includes('value={draft.saved}'),"Saved Amount is not manually edited");
 assert.match(cloud,/opening_balances,savings_goals/);
 assert.match(app,/queueSettingsField\("savings_goals", verified\)/);
});
