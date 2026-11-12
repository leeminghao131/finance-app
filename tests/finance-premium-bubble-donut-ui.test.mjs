
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const app = load("App.jsx");
const bubbles = load("FinanceCategoryBubbleChart.jsx");
const donut = load("FinanceMethodDonutChart.jsx");

test("Category chart and Method chart reuse original expense aggregates, never record writers", () => {
  assert.match(app, /<FinanceCategoryBubbleChart data=\{categoryData\}/);
  assert.match(app, /<FinanceMethodDonutChart data=\{methodData\}/);
  assert.match(app, /const categoryData = useMemo\(\(\) => group\(expenseRecords, \(r\) => r.category\)/);
  assert.match(app, /const methodData = useMemo\(\(\) => group\(expenseRecords, \(r\) => recordMethod\(r\)\)/);
  for (const source of [bubbles, donut]) {
    assert.doesNotMatch(source, /\bsupabase\b|\bfetch\(|\.from\(|\.insert\(|\.upsert\(|\.delete\(|\blocalStorage\b/);
    assert.doesNotMatch(source, /\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bimportCsv\b|\bsaveBudgets\b|\bloadCloudData\b/);
  }
});

test("Bubble radii represent shares, with elastic pair and card-boundary collisions", () => {
  assert.match(bubbles, /Math\.sqrt\(item.value \/ total\)/);
  assert.match(bubbles, /a\.radius \+ b\.radius \+ 3 - distance/);
  assert.match(bubbles, /closingSpeed < 0/);
  assert.match(bubbles, /1 \+ 0\.8/);
  assert.match(bubbles, /p\.x < p\.radius \+ 4/);
  assert.match(bubbles, /p\.x > size\.width - p\.radius - 4/);
  assert.match(bubbles, /p\.y < p\.radius \+ 4/);
  assert.match(bubbles, /p\.y > size\.height - p\.radius - 4/);
  assert.match(bubbles, /filter=\{"url\(#" \+ id \+ "softShadow" \+ "\)"\}/);
});

test("Bubble animation is pauseable and supports accessible mobile and desktop interaction", () => {
  assert.match(bubbles, /prefers-reduced-motion: reduce/);
  assert.match(bubbles, /IntersectionObserver/);
  assert.match(bubbles, /ResizeObserver/);
  assert.match(bubbles, /cancelAnimationFrame/);
  assert.match(bubbles, /onMouseEnter/);
  assert.match(bubbles, /onClick=\{\(\) => setSelectedName\(p\.name\)\}/);
  assert.match(bubbles, /aria-label=\{name \+ " "/);
  assert.match(bubbles, /builtInFinanceCategory\(p\.name, language\)/);
  assert.match(bubbles, /money\(active\.value\)/);
});

test("Premium donut shows all method shares and RM amounts on the right at desktop sizes", () => {
  assert.match(donut, /<ResponsiveContainer width="100%" height="100%">/);
  assert.match(donut, /innerRadius=\{67\} outerRadius=\{94\}/);
  assert.match(donut, /cornerRadius=\{7\}/);
  assert.match(donut, /sm:flex-row/);
  assert.match(donut, /sm:grid-cols-1/);
  assert.match(donut, /Total Expense/);
  assert.match(donut, /money\(total\)/);
  assert.match(donut, /100 \* entry.value \/ total/);
  assert.match(donut, /money\(entry.value\)/);
  assert.match(donut, /<button key=\{entry.name\}/);
  assert.match(donut, /METHOD_COLOR/);
});

test("Zero-expense and invalid values produce empty charts rather than incorrect percentages", () => {
  assert.match(bubbles, /Number\.isFinite\(Number\(item.value\)\) && Number\(item.value\) > 0/);
  assert.match(bubbles, /!items.length \|\| total <= 0/);
  assert.match(donut, /Number\.isFinite\(Number\(entry.value\)\) && Number\(entry.value\) > 0/);
  assert.match(donut, /!entries.length \|\| total <= 0/);
});
