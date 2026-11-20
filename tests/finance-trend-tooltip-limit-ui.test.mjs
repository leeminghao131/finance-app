import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const app = read("App.jsx");
const summary = read("FinanceTrendSummaryTooltip.jsx");
const native=read("FinanceNativeChart.jsx");
const plot=read("financeChartPlot.js");

test("Dashboard spending hover only shows date and aggregate expense, not record rows", () => {
  assert.match(app, /<FinanceNativeChart rows=\{trendData\} kind="expense" compact/);
  assert.match(native, /if\(kind==="expense"\)return date\+" · Expense "\+money\(row.expense\)/);
  assert.doesNotMatch(native, /record\.category|record\.note|recordMethod\(/);
  assert.match(summary, /row\.dateKey/);
  assert.match(summary, /: row\.expense/);
  assert.doesNotMatch(summary, /\.filter\(|\.map\(/);
  assert.doesNotMatch(summary, /record\.category|record\.note|recordMethod\(/);
});

test("Dashboard balance hover shows one daily balance without threshold comparison", () => {
  assert.match(app, /<FinanceNativeChart rows=\{trendData\} kind="balance" alertLimit=\{balanceLimit\} compact/);
  assert.match(native, /const value=chartNumber\(row\?\.balanceGreen\)\?\?chartNumber\(row\?\.balanceRed\)/);
  assert.match(native, /" · Balance "\+money\(value\)/);
  assert.match(summary, /row\.balanceGreen \?\? row\.balanceRed/);
  assert.match(summary, /kind === "balance" \? "Balance" : "Expense"/);
  assert.doesNotMatch(summary, /Balance >|Balance ≤|RM1500/);
});

test("Balance legend uses the current Balance Alert Limit, chart colors remain linked to it", () => {
  assert.match(app, /balanceAlertLimitLabel = "RM" \+ Number\(balanceLimit \|\| 1500\)/);
  assert.match(native, /alertLimit=1500/);
  assert.match(native, /Number\(alertLimit\|\|1500\)\.toLocaleString/);
  assert.match(plot, /"balanceGreen", "balanceRed"/);
  assert.match(native, /name:"Balance > "\+alertLabel/);
  assert.match(native, /name:"Balance ≤ "\+alertLabel/);
  assert.doesNotMatch(app, /name="Balance > RM1500"/);
  assert.doesNotMatch(app, /name="Balance ≤ RM1500"/);
  assert.match(app, /const limit = Number\(balanceLimit \|\| 1500\)/);
  assert.match(app, /balanceGreen: balance > limit \? balance : null, balanceRed: balance <= limit \? balance : null/);
  assert.match(native, /GREEN="#34d399"/);
  assert.match(native, /RED="#fb8285"/);
});

test("Detailed record hover remains available for a future large-chart UI, but not active on the small chart", () => {
  assert.match(app, /function TrendTooltip\(/);
  assert.doesNotMatch(app, /content=\{<TrendTooltip records=/);
});
