import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compareFinanceMonths,mostUsedNotes,validateSavingsGoals,savingsGoalProgress} from "../src/financePlanning.js";

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
test("feature wiring remains outside filtered controls and leaves CRUD untouched",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const cloud=readFileSync(new URL("../src/financeCloudService.js",import.meta.url),"utf8");
 const before=app.indexOf("<FinanceMonthComparison records={records}");
 const filtered=app.indexOf('title="Filtered Balance"');
 assert.ok(before>0&&filtered>before);
 assert.match(app,/<FinanceSavingsGoals goals=\{savingsGoals\}/);
 assert.match(app,/<FinanceQuickNotes records=\{records\} type=\{form.type\} category=\{form.category\}/);
 assert.match(cloud,/opening_balances,savings_goals/);
 assert.match(app,/queueSettingsField\("savings_goals", verified\)/);
});
