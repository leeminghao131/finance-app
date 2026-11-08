import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (relative) => readFileSync(new URL(relative, import.meta.url),"utf8");
const app = source("../src/App.jsx");
const transfers = source("../src/FinanceTransferPanel.jsx");
const budgets = source("../src/FinanceBudgetPanel.jsx");
const forecast = source("../src/FinanceForecastPanel.jsx");
const db = source("../docs/database/preview_finance_transfers_budget_forecast.sql");
const client = source("../src/supabaseClient.js");

test("new Preview is hard-locked to the independent MH Finance Test project",()=>{
 assert.match(client,/SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby"/);
 assert.match(client,/isTestEnvironment = supabaseUrl === requiredSandboxUrl/);
 assert.doesNotMatch(client,/hlkciowyusbhwcwjzfsr/);
});

test("transfers are edited with owner + revision guard, soft-deleted and restorable",()=>{
 assert.match(app,/async function updateTransfer\(transferId, edit\)/);
 assert.match(app,/async function deleteTransfer\(transferId\)/);
 assert.match(app,/async function restoreTransfer\(transferId\)/);
 assert.match(app,/\.eq\("version",current\.version\)\.is\("deleted_at",null\)/);
 assert.match(app,/\.eq\("user_id",user\.id\)/);
 assert.match(app,/parseEditedAmount\(edit\.amount\)/);
 assert.doesNotMatch(app,/\.from\("transfers"\)\s*\.delete\(/);
 assert.match(transfers,/View All Transfers/);
 assert.match(transfers,/Transfer Recycle Bin/);
 assert.match(transfers,/Transfer History/);
 assert.match(transfers,/setLimit\(n=>n\+25\)/);
});

test("month budgets are separate from filtered transactions and revision-checked",()=>{
 assert.match(app,/\.from\("monthly_budgets"\)/);
 assert.match(app,/\.eq\("version", expectedVersion\)/);
 assert.match(budgets,/Monthly Budget/);
 assert.match(budgets,/summarizeMonthlyBudget\(records,activeBudgets,budgetMonth,categories\)/);
 assert.match(budgets,/No historical budget saved/);
 assert.match(budgets,/Set as default template/);
 assert.match(db,/Monthly budgets: update owned/);
 assert.match(db,/auth\.uid\(\)/);
});

test("expected salary plans are stored outside real transactions",()=>{
 assert.match(app,/queueSettingsField\("forecast_plans",normalized\)/);
 assert.match(forecast,/Expected Income/);
 assert.match(forecast,/Real income is never mixed with planned income/);
 assert.match(forecast,/Next 90 days/);
 assert.match(forecast,/strokeDasharray="6 4"/);
 assert.match(db,/forecast_plans jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
});

test("local midnight and Supabase realtime updates cover all phase2 tables",()=>{
 assert.match(app,/const today = localDateMY/);
 assert.match(app,/const monthNow = localMonthMY/);
 assert.match(app,/setInterval\(checkDate, 30000\)/);
 assert.match(app,/for \(const table of \["records", "transfers", "user_settings", "monthly_budgets"\]\)/);
});
