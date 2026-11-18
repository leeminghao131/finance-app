import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEditedAmount } from "../src/financeData.js";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = read("App.jsx");
const transferOrbit = read("FinanceTransferCorners.jsx");
const opening = read("FinanceOpeningBalancePanel.jsx");
const fxInput = read("FinanceCurrencyInput.jsx");
const forecast = read("FinanceForecastPanel.jsx");
const savings = read("FinanceSavingsGoals.jsx");
const scenario = read("FinanceScenarioSimulator.jsx");
const budget = read("FinanceBudgetPanel.jsx");
const stage2 = read("FinanceStage2Hub.jsx");
const emblem = read("FinanceNotificationEmblem.jsx");
const css = read("financeUi.css");

test("Empty new-entry fields never present a prefilled 0.00; stored historical values remain unchanged", () => {
  assert.match(app, /value=\{form\.amount === "0\.00" \? "" : form\.amount\}/);
  assert.match(app, /const \[calculationText, setCalculationText\] = useState\(""\)/);
  assert.match(app, /amount: amountEntryMode === "cents" \? formatMoneyTyping\(event\.target\.value\) : event\.target\.value/);
  assert.match(transferOrbit, /value=\{amount === "0\.00" \? "" : amount\}/);
  assert.match(opening, /balances\[method\] == null/);
  assert.match(opening, /draft\[method\] === "0\.00"/);
  assert.match(fxInput, /value=\{foreignAmount\}/);
  assert.doesNotMatch(fxInput, /placeholder=\{currency==="JPY"/);
  assert.doesNotMatch(forecast, /placeholder="2500\.00"/);
  assert.doesNotMatch(savings, /placeholder="5000\.00"/);
  assert.doesNotMatch(budget, /placeholder="Not set"/);
  assert.match(scenario, /incomeDelta:"",spendingDelta:""/);
  assert.match(scenario, /\[goal,setGoal\]=useState\(""\)/);
  for(const [raw,expected] of [["100",100],["24.55",24.55],["0.01",0.01],["2500",2500]]) {
    assert.equal(parseEditedAmount(raw),expected);
  }
  assert.match(app, /async function addRecord\(e\)/);
  assert.match(app, /async function updateRecord\(/);
  assert.match(app, /async function deleteRecord\(/);
});

test("Only buttons opening floating dialogs or menus vibrate, never ordinary controls or trends", () => {
  assert.match(css, /@keyframes mh-universal-hover-vibrate/);
  assert.ok(css.includes('button:is(.mh-modal-trigger, [aria-haspopup="dialog"], [aria-haspopup="menu"]):not(:disabled):not(:active):hover'));
  assert.doesNotMatch(css, /\.mh-ui button:not\(:disabled\):not\(:active\):hover/);
  assert.doesNotMatch(css, /\[role="dialog"\] button:not\(:disabled\):not\(:active\):hover/);
  assert.doesNotMatch(css, /\.mh-stage2-notifications button:not\(:disabled\):not\(:active\):hover/);
  assert.match(css, /\.17s linear infinite/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(app, /aria-label="Expand Spending Trend"/);
  assert.match(app, /aria-label="Expand Filtered Balance Trend"/);
  assert.match(app, /role="button" tabIndex=\{0\} aria-label="Expand Spending Trend"/);
});

test("Icon-only metallic alerts and steampunk assistant retain accessible names and original popup actions", () => {
  const assistant = read("FinanceRuleAssistant.jsx");
  const robot = read("FinanceAssistantEmblem.jsx");
  const dock = read("FinanceInsightsDock.jsx");
  assert.match(stage2, /<FinanceNotificationEmblem active=\{alertCount>0\}/);
  assert.doesNotMatch(stage2, /<span>\{t\("提醒","Alerts"\)\}<\/span>/);
  assert.match(stage2, /aria-haspopup="menu"/);
  assert.match(stage2, /aria-label=\{t\("查看财务提醒","Open finance reminders"\)\}/);
  assert.match(stage2, /mh-stage2-notifications__count/);
  assert.match(assistant, /<FinanceAssistantEmblem \/>/);
  assert.match(assistant, /<FinanceAssistantEmblem compact \/>/);
  assert.doesNotMatch(assistant, /<span aria-hidden="true">🤖<\/span>/);
  assert.match(assistant, /aria-label=\{zh\?"财务小助手":"Finance assistant"\}/);
  assert.match(assistant, /aria-haspopup="dialog"/);
  assert.match(assistant, /ASSISTANT_SUGGESTIONS\.map/);
  assert.match(robot, /steampunk robot/);
  assert.match(robot, /<svg viewBox="0 0 64 64"/);
  assert.match(robot, /mh-steampunk-assistant-emblem__eyes/);
  assert.match(css, /mh-steampunk-assistant-spin/);
  assert.match(css, /mh-steampunk-assistant-glow/);
  assert.match(dock, /aria-haspopup="dialog"/);
  assert.doesNotMatch(robot, /supabase|fetch\(|localStorage|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(stage2, /supabase\.from\(/);
});

test("Notification emblem is a decorative animated SVG and reuses existing actionable alerts", () => {
  assert.match(stage2, /import FinanceNotificationEmblem from/);
  assert.match(stage2, /<FinanceNotificationEmblem active=\{alertCount>0\}/);
  assert.match(stage2, /const alertCount=alerts.length/);
  assert.match(stage2, /billOccurrences\(/);
  assert.match(stage2, /findReviewCandidates\(/);
  assert.match(stage2, /mh-stage2-notifications__toast/);
  assert.match(stage2, /onClick=\{e=>open\(item\.type,item\.ref,e\.currentTarget\)\}/);
  assert.match(emblem, /useId\(\)/);
  assert.match(emblem, /<svg viewBox="0 0 52 52"/);
  assert.match(emblem, /aria-hidden="true"/);
  assert.match(css, /mh-notification-orbit/);
  assert.match(css, /mh-notification-swing/);
  assert.match(css, /mh-notification-flare/);
  assert.match(css, /\.mh-notification-emblem__bell/);
  assert.doesNotMatch(emblem, /\bsupabase\b|localStorage|\.insert\(|\.update\(|\.delete\(|fetch\(/);
});

test("Redundant instructions removed without hiding real-money confirmation or cloud errors", () => {
  assert.doesNotMatch(app, /Cents keypad: 2455 → RM24\.55/);
  assert.doesNotMatch(app, /Normal RM: 100 → RM100\.00/);
  assert.doesNotMatch(read("FinanceBudgetPanel.jsx"), /Uses calendar months only/);
  assert.doesNotMatch(read("FinanceMonthComparison.jsx"), /Compare any two calendar months/);
  assert.doesNotMatch(read("FinanceRuleAssistant.jsx"), /Choose one of the questions below/);
  assert.match(read("FinanceRecurringBills.jsx"), /Confirming a payment adds one real Expense/);
  assert.match(read("FinanceCurrencyInput.jsx"), /Reference rates may differ from bank debits/);
  assert.match(read("FinanceAccountReconciliation.jsx"), /Blank is never treated as RM0/);
  assert.match(read("FinanceReviewInbox.jsx"), /onDeleteRecord/);
  assert.match(read("FinanceSavingsGoals.jsx"), /const ok=await onSave\(normalized,baseline\)/);
});
