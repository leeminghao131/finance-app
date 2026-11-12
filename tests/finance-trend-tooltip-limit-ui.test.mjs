import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const app = read("App.jsx");
const summary = read("FinanceTrendSummaryTooltip.jsx");

test("Dashboard spending hover only shows date and aggregate expense, not record rows", () => {
  assert.match(app, /<Tooltip content=\{<FinanceTrendSummaryTooltip kind="expense" \/>\} \/>/);
  assert.match(summary, /row\.dateKey/);
  assert.match(summary, /: row\.expense/);
  assert.doesNotMatch(summary, /\.filter\(|\.map\(/);
  assert.doesNotMatch(summary, /record\.category|record\.note|recordMethod\(/);
});

test("Dashboard balance hover shows one daily balance without threshold comparison", () => {
  assert.match(app, /<Tooltip content=\{<FinanceTrendSummaryTooltip kind="balance" \/>\} \/>/);
  assert.match(summary, /row\.balanceGreen \?\? row\.balanceRed/);
  assert.match(summary, /kind === "balance" \? "Balance" : "Expense"/);
  assert.doesNotMatch(summary, /Balance >|Balance ≤|RM1500/);
});

test("Balance legend uses the current Balance Alert Limit, chart colors remain linked to it", () => {
  assert.match(app, /balanceAlertLimitLabel = "RM" \+ Number\(balanceLimit \|\| 1500\)/);
  assert.match(app, /name=\{\`Balance > \$\{balanceAlertLimitLabel\}\`\}/);
  assert.match(app, /name=\{\`Balance ≤ \$\{balanceAlertLimitLabel\}\`\}/);
  assert.doesNotMatch(app, /name="Balance > RM1500"/);
  assert.doesNotMatch(app, /name="Balance ≤ RM1500"/);
  assert.match(app, /const limit = Number\(balanceLimit \|\| 1500\)/);
  assert.match(app, /balanceGreen: balance > limit \? balance : null, balanceRed: balance <= limit \? balance : null/);
  assert.match(app, /stroke="#22c55e"/);
  assert.match(app, /stroke="#ef4444"/);
});

test("Detailed record hover remains available for a future large-chart UI, but not active on the small chart", () => {
  assert.match(app, /function TrendTooltip\(/);
  assert.doesNotMatch(app, /content=\{<TrendTooltip records=/);
});
