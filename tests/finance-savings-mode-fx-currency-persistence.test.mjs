import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateSavingsGoals,calculateAutomaticGoalSaved,savingsGoalProgress} from "../src/financePlanning.js";
import {readFxCurrencyPreference,writeFxCurrencyPreference,FX_CURRENCY_PREFERENCE_PREFIX} from "../src/financeFxCurrencyPreference.js";
import {buildFinanceWorkbook,verifyFinanceWorkbook} from "../src/financeExcel.js";
import * as XLSX from "xlsx";

const source=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const base={id:"goal-legacy-ab12",title:"Chengdu travel",target:5000,saved:6000,deadline:"2027-12-05"};
function memoryStorage(){
  const data=new Map();
  return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
}

test("legacy savings goals preserve their exact stored amount and object schema until edited",()=>{
  assert.deepEqual(validateSavingsGoals([base]),[base]);
  const progress=savingsGoalProgress(base);
  assert.equal(progress.saved,6000);
  assert.equal(progress.percent,120);
  assert.equal(progress.completed,true);
  const manual={...base,saved:450,savedMode:"manual",budgetMultiplier:2.5};
  assert.deepEqual(validateSavingsGoals([manual]),[manual]);
  assert.equal(savingsGoalProgress(manual,{totalBalance:9000,monthlyBudgetTotal:1000}).saved,450);
});

test("auto-mode goal uses total balance minus full MONTHLY budget multiplied by X",()=>{
  const goal={...base,savedMode:"auto",budgetMultiplier:2};
  const before=JSON.stringify(goal);
  const result=savingsGoalProgress(goal,{totalBalance:8486.60,monthlyBudgetTotal:1800});
  assert.equal(result.saved,4886.6);
  assert.equal(result.completed,false);
  assert.equal(result.remaining,113.4);
  assert.equal(result.percent,97.73);
  assert.equal(goal.saved,6000,"legacy saved manual amount must remain in cloud JSON");
  assert.equal(JSON.stringify(goal),before,"progress calculation must not mutate settings");
  const updated=savingsGoalProgress(goal,{totalBalance:9600,monthlyBudgetTotal:1800});
  assert.equal(updated.saved,6000);
  assert.equal(updated.completed,true);
  assert.equal(calculateAutomaticGoalSaved(100,500,2),0,"never show negative saved progress");
  assert.equal(calculateAutomaticGoalSaved(30.04,10.01,2.5),5.01,"precise half-sen rounding");
});

test("X accepts safe decimal multipliers and rejects unsafe/ambiguous values",()=>{
  for(const invalid of ["-1","121","1.234","1e2","Infinity"," ",null]){
    const g={...base,savedMode:"auto",budgetMultiplier:invalid};
    assert.throws(()=>validateSavingsGoals([g]),undefined,"invalid X="+invalid);
  }
  assert.throws(()=>validateSavingsGoals([{...base,savedMode:"estimated"}]),/mode/);
  assert.deepEqual(validateSavingsGoals([{...base,savedMode:"auto",budgetMultiplier:"1.25"}])[0].budgetMultiplier,1.25);
  assert.equal(calculateAutomaticGoalSaved(999,500,0),999);
  assert.throws(()=>calculateAutomaticGoalSaved(NaN,500,1),/cannot be calculated/);
  assert.throws(()=>savingsGoalProgress({...base,savedMode:"auto",budgetMultiplier:1}),/cannot be calculated/);
});

test("selected FX currency is saved in local browser per owner; never shares draft/rate or across users",()=>{
  const store=memoryStorage();
  const accountA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const accountB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(readFxCurrencyPreference(accountA,store),"MYR");
  assert.equal(writeFxCurrencyPreference(accountA,"USD",store),true);
  assert.equal(readFxCurrencyPreference(accountA,store),"USD");
  assert.equal(readFxCurrencyPreference(accountB,store),"MYR");
  assert.equal(writeFxCurrencyPreference(accountB,"JPY",store),true);
  assert.equal(readFxCurrencyPreference(accountA,store),"USD");
  assert.equal(readFxCurrencyPreference(accountB,store),"JPY");
  assert.equal(writeFxCurrencyPreference(accountA,"MYR",store),true);
  assert.equal(readFxCurrencyPreference(accountA,store),"MYR");
  assert.deepEqual([...store.data.keys()].sort(),[
    FX_CURRENCY_PREFERENCE_PREFIX+accountA,FX_CURRENCY_PREFERENCE_PREFIX+accountB
  ].sort());
  assert.ok([...store.data.values()].every(v=>/^[A-Z]{3}$/.test(v)));
  assert.equal(writeFxCurrencyPreference(accountA,"USD",null),false);
  assert.equal(readFxCurrencyPreference(accountA,{getItem(){throw Error("blocked");}}),"MYR");
  assert.equal(writeFxCurrencyPreference(accountA,"USD",{setItem(){throw Error("blocked");}}),false);
  assert.equal(writeFxCurrencyPreference("", "USD",store),false);
  assert.equal(writeFxCurrencyPreference(accountA,"=DANGER",store),false);
});

