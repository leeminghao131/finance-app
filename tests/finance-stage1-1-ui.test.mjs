import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {simulateFinanceScenarios,forecastBudgetBurnRate} from "../src/financeStage1Analytics.js";

const file=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const record={id:"fake",type:"expense",date:"2026-11-10",category:"饮食",method:"TNG",note:"test",amount:120};

test("Stage 1.1 left drawer replaces only its former in-flow toolbar",()=>{
  const app=file("App.jsx"),dock=file("FinanceInsightsDock.jsx");
  assert.match(app,/<FinanceInsightsDock/);
  assert.ok(!app.includes('aria-label="Finance Intelligence Tools"'));
  assert.ok(dock.includes("FinanceWrapped")&&dock.includes("FinanceScenarioSimulator"));
  assert.match(dock,/data-expanded=\{expanded\?"true":"false"\}/);
  assert.match(dock,/setExpanded\(p=>!p\)/);
  assert.match(dock,/aria-expanded=\{expanded\}/);
  assert.ok(dock.includes("useFinanceLanguage"));
  assert.match(file("FinanceWrapped.jsx"),/dockButton=false/);
  assert.match(file("FinanceScenarioSimulator.jsx"),/dockButton=false/);
});
test("Stage 1.1 left tool drawer animates smoothly without pushing dashboard cards",()=>{
  const css=file("financeUi.css");
  assert.match(css,/\.mh-insights-dock \{/);
  assert.match(css,/position: fixed/);
  assert.match(css,/transform: translate3d\(calc\(-100% \+ 34px\), -50%, 0\)/);
  assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.mh-insights-dock__outside/);
});
test("Budget Forecast has explicit bilingual captions and a compact risk summary",()=>{
  const forecast=file("FinanceBudgetBurnRate.jsx");
  const panel=file("FinanceBudgetPanel.jsx");
  assert.ok(forecast.includes("useFinanceLanguage"));
  assert.ok(forecast.includes('t("本月消费速度预测","Monthly spending forecast")'));
  assert.ok(forecast.includes('t("预算","Budget")'));
  assert.ok(forecast.includes('t("已支出","Spent")'));
  assert.ok(forecast.includes('t("预计月底","Projected month-end")'));
  assert.ok(forecast.includes('t("可能超支","Possible overspend")'));
  assert.ok(forecast.includes('t("剩余每日建议","Daily remaining allowance")'));
  assert.ok(forecast.includes('t("预计超支合计","Projected overspend")'));
  assert.ok(forecast.includes("builtInFinanceCategory"));
  assert.ok(panel.includes('language==="zh"?"消费速度预测":"Burn Rate Forecast"'));
  assert.ok(!panel.includes("Burn Rate Forecast / 预算预测"));
});
test("Simulator UI explains results directly but preserves original scenario calculations and device presets",()=>{
  const s=file("FinanceScenarioSimulator.jsx");
  assert.ok(s.includes("useFinanceLanguage"));
  assert.ok(s.includes("simulateFinanceScenarios(records"));
  assert.ok(s.includes("mh-stage1-scenarios:"));
  assert.ok(s.includes('t("现在的总余额","Balance today")'));
  assert.ok(s.includes('t("两种情况相差","Difference between the two plans")'));
  assert.ok(s.includes("baselineEnd")&&s.includes("scenarioEnd"));
  assert.ok(s.includes("comparisonData")&&s.includes("ResponsiveContainer"));
  assert.ok(s.includes("needed=money(Math.ceil(target/Number(form.months))/100)"));
  assert.ok(!s.includes("Added difference at the end"));
  assert.ok(!s.includes("Reverse goal planning / 反向目标规划"));
  assert.ok(!s.includes("Scenario presets · saved on this device only"));
});
test("Stage 1.1 formatting does not alter the read-only forecast and what-if numerical contract",()=>{
  const rows=[record];
  const forecast=forecastBudgetBurnRate(rows,{饮食:300},"2026-11","2026-11-15");
  assert.equal(forecast.rows.find(x=>x.category==="饮食").spent,120);
  assert.equal(forecast.rows.find(x=>x.category==="饮食").projectedMonth,240);
  const snapshot=JSON.stringify(rows);
  const result=simulateFinanceScenarios(rows,{
    currentBalance:500,asOfDate:"2026-11-15",months:6,incomeAdjustment:300,expenseReduction:200,extraExpense:100,
  });
  assert.equal(result.finalDifference,2400);
  assert.equal(result.scenario.length,7);
  assert.equal(JSON.stringify(rows),snapshot);
});
