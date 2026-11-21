import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translateFinanceText } from "../src/financeLanguage.js";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const css = read("financeLegibilitySweep.css");
const app = read("App.jsx");
const assistant = read("FinanceRuleAssistant.jsx");
const bills = read("FinanceRecurringBills.jsx");
const savings = read("FinanceSavingsGoals.jsx");
const languageLayer = read("FinanceLanguageLayer.jsx");
const lang = read("financeLanguage.js");
const entries = read("financeLanguagePolish.js");

test("Dark cosmic theme is applied after older module/dialog overrides", () => {
  assert.match(app, /import "\.\/financeHeatmapDetails\.css";\s*import "\.\/financeLegibilitySweep\.css";/);
  assert.match(css, /\.mh-ui\.mh-cosmic-pilot/);
  assert.match(css, /\.mh-cosmic-modal-sheet/);
  assert.match(css, /\.mh-rule-assistant__sheet/);
  assert.match(css, /\.mh-entry-note-quick button/);
  assert.match(css, /\.mh-cosmic-modal-sheet details\.bg-white/);
  assert.match(css, /\.mh-rule-assistant__question:hover:not\(:disabled\)/);
  assert.match(css, /color:\s*#fff5e2/);
  assert.match(css, /\.mh-cosmic-modal-sheet \[role="tab"\]\[aria-selected="true"\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /:root\s*\{|(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /display:\s*none\s*!important|backdrop-filter|position:\s*fixed/);
});

test("Priority warning/status colors survive removing white surfaces", () => {
  assert.match(css, /\.bg-red-50/);
  assert.match(css, /\.bg-emerald-50/);
  assert.match(css, /\.text-red-700/);
  assert.match(css, /\.text-emerald-700/);
  assert.match(css, /\[role="alert"\]/);
  assert.match(css, /\[role="status"\]/);
  assert.match(bills, /onConfirmPayment/);
  assert.match(bills, /onSave/);
  assert.match(bills, /linked Expense is missing\/deleted/);
  assert.match(savings, /Budget exceeds Balance by/);
});

test("Built-in bilingual UI strings have reversible display-only translations", () => {
  for (const [src,cn] of [
    ["New Goal","新建目标"],["Edit / Update","编辑／更新"],
    ["Target date:","目标日期："],["FX Edit","编辑外币"],
    ["Bill Calendar","账单日历"],["No note","无备注"],
    ["No overdue or upcoming bills within the next 14 days.","未来 14 天内没有待处理或逾期账单。"],
    ["No Savings Goals yet. Add one to start tracking your progress.","暂无储蓄目标。"],
    ["Food","饮食"],["CASH","现金"],
    ["BANK","银行账户"],
  ]) {
    assert.equal(translateFinanceText(src,"zh"),cn,src+" -> zh");
    assert.equal(translateFinanceText(cn,"en"),src,cn+" -> en");
  }
  assert.equal(translateFinanceText("💸 Expense","zh"),"💸 支出");
  assert.equal(translateFinanceText("💸 支出","en"),"💸 Expense");
  assert.equal(translateFinanceText("MYR","zh"),"MYR");
  assert.equal(translateFinanceText("My own category","zh"),"My own category");
  assert.equal(translateFinanceText("My custom note","en"),"My custom note");
  assert.match(languageLayer, /data-i18n-ignore/);
  assert.match(languageLayer, /const ATTRIBUTES = \["placeholder", "title", "aria-label"\]/);
  assert.match(lang, /financeLanguagePolish/);
  assert.match(entries, /financeLanguagePolish/);
});

test("Bilingual bill values preserve category and method keys in select options", () => {
  assert.match(bills, /value=\{c\}>\{categoryLabel\(c\)\}/);
  assert.match(bills, /value=\{m\}>\{methodLabel\(m\)\}/);
  assert.match(bills, /const categoryLabel=value=>\["饮食"/);
  assert.match(bills, /const methodLabel=value=>value==="CASH"/);
  assert.match(bills, /method:canonicalFinanceMethod/);
  assert.match(bills, /onSave\(valid,baseline\)/);
  assert.match(savings, /zh \? "目标日期：" : "Target date: "/);
});

test("Walkthrough text removed; business-facing warnings and errors remain", () => {
  assert.doesNotMatch(app, /Tap a date for daily records/);
  assert.doesNotMatch(assistant, /Read-only; never edits or deletes data/);
  assert.doesNotMatch(bills, /Confirming a payment adds one real Expense/);
  assert.doesNotMatch(savings, /Manual progress only; does not create/);
  assert.doesNotMatch(read("FinanceBudgetPanel.jsx"), /75% warning, 100% over budget/);
  assert.doesNotMatch(read("FinanceMobileRecords.jsx"), /Edit one field at a time/);
  assert.match(bills, /onConfirmPayment/);
  assert.match(savings, /const ok=await onSave\(normalized,baseline\)/);
  assert.match(read("FinanceClaimTracker.jsx"), /onVoidRepayment/);
  assert.match(read("FinanceRecurringBills.jsx"), /paymentPendingRef/);
});