test("entry form restores currency on login, persists only direct currency selection, and keeps it after save",()=>{
  const app=source("App.jsx");
  const currency=source("FinanceCurrencyInput.jsx");
  assert.match(app,/setFxCurrency\(readFxCurrencyPreference\(user\?\.id,localStorage\)\)/);
  assert.match(app,/onCurrency=\{code=>\{setFxCurrency\(code\);setFxQuote\(null\);setFxForeignAmount\(""\);writeFxCurrencyPreference\(user\?\.id,code,localStorage\);\}\}/);
  const save=app.slice(app.indexOf("async function addRecord("),app.indexOf("async function addRecord(")+4200);
  assert.match(save,/setFxForeignAmount\(""\)/);
  assert.doesNotMatch(save,/setFxCurrency\("MYR"\)/);
  assert.doesNotMatch(save,/writeFxCurrencyPreference/);
  assert.match(currency,/useEffect\(\(\)=>\{/);
  assert.match(currency,/getReferenceFxRate\(currency,date,fetch,ctrl.signal\)/);
  assert.match(currency,/onQuote\(null\)/);
});

test("Savings Goal UI exposes BOTH modes and account settings store mode, not the computed figure",()=>{
  const ui=source("FinanceSavingsGoals.jsx"),app=source("App.jsx");
  assert.match(ui,/name="savingsMode" value="manual"/);
  assert.match(ui,/name="savingsMode" value="auto"/);
  assert.match(ui,/type="number" min="0" max="120" step="0.01"/);
  assert.match(ui,/savingsGoalProgress\(g,autoContext\)/);
  assert.match(ui,/calculateAutomaticGoalSaved\(overallBalance,fullMonthBudget,draft.budgetMultiplier\)/);
  assert.match(ui,/saved:draft.saved,deadline:draft.deadline/);
  assert.match(ui,/savedMode:draft.savedMode,budgetMultiplier:draft.budgetMultiplier/);
  assert.match(app,/queueSettingsField\("savings_goals", verified\)/);
  assert.doesNotMatch(source("financePlanning.js"),/\.from\("records"\)|\.update\(|\.insert\(/);
});

test("Excel includes saved-mode and X, retaining the unchanged stored manual amount",()=>{
  const g={...base,savedMode:"auto",budgetMultiplier:2};
  const {workbook,stats}=buildFinanceWorkbook({savingsGoals:[g]});
  const row=XLSX.utils.sheet_to_json(workbook.Sheets["Savings Goals"],{defval:""})[0];
  assert.equal(row["Saved (RM)"],6000);
  assert.equal(row["Saved Mode"],"Auto (live estimate)");
  assert.equal(row["Budget Multiplier (X)"],2);
  const json=XLSX.utils.sheet_to_json(workbook.Sheets["Cloud Settings JSON"],{defval:""})
    .filter(x=>x.Setting==="savings_goals").map(x=>x["JSON fragment (remove json: prefix and concatenate)"].slice(5)).join("");
  assert.deepEqual(JSON.parse(json),[g]);
  assert.ok(verifyFinanceWorkbook(workbook,stats).byteLength>100);
});

test("assistant uses the same live auto saved progress and never reports stale manual saved as auto",async()=>{
  const {answerFinanceQuestion}=await import("../src/financeAssistantRules.js");
  const {localMonthMY}=await import("../src/financeCalendar.js");
  const g={...base,saved:50,savedMode:"auto",budgetMultiplier:2};
  const result=answerFinanceQuestion("储蓄目标",{
    ready:true,records:[],totalBalance:8000,goals:[g],
    monthRows:[{month:localMonthMY(),category_budgets:{Food:1000}}],
    budgets:{Food:1000},methods:[],
  },true);
  assert.match(result.answer,/RM6000\.00/);
  assert.doesNotMatch(result.answer,/RM50\.00/);
  assert.equal(g.saved,50,"assistant never rewrites saved manual balance");
});
