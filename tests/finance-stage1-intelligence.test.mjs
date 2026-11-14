import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  cents,forecastBudgetBurnRate,filterFinanceRecordsAdvanced,emptyAdvancedFilter,
  validateAdvancedFilter,validateSavedFilters,financeWrapped,simulateFinanceScenarios,addMonths
} from "../src/financeStage1Analytics.js";

const rows=[
  {id:"1",date:"2026-10-25",type:"income",amount:1200,category:"Salary",method:"BANK",note:"Salary"},
  {id:"2",date:"2026-10-29",type:"expense",amount:75,category:"Food",method:"TNG",note:"Lunch"},
  {id:"3",date:"2026-11-02",type:"income",amount:2000,category:"Salary",method:"BANK",note:"Work"},
  {id:"4",date:"2026-11-03",type:"expense",amount:20.55,category:"Food",method:"TNG",note:"Lunch"},
  {id:"5",date:"2026-11-12",type:"expense",amount:30.10,category:"Food",method:"CASH",note:"Lunch"},
  {id:"6",date:"2026-11-13",type:"expense",amount:100.20,category:"Transport",method:"BANK",note:"Fuel"},
  {id:"7",date:"2026-11-14",type:"expense",amount:1000,category:"Food",method:"BANK",note:"Deleted",deleted_at:"2026-11-14T12:00:00Z"},
  {id:"8",date:"2026-12-01",type:"expense",amount:99.99,category:"Food",method:"TNG",note:"Future"},
];
const file=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");

