import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=(name)=>readFileSync(new URL("../"+name, import.meta.url),"utf8");
const app=file("src/App.jsx");
const stage2=file("src/FinanceStage2Hub.jsx");
const pkg=JSON.parse(file("package.json"));
const lock=JSON.parse(file("package-lock.json"));
const pipeline=file(".github/workflows/finance-safety.yml");
const guard=file("src/supabaseClient.js");

test("build tools are pinned, reproducible, and not shipped as browser production dependencies",()=>{
  assert.equal(pkg.devDependencies.vite,"8.3.8");
  assert.equal(pkg.devDependencies["@vitejs/plugin-react"],"6.3.0");
  assert.equal(pkg.dependencies.vite,undefined);
  assert.equal(pkg.dependencies["@vitejs/plugin-react"],undefined);
  assert.equal(lock.packages["node_modules/vite"].version,"8.3.8");
  assert.equal(lock.packages["node_modules/@vitejs/plugin-react"].version,"6.3.0");
  assert.equal(lock.packages[""].devDependencies.vite,"8.3.8");
  assert.equal(lock.packages["node_modules/vite"].dev,true);
  assert.match(pipeline,/npm ci --no-audit --no-fund --ignore-scripts/);
});

test("security audit continues checking developer build dependencies and blocks high/critical issues",()=>{
  assert.match(pipeline,/npm audit --json/);
  assert.match(pipeline,/npm audit --omit=dev --audit-level=high/);
  assert.match(pipeline,/Number\(counts\.high \|\| 0\) > 0/);
  assert.match(pipeline,/Number\(counts\.critical \|\| 0\) > 0/);
  assert.doesNotMatch(pipeline,/BEGIN_FINANCE_LOCK/);
});

test("Stage2 tools are imported only on first request, with original callbacks preserved",()=>{
  for(const name of ["FinanceRecurringBills","FinanceReviewInbox","FinanceAccountReconciliation"]){
    assert.ok(stage2.includes("const "+name+" = React.lazy"),name+" must stay lazy");
    assert.ok(stage2.includes("<"+name),name+" panel must remain");
    assert.ok(!stage2.includes("import "+name+" from"),"no eager "+name);
  }
  assert.match(stage2,/<React\.Suspense fallback=/);
  for(const value of ["onSave={onSaveBills}","onConfirmPayment={onConfirmBillPayment}","onSave={onSaveReview}","onDeleteRecord={onDeleteRecord}","onSave={onSaveChecks}","onExecuteTransfers={onExecuteTransfers}","onPrefillRecord={prefillAndClose}"]){
    assert.ok(stage2.includes(value),value+" preserved");
  }
  assert.match(stage2,/mode==="bill"&&<FinanceRecurringBills/);
  assert.match(stage2,/mode==="review"&&<FinanceReviewInbox/);
  assert.match(stage2,/mode==="accounts"&&<FinanceAccountReconciliation/);
});

test("live finance UI and fail-closed TEST endpoint remain present",()=>{
  assert.match(app,/function TrendTooltip\(/);
  assert.match(app,/<FinanceTransferPanel/);
  assert.match(app,/<FinanceRuleAssistant/);
  assert.match(app,/<FinanceStage2Hub/);
  assert.match(app,/<FinanceInsightsDock/);
  assert.match(app,/<FinanceCategoryBubbleChart/);
  assert.match(app,/React\.lazy\(\(\) => import\("\.\/FinanceExcelExportPanel\.jsx"\)/);
  assert.match(guard,/const SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby"/);
  assert.match(guard,/export const supabase = hasSupabaseEnv \? createClient/);
});
