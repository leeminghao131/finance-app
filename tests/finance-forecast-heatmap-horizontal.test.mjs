import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = read("App.jsx");
const forecast = read("FinanceForecastPanel.jsx");

test("UI: forecast and heatmap each use a full-width row, retaining the Top 5 below", () => {
  const anchor = '<section className="grid items-start gap-4">';
  const start = app.indexOf(anchor);
  const end = app.indexOf("</section>", start);
  assert.ok(start >= 0 && end > start);
  const region = app.slice(start, end);
  const iForecast = region.indexOf("<FinanceForecastPanel");
  const iHeatmap = region.indexOf("<HeatmapCard");
  const iTop5 = region.indexOf("<TopExpensesCard");
  assert.ok(iForecast >= 0 && iForecast < iHeatmap && iHeatmap < iTop5);
  assert.doesNotMatch(region, /xl:grid-cols-\[/);
  assert.doesNotMatch(region, /xl:col-span-2/);
  assert.match(region, /setCategory=\{setTopExpenseCategory\}/);
});

test("UI: forecast details remain left of a separate responsive graph on wide screens", () => {
  assert.match(forecast, /grid items-start gap-5 xl:grid-cols-2/);
  const left = forecast.indexOf('className="grid grid-cols-2 gap-3"');
  const summary = forecast.indexOf('money(data.predictedBalance)');
  const right = forecast.indexOf('{!outcome.error && (');
  const chart = forecast.indexOf('<ResponsiveContainer width="100%" height="100%">');
  assert.ok(left >= 0 && left < summary && summary < right && right < chart);
  assert.match(forecast, /calculateCashForecast\(records,\{asOfDate,selectedMonth,horizon,trailingDays,plannedIncomes\}\)/);
  assert.match(forecast, /aria-label="Manage Expected Income"/);
  assert.match(forecast, /<FinanceOverlay open=\{incomePlannerOpen\}/);
  assert.match(forecast, /<Line isAnimationActive=\{false\} name="Actual ledger"/);
  assert.match(forecast, /<Line isAnimationActive=\{false\} name="Forecast"/);
});

test("UI: wider heatmap retains full amounts and unchanged Top 5 item layout", () => {
  const heatmap = app.slice(app.indexOf("function HeatmapCard("),app.indexOf("function TopExpensesCard("));
  assert.match(heatmap, /repeat\(auto-fit, minmax\(80px, 1fr\)\)/);
  assert.match(heatmap, /overflowWrap: "anywhere"/);
  assert.match(heatmap, /money\(d.amount\)/);
  const top = app.slice(app.indexOf("function TopExpensesCard("),app.indexOf("function TodaySummaryCard("));
  assert.match(top, /sm:grid-cols-2 xl:grid-cols-5/);
  assert.match(top, /records.map\(\(record, index\) =>/);
});
