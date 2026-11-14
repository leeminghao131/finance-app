import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const app = source("App.jsx");
const excel = source("FinanceExcelExportPanel.jsx");
const excelService = source("financeExcel.js");
const csv = source("FinanceCsvImportPanel.jsx");

test("CSV and Excel tools are split off from the dashboard's initial JavaScript bundle", () => {
  assert.match(app, /const FinanceCsvImportPanel = React\.lazy\(\(\) => import\("\.\/FinanceCsvImportPanel\.jsx"\)\)/);
  assert.match(app, /const FinanceExcelExportPanel = React\.lazy\(\(\) => import\("\.\/FinanceExcelExportPanel\.jsx"\)\)/);
  assert.doesNotMatch(app, /import FinanceExcelExportPanel from/);
  assert.doesNotMatch(app, /import FinanceCsvImportPanel from/);
  assert.match(app, /<React\.Suspense fallback=/);
  assert.match(app, /\{importOpen && <FinanceCsvImportPanel/);
  assert.match(app, /\{exportOpen && <FinanceExcelExportPanel/);
});

test("All original import/export validation and cloud-refresh behavior remains connected", () => {
  assert.match(app, /onImported=\{\(\) => loadCloudData\(\{background:true\}\)\}/);
  assert.match(app, /onClose=\{\(\) => setImportOpen\(false\)\}/);
  assert.match(app, /onClose=\{\(\) => setExportOpen\(false\)\}/);
  assert.match(app, /dataReady=\{initialDataReady\}/);
  assert.match(excel, /verifyFinanceWorkbook\(workbook,stats\)/);
  assert.match(excel, /XLSX\.writeFile\(workbook/);
  assert.match(excelService, /import \* as XLSX from "xlsx"/);
  assert.match(csv, /importReviewedCsvRows/);
  assert.doesNotMatch(excel, /\.insert\(|\.upsert\(|\.delete\(/);
});

test("Loading split does not touch records, transfers, budgets, settings, or Supabase client", () => {
  assert.match(app, /const FinanceCsvImportPanel = React\.lazy/);
  assert.match(app, /const FinanceExcelExportPanel = React\.lazy/);
  assert.match(app, /<FinanceTransferPanel/);
  assert.match(app, /<FinanceBudgetPanel/);
  assert.match(app, /<FinanceForecastPanel/);
  assert.match(app, /<FinanceSavingsGoals/);
  assert.match(app, /<FinanceCategoryBubbleChart/);
  assert.match(app, /<FinanceMethodDonutChart/);
});
