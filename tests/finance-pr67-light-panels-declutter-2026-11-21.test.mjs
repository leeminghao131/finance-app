import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const contrast = source("financeLegibilitySweep.css");
const review = source("FinanceReviewInbox.jsx");
const activity = source("FinanceActivityPanel.jsx");
const currency = source("FinanceCurrencyInput.jsx");
const savings = source("FinanceSavingsGoals.jsx");
const budget = source("FinanceBudgetPanel.jsx");

test("Review switch labels and threshold form no longer escape dark styling", () => {
  assert.match(review, /<label key=\{rule\}/);
  assert.match(review, /rounded-xl bg-white px-3 py-2 text-sm ring-1/);
  assert.match(review, /<form onSubmit=\{adjustThreshold\} className="[^"]*bg-slate-50/);
  assert.match(contrast, /label\.bg-white:has\(input\[role="switch"\]\)/);
  assert.match(contrast, /form\.bg-slate-50:has\(input\[name="threshold"\]\)/);
  assert.match(contrast, /:is\(label,form,fieldset,header,footer,nav,li\)\.bg-white/);
  assert.match(contrast, /background:\s*#20394b/);
});
test("Selected Activity mint panel stays teal but dark and readable", () => {
  assert.match(activity, /border-teal-500 bg-teal-50/);
  assert.match(contrast, /button\.bg-teal-50:hover/);
  assert.match(contrast, /background:\s*#133c40/);
  assert.match(contrast, /color:\s*#e1fff3/);
});
test("Compact FX picker overrides its old bright gradient and retains native select", () => {
  assert.match(currency, /mh-entry-fx-direct__select/);
  assert.match(contrast, /\.mh-entry-fx-direct__picker\s*\{/);
  assert.match(contrast, /linear-gradient\(145deg, #182c3f, #294154\)/);
  assert.match(contrast, /\.mh-entry-fx-direct__select option/);
  assert.match(contrast, /color-scheme:\s*dark/);
});
test("Trim presentation-only text but preserve savings, budget and payment cautions", () => {
  assert.match(savings, /Shared available savings/);
  assert.doesNotMatch(savings, /No Savings Goals yet\. Add one to start tracking your progress\./);
  assert.match(savings, /Goals share this available balance/);
  assert.match(savings, /Budget exceeds Balance by/);
  assert.match(budget, /Unsaved budget edits/);
  assert.match(budget, /last-saved values until you save/);
  assert.match(source("FinanceRecurringBills.jsx"), /Confirming a payment adds one real Expense/);
  assert.match(source("FinanceTransferPanel.jsx"), /onTransfer/);
  assert.doesNotMatch(source("FinanceTransferPanel.jsx"), /CIRCULAR TRANSFER CONSOLE/);
});
