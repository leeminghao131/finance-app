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
  assert.match(app, /<FinanceLanguageButton className="mh-dashboard-action" \/>/);
  assert.match(app, /onClick=\{\(\) => setSoundEnabled\(\(v\) => !v\)\}/);
  assert.match(app, /onClick=\{signOut\}/);
  assert.match(app, /id="mh-dashboard-statistics"/);
  assert.match(app, /id="mh-stage2-add-record-form"/);
  assert.match(app, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(app, /recordsOpenSource === "nav" \? recordsNavTriggerRef : recordsTriggerRef/);
});

test("Only mobile view collapses secondary calculator and currency; FX stays expanded", () => {
  assert.match(app, /const \[currencyToolsOpen, setCurrencyToolsOpen\] = useState\(false\)/);
  assert.match(app, /const \[calculatorOpen, setCalculatorOpen\] = useState\(false\)/);
  assert.match(app, /aria-controls="mh-entry-currency-panel"/);
  assert.match(app, /aria-controls="mh-entry-calculator-panel"/);
  assert.match(app, /currencyToolsOpen \|\| fxCurrency !== "MYR"/);
  assert.match(app, /disabled=\{fxCurrency !== "MYR"\}/);
  assert.match(app, /mh-entry-currency--active/);
  assert.match(app, /<FinanceCurrencyInput date=\{form\.date\} currency=\{fxCurrency\}/);
  assert.match(app, /onForeignAmount=\{setFxForeignAmount\}/);
  assert.match(app, /formatCalculatorTyping\(event\.target\.value\)/);
  assert.match(app, /onClick=\{fillCalculation\}/);
  assert.match(css, /@media \(max-width: 767px\) \{/);
  assert.match(css, /\.mh-ui \.mh-entry-tool-content--closed \{ display: none; \}/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*?display: block !important/);
  assert.match(currency, /getReferenceFxRate\(currency,date,fetch,ctrl\.signal\)/);
});

test("Quick category chips are draft-only and all current methods and note suggestions remain", () => {
  assert.match(app, /className="mh-entry-category-chips"/);
  assert.match(app, /categoryOptionsFor\(form\.type\)\.includes\(category\)/);
  assert.match(app, /setForm\(previous => \(\{ \.\.\.previous, category \}\)\)/);
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
