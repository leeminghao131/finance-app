import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEditedAmount } from "../src/financeData.js";

const file = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app=file("App.jsx");
const forecast=file("FinanceForecastPanel.jsx");
const budget=file("FinanceBudgetPanel.jsx");
const overlay=file("FinanceOverlay.jsx");

test("01: edited amounts are RM amounts, and normal add-form entry no longer converts 100 into 1", () => {
  assert.equal(parseEditedAmount("100"),100);
  assert.equal(parseEditedAmount("2500"),2500);
  assert.equal(parseEditedAmount("24.55"),24.55);
  assert.match(app,/const \[amountEntryMode, setAmountEntryMode\] = useState\("rm"\)/);
  assert.match(app,/amount: amountEntryMode === "cents" \? formatMoneyTyping\(event\.target\.value\) : event\.target\.value/);
  assert.match(app,/amount = parseEditedAmount\(form\.amount\)/);
  assert.match(app,/field === "amount" \? parseEditedAmount\(value\) : value/);
  assert.match(app,/field === "amount"\) event\.target\.select\(\)/);
  assert.match(app,/Normal RM: 100 → RM100\.00/);
  assert.match(app,/Cents keypad: 2455 → RM24\.55/);
});

test("08: plan editor is only within an overlay and the green summary card has a clickable icon", () => {
  assert.match(forecast,/Expected future income \(not real\)/);
  assert.match(forecast,/aria-label="Manage Expected Income"/);
  assert.match(forecast,/setIncomePlannerOpen\(true\)/);
  assert.match(forecast,/<FinanceOverlay open=\{incomePlannerOpen\}/);
  assert.match(forecast,/onClose=\{\(\) => setIncomePlannerOpen\(false\)\}/);
  assert.match(forecast,/onSavePlans\(\[\.\.\.plannedIncomes,newPlan\]\)/);
  assert.match(forecast,/onSavePlans\(plannedIncomes\.filter\(p=>p\.id!==id\)\)/);
});

test("09: budget editor only opens from Filtered Expense and preserves old monthly budget callbacks", () => {
  assert.match(app,/title="Filtered Expense"[^\n]*icon="📉"/);
  assert.match(app,/aria-label="Open Monthly Budget"/);
  assert.match(app,/setBudgetOpen\(true\)/);
  assert.match(app,/<FinanceOverlay open=\{budgetOpen\}/);
  assert.match(app,/onSaveMonthly=\{saveMonthlyBudget\}/);
  assert.match(app,/onSaveTemplate=\{saveTemplateBudget\}/);
  assert.match(app,/onDirtyChange=\{setBudgetDraftDirty\}/);
  assert.match(app,/budgetDraftDirty && !localizedFinanceConfirm/);
  assert.match(budget,/onDirtyChange\?\.\(dirty\)/);
});

test("08/09 popup is portaled out of grids, focus managed, Escape/backdrop closable and scroll locked", () => {
  assert.match(overlay,/createPortal\(/);
  assert.match(overlay,/document\.body/);
  assert.match(overlay,/role="dialog" aria-modal="true"/);
  assert.match(overlay,/fixed inset-0 z-\[100\]/);
  assert.match(overlay,/event\.key === "Escape"/);
  assert.match(overlay,/event\.target === event\.currentTarget/);
  assert.match(overlay,/document\.body\.style\.overflow = previousOverflow/);
  assert.match(overlay,/aria-label=\{"Close " \+ shownTitle\}/);
});
