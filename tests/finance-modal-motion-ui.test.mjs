import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const overlay = read("FinanceOverlay.jsx");
const ui = read("financeUi.css");
const app = read("App.jsx");
const forecast = read("FinanceForecastPanel.jsx");
const opening = read("FinanceOpeningBalancePanel.jsx");
const mobile = read("FinanceMobileRecords.jsx");
const expanded = read("FinanceExpandedTrendOverlay.jsx");
const comparison = read("FinanceMonthComparison.jsx");
const savings = read("FinanceSavingsGoals.jsx");

test("Every FinanceOverlay uses the 300ms button-origin animation, reversed on close", () => {
  assert.match(overlay, /FINANCE_MODAL_MOTION_MS = 300/);
  assert.match(overlay, /triggerRef/);
  assert.match(overlay, /getBoundingClientRect\(\)/);
  assert.match(overlay, /source\.left - modalRect\.left/);
  assert.match(overlay, /source\.top - modalRect\.top/);
  assert.match(overlay, /source\.width \/ modalRect\.width/);
  assert.match(overlay, /source\.height \/ modalRect\.height/);
  assert.match(overlay, /direction: open \? "normal" : "reverse"/);
  assert.match(overlay, /sheetMotion\.onfinish/);
  assert.match(overlay, /setMounted\(false\)/);
  assert.doesNotMatch(overlay, /fullBox|viewportOvershoot|1\.1\) scale\(/);
  assert.match(overlay, /prefers-reduced-motion: reduce/);
  assert.match(ui, /mh-modal-hover-jitter/);
  assert.match(ui, /\.mh-modal-trigger:not\(:disabled\):hover/);
  assert.match(ui, /infinite/);
});

test("Previous dialogs preserve all callbacks while opening and closing from their own triggers", () => {
  assert.match(app, /triggerRef=\{methodTriggerRef\}/);
  assert.match(app, /triggerRef=\{budgetTriggerRef\}/);
  assert.match(app, /triggerRef=\{recordsTriggerRef\}/);
  assert.match(app, /ref=\{spendingTrendTriggerRef\}/);
  assert.match(app, /ref=\{balanceTrendTriggerRef\}/);
  assert.match(app, /triggerRef=\{expandedTrend === "balance" \? balanceTrendTriggerRef : spendingTrendTriggerRef\}/);
  assert.match(forecast, /triggerRef=\{incomePlannerTriggerRef\}/);
  assert.match(opening, /triggerRef=\{openingTriggerRef\}/);
  assert.match(mobile, /triggerRef=\{editTriggerRef\}/);
  assert.match(expanded, /triggerRef=\{triggerRef\}/);
  assert.match(app, /budgetDraftDirty && !localizedFinanceConfirm/);
  assert.match(opening, /Discard unsaved opening balance changes/);
  assert.match(mobile, /await onUpdate\(record\.id, field, draft\)/);
  assert.match(overlay, /openDialogStack\.push\(currentDialog\)/);
  assert.match(overlay, /openDialogStack\[openDialogStack\.length - 1\] !== currentDialog/);
  assert.match(overlay, /document\.body\.style\.overflow = previousOverflow/);
});

test("Monthly category comparison keeps chosen-month calculations and moves the table into a portal", () => {
  assert.match(comparison, /compareFinanceMonths\(records,firstMonth,secondMonth\)/);
  assert.match(comparison, /<FinanceOverlay open=\{showCategories\} title="Category Comparison \/ 分类对比"/);
  assert.match(comparison, /triggerRef=\{categoryCompareTriggerRef\}/);
  assert.match(comparison, /onClose=\{\(\)=>setShowCategories\(false\)\}/);
  assert.match(comparison, /value\.categories\.map\(c=>/);
  assert.match(comparison, /money\(c\.first\)/);
  assert.match(comparison, /money\(c\.second\)/);
  assert.match(comparison, /money\(c\.change\)/);
  assert.doesNotMatch(comparison, /showCategories&&<div className="mt-3/);
});

test("Savings Goal new/edit/update uses a portal and retains cloud guards, unsaved confirmation and form", () => {
  assert.match(savings, /<FinanceOverlay open=\{!!editor\}/);
  assert.match(savings, /triggerRef=\{editorTriggerRef\}/);
  assert.match(savings, /onClose=\{close\}/);
  assert.match(savings, /onClick=\{event=>start\(null,event\.currentTarget\)\}/);
  assert.match(savings, /onClick=\{event=>start\(g,event\.currentTarget\)\}/);
  assert.match(savings, /<form onSubmit=\{submit\}/);
  assert.match(savings, /JSON\.stringify\(goals\)!==baseline/);
  assert.match(savings, /const ok=await onSave\(normalized,baseline\)/);
  assert.match(savings, /if\(pending\.current\)return false/);
  assert.match(savings, /Discard unsaved Savings Goal changes/);
  assert.match(savings, /savingsGoalProgress\(\{\.\.\.g,saved:available\}\)/);
  assert.match(savings, /Saved amount \(auto\)/);
  assert.doesNotMatch(savings, /value=\{draft\.saved\}/);
});

test("The animation layer never writes Supabase, dates, balance, records or settings", () => {
  assert.doesNotMatch(overlay, /\bsupabase\b|\.insert\(|\.upsert\(|\.delete\(|localStorage|\bfetch\(/);
  assert.doesNotMatch(overlay, /\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bimportCsv\b|\bsaveBudgets\b|\bloadCloudData\b/);
});
