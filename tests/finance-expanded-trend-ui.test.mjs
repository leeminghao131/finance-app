import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = read("App.jsx");
const overlay = read("FinanceExpandedTrendOverlay.jsx");
const native = read("FinanceNativeChart.jsx");
const geometry = read("financeChartPlot.js");

test("Expanded trends are opened from both existing small graphs and can be closed", () => {
  assert.match(app, /const \[expandedTrend, setExpandedTrend\] = useState\(null\)/);
  assert.match(app, /aria-label="Expand Spending Trend"/);
  assert.match(app, /onClick=\{\(\) => setExpandedTrend\("expense"\)\}/);
  assert.match(app, /aria-label="Expand Filtered Balance Trend"/);
  assert.match(app, /onClick=\{\(\) => setExpandedTrend\("balance"\)\}/);
  assert.match(app, /<FinanceExpandedTrendOverlay/);
  assert.match(app, /open=\{expandedTrend !== null\}/);
  assert.match(app, /onClose=\{\(\) => setExpandedTrend\(null\)\}/);
  assert.match(app, /data=\{trendData\}/);
  assert.match(app, /dailyData=\{expandedTrend === "balance" \? periodDailyData : dailyData\}/);
  assert.match(app, /records=\{expandedTrend === "balance" \? periodRecords : chartRecords\}/);
  assert.match(app, /alertLimit=\{balanceLimit\}/);
  assert.match(app, /category=\{activeExpenseCategory \|\| trendCategory\}/);
});

test("Expanded graph stays in a separate fixed overlay with desktop hover and mobile tap/date choice", () => {
  assert.match(overlay, /<FinanceOverlay open=\{open\}/);
  assert.match(overlay, /widthClass="max-w-7xl"/);
  assert.match(overlay, /lg:grid-cols-\[minmax\(0,1\.9fr\)_minmax\(260px,1fr\)\]/);
  assert.match(overlay, /onSelectDate=\{row => selectFromChart\(\{activePayload:\[\{payload:row\}\]\}\)\}/);
  assert.match(native, /onMouseEnter:\(\)=>choose\(index\)/);
  assert.match(native, /onTouchStart:\(\)=>choose\(index\)/);
  assert.match(native, /onClick:\(\)=>choose\(index\)/);
  assert.match(native, /onKeyDown:event=>/);
  assert.match(overlay, /onChange=\{event => setSelectedDate\(event\.target\.value\)\}/);
  assert.match(overlay, /role="group" aria-label="Expanded chart"/);
  assert.match(overlay, /<FinanceNativeChart/);
  assert.match(overlay, /rows=\{rows\} kind=\{kind\} alertLimit=\{limit\}/);
  assert.match(overlay, /selectedDate=\{selected\?\.dateKey \|\| ""\}/);
});

test("Expanded Spending Trend is read-only and its daily total matches the existing filtered trend", () => {
  assert.match(overlay, /rm\(selected\.expense\)/);
  assert.match(overlay, /row\.type === "expense"/);
  assert.match(overlay, /row\.date === selected\.dateKey/);
  assert.match(overlay, /category === "all" \|\| row\.category === category/);
  assert.match(overlay, /expenseRows\.length/);
  assert.match(overlay, /record\.note/);
  assert.match(overlay, /record\.method/);
  assert.match(overlay, /<span data-i18n-ignore>\{record\.note\}<\/span>/);
  assert.match(overlay, /builtInFinanceCategory\(record\.category, language\)/);
});

test("Expanded Balance Trend preserves existing threshold series and source balance without recalculation", () => {
  assert.match(overlay, /selected\?\.balanceGreen \?\? selected\?\.balanceRed/);
  assert.match(overlay, /const limit = Number\(alertLimit \|\| 1500\)/);
  assert.match(geometry, /"balanceGreen", "balanceRed"/);
  assert.match(native, /name:"Balance > "\+alertLabel/);
  assert.match(native, /name:"Balance ≤ "\+alertLabel/);
  assert.match(native, /balanceGreen:GREEN,balanceRed:RED/);




  assert.match(overlay, /rm\(day\?\.income\)/);
  assert.match(overlay, /rm\(day\?\.expense\)/);
  assert.match(overlay, /rm\(selected\.dailyBalance\)/);
  assert.match(overlay, /not a verified bank balance/);
});

test("Expanded trend overlay has no persistence, CRUD, auth, network or calculation operations", () => {
  assert.doesNotMatch(overlay, /\bsupabase\b|\.from\(|\.insert\(|\.update\(|\.delete\(|\bfetch\(|\blocalStorage\b/);
  assert.doesNotMatch(overlay, /\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bsaveBudgets\b|\bloadCloudData\b|\bimportCsv\b/);
  assert.doesNotMatch(overlay, /\bcalculateCashForecast\b|\bparseEditedAmount\b|\btoRecordPayload\b/);
});
