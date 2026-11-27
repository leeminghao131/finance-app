import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateCashForecast} from "../src/financeInsights.js";
import {chartFields,chartViewport,chartLineSegments,chartNumber} from "../src/financeChartPlot.js";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const app=read("App.jsx");
const forecast=read("FinanceForecastPanel.jsx");
const native=read("FinanceNativeChart.jsx");
const heat=read("FinanceHeatmapDayDetails.jsx");
const heatCss=read("financeHeatmapDetails.css");
const method=read("FinanceMethodDonutChart.jsx");
const chartCss=read("financeNativeCharts.css");

test("forecast uses same native renderer as working ledger charts, without Recharts",()=>{
  assert.match(forecast,/import FinanceNativeChart from "\.\/FinanceNativeChart.jsx"/);
  assert.match(forecast,/<FinanceNativeChart/);
  assert.match(forecast,/rows=\{data.timeline\}/);
  assert.match(forecast,/kind="forecast"/);
  assert.doesNotMatch(forecast,/<ResponsiveContainer|<LineChart|from "recharts"/);
  assert.deepEqual(chartFields("forecast"),["actual","forecast"]);
  assert.match(native,/name:"Actual ledger"/);
  assert.match(native,/name:"Forecast \(not real\)"/);
  assert.ok(native.includes('strokeDasharray={kind==="forecast"&&field==="forecast"?"7 5":undefined}'));
});
test("projected income remains forecast-only and actual/future null are not converted into fake zero",()=>{
  const outcome=calculateCashForecast(
    [{type:"income",amount:500,date:"2026-11-12"},{type:"expense",amount:30,date:"2026-11-18"}],
    {asOfDate:"2026-11-20",selectedMonth:"2026-11",
      horizon:"monthEnd",trailingDays:30,
      plannedIncomes:[{id:"fictional",date:"2026-11-25",amount:250,note:"Test only"}],
      openingBalanceTotal:1000}
  );
  assert.equal(outcome.expectedIncome,250);
  assert.equal(outcome.currentBalance,1470);
  assert.equal(outcome.timeline.some(row=>row.actual!==null),true);
  assert.equal(outcome.timeline.some(row=>row.forecast!==null),true);
  const last=outcome.timeline.at(-1);
  assert.equal(last.actual,null,"future does not become real income or a real balance");
  assert.notEqual(last.forecast,null);
  assert.equal(outcome.timeline.at(-2).forecast!==null,true);
  assert.equal(chartNumber(null),null);
  const view=chartViewport(outcome.timeline,"forecast",590,260);
  assert.ok(chartLineSegments(outcome.timeline,"actual",view).length>1);
  assert.ok(chartLineSegments(outcome.timeline,"forecast",view).length>1);
  assert.equal(chartLineSegments(outcome.timeline,"actual",view).at(-1).row.date,"2026-11-20");
  assert.equal(chartLineSegments(outcome.timeline,"forecast",view).at(-1).row.date,"2026-11-30");
  assert.ok(view.y(outcome.currentBalance)>=view.margin.top);
});
test("heatmap still colors by filtered expense but shows selected date all actual income and expense",()=>{
  assert.match(app,/const heatmapDays = useMemo/);
  assert.match(app,/expenseRecords\.forEach/);
  assert.match(app,/<HeatmapCard days=\{heatmapDays\} label=\{filterLabel\} records=\{periodRecords\}/);
  assert.match(app,/onClick=\{event=>\{heatmapTriggerRef\.current=event\.currentTarget;[\s\S]*?setSelectedOwner\(ownerKey\);setSelectedDate\(d\.date\);\}\}/);
  assert.match(app,/aria-haspopup="dialog" aria-expanded=\{selectedDate===d\.date\}/);
  assert.match(app,/onClose=\{\(\)=>setSelectedDate\(null\)\}/);
  assert.match(app,/selectedDay\?\.amount\?\?0/);
  assert.match(heat,/const incomes=rows\.filter\(row=>row\.type==="income"\)/);
  assert.match(heat,/const expenses=rows\.filter\(row=>row\.type==="expense"\)/);
  assert.match(heat,/row\?\.date===date/);
  assert.match(heat,/row\.type==="income"\|\|row\.type==="expense"/);
  assert.match(heat,/!row\.deleted_at/);
  assert.match(heat,/dailyIncome-dailyExpense/);
  assert.match(heat,/builtInFinanceCategory\(row\.category,language\)/);
  assert.match(heat,/data-i18n-ignore>\{row\.note\}/);
  assert.doesNotMatch(heat,/supabase|\.insert\(|\.update\(|\.delete\(|fetch\(|localStorage|saveBudgets|loadCloudData|addRecord|updateRecord|deleteRecord/);
});
test("heatmap popup is a keyboard accessible floating modal, not a persistent dashboard card",()=>{
  assert.match(heat,/<FinanceOverlay open=\{open\}/);
  assert.match(heat,/triggerRef=\{triggerRef\} widthClass="max-w-3xl"/);
  assert.match(heat,/useFinanceLanguage\(\)/);
  assert.match(heatCss,/button\.mh-cosmic-heat__day:focus-visible/);
  assert.match(heatCss,/@media\(max-width:600px\)/);
  assert.match(heatCss,/\.mh-heat-detail__columns/);
  assert.match(heatCss,/\.mh-heat-detail__record-head/);
});
test("method ratio legend is dark, high contrast, and keeps accurate breakdown",()=>{
  assert.match(method,/mh-method-detail/);
  assert.match(method,/100 \* entry\.value \/ total/);
  assert.match(method,/money\(entry\.value\)/);
  assert.match(method,/data-i18n-ignore>\{entry\.name\}/);
  assert.match(chartCss,/\.mh-ui\.mh-cosmic-pilot \.mh-method-detail/);
  assert.match(chartCss,/background: linear-gradient\(145deg,#253e52/);
  assert.match(chartCss,/color: #f7efdf/);
  assert.match(chartCss,/\.mh-method-detail strong \{ color: #fff3dc/);
  assert.match(chartCss,/\.mh-method-detail p \{/);
});
