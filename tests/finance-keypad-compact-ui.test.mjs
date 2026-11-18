import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { nextCalculatorText } from "../src/financeCalculatorKeypad.js";

const src = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = src("App.jsx");
const component = src("FinanceCalculatorKeypad.jsx");
const css = src("financeUi.css");

function keys(sequence) {
  return sequence.reduce((text, key) => nextCalculatorText(text, key), "");
}
function originalCalculator() {
  const first = app.indexOf("function calculate(text) {");
  const last = app.indexOf("\n}", first);
  assert.ok(first > -1 && last > first);
  return vm.runInNewContext(app.slice(first, last + 2) + "\ncalculate", {}, { timeout: 1000 });
}

test("keypad buttons create normal RM arithmetic, including decimals, parentheses and multiplication", () => {
  const calculate = originalCalculator();
  assert.equal(keys(["1","0","0","+","5","0"]), "100+50");
  assert.equal(calculate(keys(["1","0","0","+","5","0"])), 150);
  assert.equal(calculate(keys(["2","4",".","5","5","+","1","0"])), 34.55);
  assert.equal(calculate(keys(["(","2","+","3",")","×","5",".","4","0"])), 27);
  assert.equal(calculate(keys(["3","÷","4"])), 0.75);
  assert.equal(calculate(keys(["2","×","0",".","0","1"])), 0.02);
  assert.equal(calculate(keys(["1","0","0","-","5","5"])), 45);
});

test("keypad offers AC, backspace, decimals and guarded expression building", () => {
  assert.equal(keys(["1","2","DEL"]), "1");
  assert.equal(keys(["1","2","AC"]), "");
  assert.equal(keys([".","2"]), "0.2");
  assert.equal(keys(["1",".","2",".","3"]), "1.23");
  assert.equal(keys(["1","+","×","2"]), "1×2");
  assert.equal(nextCalculatorText("", ")"), "");
  assert.equal(nextCalculatorText("1", "("), "1");
  assert.equal(keys(["(","1","+","2",")"]), "(1+2)");
  assert.equal(nextCalculatorText("123", "<script>"), "123");
  assert.equal(nextCalculatorText("7".repeat(100), "8"), "7".repeat(100));
});

test("native-look modal offers only touchable numeric keys and uses existing finance callback", () => {
  assert.match(component, /const ROWS =/);
  for(const key of ["AC","DEL","7","8","9","÷","4","5","6","×","1","2","3","-","0",".","=","+","(",")"]) {
    assert.ok(component.includes('key:"'+key+'"'), "Missing keypad key "+key);
  }
  assert.match(component, /type="button"/);
  assert.match(component, /onClick=\{\(\) => key === "=" \? onEquals\(\) : onKey\(key\)\}/);
  assert.match(component, /onClick=\{onFill\}/);
  assert.doesNotMatch(component, /<textarea|<input/);
  assert.match(app, /function fillCalculation\(\)/);
  assert.match(app, /const total = calculate\(calculationText\)/);
  assert.match(app, /amount: total\.toFixed\(2\)/);
  assert.match(app, /onFill=\{\(\) => \{ if \(fillCalculation\(\)\) setCalculatorOpen\(false\); \}\}/);
  assert.match(app, /disabled=\{fxCurrency !== "MYR"\}/);
  assert.match(css, /mh-calc-keypad__screen/);
  assert.match(css, /mh-calc-keypad__keys/);
  assert.match(css, /mh-calc-keypad__fill/);
});

test("both-size form fields share rows; no inline keyboard or currency default-expansion", () => {
  assert.match(css, /\.mh-ui \.mh-add-form \{[\s\S]*?display: grid;/);
  assert.match(css, /"category method"/);
  assert.match(css, /"date note"/);
  assert.match(css, /"tools tools"/);
  assert.match(css, /\.mh-ui \.mh-entry-tools \.mh-entry-tool-content--closed \{[\s\S]*?display: none !important;/);
  assert.match(app, /className="mh-entry-tools"/);
  assert.doesNotMatch(app, /aria-controls="mh-entry-calculator-panel"/);
  assert.match(app, /<FinanceOverlay open=\{calculatorOpen\}/);
  assert.match(app, /onSubmit=\{addRecord\}/);
});
