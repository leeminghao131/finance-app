import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  makeDashboardCategoryChoices, selectedDashboardCategory,
  categoryOnlyRows, categoryComparisonRows
} from "../src/financeDashboardCategoryFilter.js";

const read = file => readFileSync(new URL("../src/"+file, import.meta.url), "utf8");
const app = read("App.jsx");
const css = read("financeUi.css");
const picker = read("FinanceCategoryFilterPicker.jsx");
const language = read("FinanceLanguageLayer.jsx");
const rows = [
  {id:1,type:"expense",category:"饮食",date:"2026-11-01",amount:30},
  {id:2,type:"expense",category:"交通",date:"2026-11-02",amount:20},
  {id:3,type:"expense",category:"Shared Custom",date:"2026-11-03",amount:12},
  {id:4,type:"income",category:"Salary",date:"2026-11-01",amount:1000},
  {id:5,type:"income",category:"Shared Custom",date:"2026-11-04",amount:50},
];
const options = makeDashboardCategoryChoices(["饮食","交通","Shared Custom"],["Salary","Shared Custom"]);
const sum = (list,type) => list.filter(row=>row.type===type).reduce((v,row)=>v+row.amount,0);

test("Category choice is type-safe for custom names shared by income and expense",()=>{
  const expense = selectedDashboardCategory(options, "expense:"+encodeURIComponent("Shared Custom"));
  const income = selectedDashboardCategory(options, "income:"+encodeURIComponent("Shared Custom"));
  assert.deepEqual(categoryOnlyRows(rows,expense).map(r=>r.id),[3]);
  assert.deepEqual(categoryOnlyRows(rows,income).map(r=>r.id),[5]);
  assert.equal(selectedDashboardCategory(options,"all"),null);
  assert.equal(selectedDashboardCategory(options,"expense:unknown"),null);
  assert.strictEqual(categoryOnlyRows(rows,null),rows);
  assert.deepEqual(rows.map(r=>r.id),[1,2,3,4,5]); // does not mutate stored rows
});

test("Expense-category view retains all income for comparison; income-category view retains all expense",()=>{
  const food = selectedDashboardCategory(options,"expense:"+encodeURIComponent("饮食"));
  const salary = selectedDashboardCategory(options,"income:Salary");
  assert.deepEqual(categoryOnlyRows(rows,food).map(r=>r.id),[1]);
  assert.deepEqual(categoryComparisonRows(rows,food).map(r=>r.id),[1,4,5]);
  assert.deepEqual(categoryComparisonRows(rows,salary).map(r=>r.id),[1,2,3,4]);
  // Category plus keyword search retains ALL opposite-type period records.
  assert.deepEqual(categoryComparisonRows(rows.filter(r=>r.id===1),food,rows).map(r=>r.id),[1,4,5]);
  assert.deepEqual(categoryComparisonRows(rows.filter(r=>r.id===4),salary,rows).map(r=>r.id),[1,2,3,4]);
  assert.equal(sum(rows,"income")-sum(rows,"expense"), 988);
  assert.equal(sum(rows,"income")-sum(rows,"expense"), sum(rows,"income")-sum(rows,"expense"));
  assert.strictEqual(categoryComparisonRows(rows,null),rows);
});

