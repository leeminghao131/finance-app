import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = read("App.jsx");
const css = read("financeUi.css");
const currency = read("FinanceCurrencyInput.jsx");
const quickNotes = read("FinanceQuickNotes.jsx");

test("Sticky compact header reuses Sound, Language, Sign out and accessible shortcuts", () => {
  assert.match(app, /<header className="mh-dashboard-header/);
  assert.match(css, /\.mh-ui \.mh-dashboard-header \{[\s\S]*?position: sticky;[\s\S]*?top: env\(safe-area-inset-top, 0px\)/);
  assert.match(css, /\.mh-ui \.mh-dashboard-quick-actions/);
  assert.match(app, /<FinanceLanguageButton className="mh-dashboard-action" compactOnMobile \/>/);
  assert.match(app, /onClick=\{\(\) => setSoundEnabled\(\(v\) => !v\)\}/);
  assert.match(app, /onClick=\{signOut\}/);
  assert.match(app, /isChinese \? "仪表板快捷导航" : "Dashboard quick navigation"/);
  assert.match(currency, /zh\?"交易货币":"Transaction currency"/);
  assert.match(app, /id="mh-dashboard-statistics"/);
  assert.match(app, /id="mh-stage2-add-record-form"/);
  assert.match(app, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(app, /recordsOpenSource === "nav" \? recordsNavTriggerRef : recordsTriggerRef/);
});

test("FX currency is directly selectable on mobile and desktop with no second toggle", () => {
  assert.doesNotMatch(app, /currencyToolsOpen|setCurrencyToolsOpen|mh-entry-currency-panel/);
  assert.match(app, /<FinanceCurrencyInput compact date=\{form\.date\} currency=\{fxCurrency\}/);
  assert.match(app, /onForeignAmount=\{setFxForeignAmount\}/);
  assert.match(app, /mh-entry-currency--active/);
  assert.match(currency, /<select aria-label=\{zh\?"交易货币":"Transaction currency"\} value=\{currency\}/);
  assert.match(currency, /compact\?"mh-entry-fx-direct"/);
  assert.match(currency, /getReferenceFxRate\(currency,date,fetch,ctrl\.signal\)/);
  assert.match(css, /\.mh-ui \.mh-entry-fx-direct__select \{/);
  assert.doesNotMatch(css, /"chips chips"/);
});

test("Calculator moved to the existing button-origin overlay with click-only keypad", () => {
  const keypad = read("FinanceCalculatorKeypad.jsx");
  assert.match(app, /const \[calculatorOpen, setCalculatorOpen\] = useState\(false\)/);
  assert.match(app, /ref=\{calculatorTriggerRef\}/);
  assert.match(app, /aria-haspopup="dialog" aria-expanded=\{calculatorOpen\}/);
  assert.match(app, /<FinanceOverlay open=\{calculatorOpen\}/);
  assert.match(app, /triggerRef=\{calculatorTriggerRef\}/);
  assert.match(app, /<FinanceCalculatorKeypad/);
  assert.match(app, /onKey=\{pressCalculatorKey\}/);
  assert.match(app, /onEquals=\{previewCalculatorResult\}/);
  assert.match(app, /onFill=\{\(\) => \{ if \(fillCalculation\(\)\) setCalculatorOpen\(false\); \}\}/);
  assert.match(app, /setForm\(\(p\) => \(\{ \.\.\.p, amount: total\.toFixed\(2\) \}\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /"category method"/);
  assert.match(css, /"date note"/);
  assert.match(css, /mh-calc-keypad__keys/);
  assert.match(keypad, /<output className="mh-calc-keypad__expression"/);
  assert.doesNotMatch(keypad, /<textarea|<input/);
  assert.match(keypad, /<button key=\{key\} type="button"/);
});

test("Category dropdown stays clean and custom options and note suggestions remain", () => {
  assert.doesNotMatch(app, /mh-entry-category-chips|Quick category choices/);
  assert.doesNotMatch(css, /mh-entry-category-chips/);
  assert.match(app, /value=\{form\.category\}/);
  assert.match(app, /setForm\(\(previous\) => \(\{ \.\.\.previous, category: value \}\)\)/);
  assert.match(app, /<FinanceQuickNotes records=\{records\} type=\{form\.type\} category=\{form\.category\}/);
  assert.match(app, /<option value=\{ADD_CATEGORY_VALUE\}>/);
  assert.match(app, /<option value=\{DELETE_CATEGORY_VALUE\}>/);
  assert.match(app, /<option value=\{ADD_METHOD_VALUE\}>/);
  assert.match(app, /<option value=\{DELETE_METHOD_VALUE\}>/);
  assert.match(quickNotes, /mostUsedNotes\(records, type, category, 7\)/);
});

test("Sticky mobile Save remains the original submit button, with untouched amount input modes", () => {
  assert.match(app, /onSubmit=\{addRecord\}/);
  assert.match(app, /type="submit" className=\{\x60mh-entry-save/);
  assert.match(css, /\.mh-ui \.mh-entry-save \{[\s\S]*?position: sticky;[\s\S]*?bottom: calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(app, /mh-add-card/);
  assert.doesNotMatch(app, /overflow-hidden \$\{addRecordTheme\.card\}/);
  assert.match(app, /amount: amountEntryMode === "cents" \? formatMoneyTyping\(event\.target\.value\) : event\.target\.value/);
  assert.match(app, /const \[amountEntryMode, setAmountEntryMode\] = useState\("rm"\)/);
  assert.match(app, /value=\{form\.amount === "0\.00" \? "" : form\.amount\}/);
  assert.match(app, /value=\{form\.note\}/);
  assert.match(app, /<DateInput value=\{form\.date\}/);
});
