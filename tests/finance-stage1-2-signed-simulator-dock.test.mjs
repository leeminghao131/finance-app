import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  simulateFinanceScenarios,normalizeFinanceScenarioPreset,
} from "../src/financeStage1Analytics.js";

const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const fakeRecords=[
  {id:"fake-inc",type:"income",date:"2026-11-04",amount:2500,category:"Salary",method:"BANK"},
  {id:"fake-exp",type:"expense",date:"2026-11-07",amount:90,category:"饮食",method:"TNG"}
];
const simulate=params=>simulateFinanceScenarios(fakeRecords,{
  currentBalance:4000,asOfDate:"2026-11-15",months:6,...params,
});

test("Stage 1.2: two signed sliders allow earning more / less and spending more / less",()=>{
  assert.equal(simulate({incomeDelta:300,spendingDelta:-200}).monthlyImprovement,500);
  assert.equal(simulate({incomeDelta:300,spendingDelta:-200}).finalDifference,3000);
  assert.equal(simulate({incomeDelta:-300,spendingDelta:200}).monthlyImprovement,-500);
  assert.equal(simulate({incomeDelta:-300,spendingDelta:200}).finalDifference,-3000);
  assert.equal(simulate({incomeDelta:-300,spendingDelta:-200}).monthlyImprovement,-100);
  assert.equal(simulate({incomeDelta:300,spendingDelta:200}).monthlyImprovement,100);
  assert.equal(simulate({incomeDelta:0,spendingDelta:0}).finalDifference,0);
  assert.equal(simulate({incomeDelta:"-12.34",spendingDelta:"9.99"}).monthlyImprovement,-22.33);
});
test("Stage 1.2: signed changes remain read-only, preserve historic baseline and MYR precision",()=>{
  const before=JSON.stringify(fakeRecords);
  const base=simulate({incomeDelta:0,spendingDelta:0});
  const more=simulate({incomeDelta:-400,spendingDelta:-100});
  assert.equal(more.finalDifference,-1800);
  assert.equal(more.baseline.at(-1).balance,base.baseline.at(-1).balance);
  assert.equal(Math.round((more.scenario.at(-1).balance-base.scenario.at(-1).balance)*100),-180000);
  assert.equal(JSON.stringify(fakeRecords),before);
  assert.throws(()=>simulate({incomeDelta:"0.001",spendingDelta:0}),/Invalid/);
  assert.throws(()=>simulate({incomeDelta:0,spendingDelta:"NaN"}),/Invalid/);
});
test("Stage 1.2: old three-field saved scenarios give exactly the same result after conversion",()=>{
  const legacy={id:"scenario-123",name:"Old plan",months:6,
    incomeAdjustment:"1150",expenseReduction:"300",extraExpense:"120.50"};
  const before=JSON.stringify(legacy);
  const normalized=normalizeFinanceScenarioPreset(legacy);
  assert.equal(normalized.id,legacy.id);
  assert.equal(normalized.name,legacy.name);
  assert.equal(normalized.months,6);
  assert.equal(normalized.incomeDelta,"1150");
  assert.equal(normalized.spendingDelta,"-179.5");
  assert.ok(!("incomeAdjustment" in normalized));
  assert.ok(!("expenseReduction" in normalized));
  assert.ok(!("extraExpense" in normalized));
  const oldResult=simulate(legacy),modernResult=simulate(normalized);
  assert.equal(oldResult.finalDifference,modernResult.finalDifference);
  assert.equal(oldResult.scenario.at(-1).balance,modernResult.scenario.at(-1).balance);
  assert.equal(JSON.stringify(legacy),before);
  assert.throws(()=>simulate({incomeAdjustment:0,expenseReduction:-10,extraExpense:0}),/nonnegative/);
});
test("Stage 1.2: new presets retain signed values and invalid presets are rejected",()=>{
  const current={id:"new-id",name:"My test",months:12,incomeDelta:"-30",spendingDelta:"25.25"};
  assert.deepEqual(normalizeFinanceScenarioPreset(current),current);
  assert.throws(()=>normalizeFinanceScenarioPreset({...current,incomeDelta:"1.222"}),/Invalid/);
  assert.throws(()=>normalizeFinanceScenarioPreset({...current,months:10}),/duration/);
});
test("Stage 1.2: no old three-input controls survive, signed sliders and labels are displayed",()=>{
  const component=src("FinanceScenarioSimulator.jsx");
  assert.match(component,/min="-2000" max="2000" step="50"/);
  assert.match(component,/incomeDelta/);
  assert.match(component,/spendingDelta/);
  assert.match(component,/normalizeFinanceScenarioPreset/);
  assert.match(component,/每月收入变化（RM）/);
  assert.match(component,/每月支出变化（RM）/);
  assert.match(component,/少赚/);
  assert.match(component,/多花/);
  assert.match(component,/少花/);
  assert.ok(!component.includes('inputCell("extraExpense"'));
  assert.ok(!component.includes('inputCell("expenseReduction"'));
  assert.match(component,/mh-stage1-scenarios:/);
  assert.match(component,/aria-label=\{label\+t\("滑块"," slider"\)\}/);
});
test("Stage 1.2: Month Comparison and Savings Goals are dock-only floating popups",()=>{
  const app=src("App.jsx"),dock=src("FinanceInsightsDock.jsx");
  assert.match(app,/<FinanceInsightsDock/);
  assert.match(dock,/<DockCardPopup title=\{zh\?"月度财务对比":"Month Comparison"\}/);
  assert.match(dock,/<DockCardPopup title=\{zh\?"储蓄目标":"Savings Goals"\}/);
  assert.match(dock,/<FinanceMonthComparison records=\{records\} asOfDate=\{asOfDate\}\/>/);
  assert.match(dock,/<FinanceSavingsGoals goals=\{goals\} onSave=\{onSaveSavingsGoals\}/);
  assert.match(dock,/savingsAvailability=\{savingsAvailability\}/);
  assert.match(dock,/calculationError=\{calculationError\}/);
  assert.match(dock,/budgetMonth=\{budgetMonth\}/);
  assert.match(dock,/<FinanceOverlay open=\{open\} title=\{title\}/);
  assert.match(dock,/triggerRef=\{triggerRef\}/);
  assert.ok(!app.includes("<FinanceMonthComparison"));
  assert.ok(!app.includes("<FinanceSavingsGoals"));
  assert.ok(!app.includes("grid gap-4 xl:grid-cols-2"));
  // Protected goal writes retain same owner version-guarded App callback.
  assert.match(app,/onSaveSavingsGoals=\{saveSavingsGoals\}/);
  // Components are unchanged: goal editor and category overlay still available.
  assert.match(src("FinanceSavingsGoals.jsx"),/async function submit/);
  assert.match(src("FinanceSavingsGoals.jsx"),/validateSavingsGoals\(next\)/);
  assert.match(src("FinanceMonthComparison.jsx"),/compareFinanceMonths\(records,firstMonth,secondMonth,asOfDate\)/);
});