test("Today's five summary metrics are INSIDE the same header row, between brand and controls",()=>{
  const first = app.indexOf('<header className="mh-dashboard-header');
  const last = app.indexOf("</header>",first);
  const header = app.slice(first,last);
  assert.ok(first>=0&&last>first);
  assert.ok(header.indexOf('className="mh-dashboard-brand') < header.indexOf('className="mh-dashboard-today"'));
  assert.ok(header.indexOf('className="mh-dashboard-today"') < header.indexOf('className="mh-dashboard-actions'));
  for(const key of ["income","expense","net","count","category"]) assert.ok(header.includes('key:"'+key+'"'),key);
  assert.match(header,/todaySummaryStats\.income/);
  assert.match(header,/todaySummaryStats\.expense/);
  assert.match(header,/todaySummaryStats\.count/);
  assert.match(header,/todaySummaryStats\.topCategory/);
  assert.match(header,/initialDataReady && !dataLoading/);
  assert.doesNotMatch(app,/<TodaySummaryCard stats=\{todaySummaryStats\} \/>/);
  assert.match(css,/\.mh-ui \.mh-dashboard-header \{\s*display: grid;/);
  assert.match(css,/grid-template-columns: minmax\(118px, 210px\) minmax\(0, 1fr\) auto;/);
  assert.match(css,/\.mh-dashboard-today__track \{[\s\S]*?overflow-x: auto/);
  assert.match(css,/scroll-snap-type: x proximity/);
  assert.match(css,/@media \(max-width: 767px\)[\s\S]*?grid-template-columns: minmax\(70px, 105px\) minmax\(0, 1fr\) auto;/);
  assert.match(header,/<FinanceLanguageButton className="mh-dashboard-action" compactOnMobile \/>/);
  assert.match(language,/compactOnMobile = false/);
  assert.match(language,/className="hidden sm:inline"/);
});

test("Category button and keyword magnifier preserve all previous filter modes and custom choices",()=>{
  assert.match(app,/value=\{filterMode\}/);
  for(const mode of ["all","month","year","recent30","recent7","recent3"]) assert.ok(app.includes('<option value="'+mode+'">'),mode);
  assert.match(app,/aria-haspopup="dialog"\s+aria-expanded=\{categoryPickerOpen\}/);
  assert.match(app,/<FinanceCategoryFilterPicker choices=\{categoryChoices\}/);
  assert.match(app,/formatCategoryLabel=\{formatCategoryLabel\}/);
  assert.match(app,/onChange=\{event => setKeyword\(event\.target\.value\)\}/);
  assert.match(app,/value=\{keyword\}/);
  assert.match(app,/setKeyword\(""\)/);
  assert.match(picker,/choices\.filter\(choice => choice\.type === section\.type\)/);
  assert.match(picker,/selectedKey === choice\.key/);
  assert.doesNotMatch(picker,/supabase|\.insert\(|\.update\(|\.delete\(|fetch\(/);
});

test("Category charts and transaction views remain distinct from protected period balances and forecast",()=>{
  assert.match(app,/const periodRecords = useMemo\(\(\) => filterRecords\(records, filterMode, selectedMonth, selectedYear, "", localToday\)/);
  assert.match(app,/const filteredRecords = useMemo\(\(\) => categoryOnlyRows\(searchPeriodRecords, selectedCategoryFilter\)/);
  assert.match(app,/const chartRecords = useMemo\(\(\) => categoryComparisonRows\(searchPeriodRecords, selectedCategoryFilter, periodRecords\)/);
  // PR #74 memoizes this same expense-only chart projection; both syntaxes are valid.
  assert.match(app,/const expenseRecords = (?:chartRecords\.filter\(\(r\) => r\.type === "expense"\)|useMemo\(\(\) => chartRecords\.filter\(\(r\) => r\.type === "expense"\), \[chartRecords\]\))/);
  assert.match(app,/const categoryData = useMemo\(\(\) => group\(expenseRecords/);
  assert.match(app,/const methodData = useMemo\(\(\) => group\(expenseRecords/);
  assert.match(app,/const totalBalanceSen=Math\.round\(openingBalanceTotal\*100\)\+/);
  assert.match(app,/<BalanceCard title="Filtered Balance" value=\{periodIncome - periodExpense\}/);
  assert.match(app,/periodRecords\.forEach\(\(r\) => \{\s*if \(!out\[r\.date\]\) out\[r\.date\] = \{ dateKey: r\.date, day: chartLabel\(r\.date\), expense: 0, dailyBalance: 0 \}/);
  assert.match(app,/dailyData=\{expandedTrend === "balance" \? periodDailyData : dailyData\}/);
  assert.match(app,/records=\{expandedTrend === "balance" \? periodRecords : chartRecords\}/);
  assert.match(app,/<FinanceForecastPanel\s+records=\{records\}/);
  assert.match(app,/<FinanceBudgetPanel[\s\S]*?records=\{records\}/);
  assert.match(app,/const transactionFilteredIncome = sumType\(filteredRecords, "income"\)/);
  assert.match(app,/const transactionFilteredExpense = sumType\(filteredRecords, "expense"\)/);
  assert.match(app,/money\(transactionFilteredIncome\)/);
});