test("Stage1 RM cents reject missing precision and invalid analysis values",()=>{
  assert.equal(cents(24.55),2455);assert.equal(cents("100"),10000);
  assert.throws(()=>cents("2.345"),/Invalid/);
  assert.throws(()=>cents(Infinity));assert.throws(()=>cents("hello"));
});
test("Burn rate uses current natural month only, ignores transfers/deleted and uses last 7 days",()=>{
  const result=forecastBudgetBurnRate(rows,{Food:"600",Transport:"150",Empty:"0"},"2026-11","2026-11-15",["Food","Transport"]);
  assert.equal(result.elapsed,15);assert.equal(result.remainingDays,15);
  const food=result.rows.find(r=>r.category==="Food");
  assert.equal(food.spent,50.65);
  assert.equal(food.budget,600);
  assert.equal(food.recentDays,7);
  assert.equal(food.projectedMonth,101.3);
  assert.equal(food.projectedRecent,115.15);
  assert.equal(food.safeDaily,36.62);
  const transport=result.rows.find(r=>r.category==="Transport");
  assert.equal(transport.spent,100.2);
  assert.equal(transport.safeDaily,3.32);
  const history=forecastBudgetBurnRate(rows,{Food:"100"},"2026-10","2026-11-15");
  assert.equal(history.historical,true);assert.equal(history.rows.find(r=>r.category==="Food").projectedMonth,75);
  const future=forecastBudgetBurnRate(rows,{Food:"100"},"2027-01","2026-11-15");
  assert.equal(future.future,true);assert.equal(future.rows.find(r=>r.category==="Food").projectedMonth,null);
  assert.throws(()=>forecastBudgetBurnRate(rows,{Food:"2.234"},"2026-11","2026-11-15"));
});
test("Advanced filters support dates, type, multi-select, RM ranges and full global sorting",()=>{
  const f={...emptyAdvancedFilter(),from:"2026-11-01",to:"2026-11-30",type:"expense",
    categories:["Food","Transport"],methods:["TNG","BANK"],min:"20.00",max:"200",sort:"amountHigh"};
  assert.deepEqual(filterFinanceRecordsAdvanced(rows,f).map(r=>r.id),["6","4"]);
  const low=filterFinanceRecordsAdvanced(rows,{...f,sort:"amountLow"});
  assert.deepEqual(low.map(r=>r.id),["4","6"]);
  assert.deepEqual(filterFinanceRecordsAdvanced(rows,{...f,keyword:"fuel"}).map(r=>r.id),["6"]);
  assert.deepEqual(filterFinanceRecordsAdvanced(rows,{...f,methods:[]}).map(r=>r.id),["6","5","4"]);
  assert.throws(()=>validateAdvancedFilter({...f,from:"2026-02-29"}),/valid/);
  assert.throws(()=>validateAdvancedFilter({...f,min:"201",max:"200"}),/exceeds/);
  assert.throws(()=>validateAdvancedFilter({...f,sort:"drop"}),/Unsupported/);
});
test("Cloud saved search payload strictly validates id, bounded names and filter criteria",()=>{
  const f={id:"search-abcd-1234",name:"Work lunch",filters:emptyAdvancedFilter()};
  assert.deepEqual(validateSavedFilters([f])[0].filters,emptyAdvancedFilter());
  assert.throws(()=>validateSavedFilters([f,f]),/duplicate/);
  assert.throws(()=>validateSavedFilters(Array.from({length:21},(_,i)=>({...f,id:"search-"+String(i).padStart(8,"0")}))));
  assert.throws(()=>validateSavedFilters([{...f,name:"  "}]));
});
test("Wrapped respects monthly and arbitrary 3-month cross-year quarter and excludes recycled rows",()=>{
  const monthly=financeWrapped(rows,{mode:"monthly",month:"2026-11"});
  assert.equal(monthly.current.income,2000);assert.equal(monthly.current.expense,150.85);
  assert.equal(monthly.previous.income,1200);assert.equal(monthly.previous.expense,75);
  assert.equal(monthly.changes.expense,75.85);
  assert.equal(monthly.current.categories[0].name,"Transport");
  assert.equal(monthly.current.methods.find(x=>x.name==="CASH").value,30.1);
  const quarter=financeWrapped(rows,{mode:"quarterly",quarterStart:"2026-11"});
  assert.equal(quarter.first,"2026-11-01");assert.equal(quarter.last,"2027-01-31");
  assert.equal(quarter.current.expense,250.84);
  const year=financeWrapped(rows,{mode:"yearly",year:"2026"});
  assert.equal(year.current.expense,325.84);
  assert.equal(addMonths("2026-12",1),"2027-01");
  assert.throws(()=>financeWrapped(rows,{mode:"quarterly",quarterStart:"2026-13"}));
});
test("Wrapped budget coverage never reconstructs a missing historical snapshot",()=>{
 const budget=financeWrapped(rows,{mode:"quarterly",quarterStart:"2026-10",asOfDate:"2026-11-14",
   monthRows:[{month:"2026-10",category_budgets:{Food:"200"}},
              {month:"2026-11",category_budgets:{Food:"300",Transport:"120"}}],
   budgetTemplate:{Food:"9999"}});
 assert.equal(budget.budget.available,true);
 assert.equal(budget.budget.savedMonths,2);
 assert.equal(budget.budget.missingMonths,0);
 assert.equal(budget.budget.templateMonths,1);
 assert.equal(budget.budget.total,200+420+9999);
 assert.equal(budget.budget.spent,75+50.65+100.2+99.99);
 const old=financeWrapped(rows,{mode:"monthly",month:"2026-10",asOfDate:"2026-11-14",
   monthRows:[],budgetTemplate:{Food:"9999"}});
 assert.equal(old.budget.available,false);
 assert.equal(old.budget.missingMonths,1);
 assert.equal(old.budget.total,0);
});
test("Time Machine compares a 90-day baseline and hypothetical adjustments without writes",()=>{
  const snap=JSON.stringify(rows);
  const v=simulateFinanceScenarios(rows,{currentBalance:5000,asOfDate:"2026-11-14",months:6,
    incomeAdjustment:"300",expenseReduction:"200",extraExpense:"100"});
  assert.equal(v.startingBalance,5000);
  assert.equal(v.monthlyImprovement,400);
  assert.equal(v.finalDifference,2400);
  assert.equal(v.baseline.length,7);
  assert.equal(Math.round((v.scenario[6].balance-v.baseline[6].balance)*100),240000);
  assert.equal(JSON.stringify(rows),snap);
  assert.throws(()=>simulateFinanceScenarios(rows,{currentBalance:1,months:4}));
  assert.throws(()=>simulateFinanceScenarios(rows,{currentBalance:1,months:3,expenseReduction:"-1"}));
});
test("Stage1 UI is separate from transaction handlers and uses a test-only settings field",()=>{
  const app=file("App.jsx"),cloud=file("financeCloudService.js"),budget=file("FinanceBudgetPanel.jsx");
  for(const name of ["FinanceAdvancedFilters","FinanceAdvancedResults","FinanceWrapped","FinanceScenarioSimulator"])
    assert.ok(app.includes(name),name);
  assert.match(budget,/FinanceBudgetBurnRate/);
  assert.match(app,/queueSettingsField\("saved_filters", verified\)/);
  assert.match(cloud,/savings_goals,saved_filters/);
  assert.ok(app.includes("async function addRecord")&&app.includes("async function addTransfer"));
  assert.match(file("supabaseClient.js"),/SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby"/);
  const advanced=file("FinanceAdvancedResults.jsx");
  assert.match(advanced,/EditableCell/);assert.match(advanced,/FinanceMobileRecords/);
  assert.match(app,/\{!advancedFilter && <div className="mt-5 space-y-3">/);
});
