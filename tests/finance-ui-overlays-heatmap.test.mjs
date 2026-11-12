import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const app = source("App.jsx");
const overlay = source("FinanceOverlay.jsx");

test("UI: transaction records move to an overlay without losing original fields or actions", () => {
  assert.match(app, /const \[recordsOpen, setRecordsOpen\] = useState\(false\)/);
  assert.match(app, /onClick=\{\(\) => setRecordsOpen\(true\)\}/);
  assert.match(app, /<FinanceOverlay open=\{recordsOpen\} title="Transaction Records"/);
  assert.match(app, /widthClass="max-w-6xl" showTitle=\{false\}/);
  const start = app.indexOf('<FinanceOverlay open={recordsOpen}');
  const end = app.indexOf('</FinanceOverlay>', start);
  assert.ok(start > 0 && end > start);
  const records = app.slice(start, end);
  for (const field of ["Date", "Type", "Category", "Method", "Amount", "Note", "Actions"]) {
    assert.match(records, new RegExp(">" + field + "<"));
  }
  assert.match(records, /toggleDateGroup\(group\.date\)/);
  assert.match(records, /updateRecord\(record\.id, "amount", v\)/);
  assert.match(records, /deleteRecord\(record\.id\)/);
  assert.match(records, /<FinanceMobileRecords/);
  assert.match(records, /Total \(\{filteredRecords\.length\} records\)/);
});

test("UI: Balance Methods opens unchanged breakdown inside its own portal, not in-card", () => {
  const start = app.indexOf("function BalanceCard(");
  const end = app.indexOf("function DateInput(", start);
  const section = app.slice(start, end);
  assert.match(section, /aria-label="Open Method Balance"/);
  assert.match(section, /<FinanceOverlay open=\{open\} title="Method Balance"/);
  assert.match(section, /methodBalances\.map\(\(item\) =>/);
  assert.doesNotMatch(section, /showMethodBreakdown && open &&/);
});

test("UI: heatmap displays complete amount in responsive minimum-width date cells", () => {
  const start = app.indexOf("function HeatmapCard(");
  const end = app.indexOf("function TopExpensesCard(", start);
  const section = app.slice(start, end);
  assert.match(section, /gridTemplateColumns: "repeat\(auto-fit, minmax\(110px, 1fr\)\)"/);
  assert.match(section, /overflowWrap: "anywhere"/);
  assert.match(section, /money\(d\.amount\)/);
  assert.doesNotMatch(section, /className="mt-1 truncate"/);
  assert.match(section, /days\.map\(\(d\) =>/);
});

test("UI: nested records mobile editor only responds to topmost modal keyboard handling", () => {
  assert.match(overlay, /openDialogStack\.push\(currentDialog\)/);
  assert.match(overlay, /openDialogStack\[openDialogStack\.length - 1\] !== currentDialog/);
  assert.match(overlay, /openDialogStack\.splice\(index, 1\)/);
  assert.match(overlay, /showTitle = true/);
  assert.match(overlay, /document\.body\.style\.overflow = previousOverflow/);
});
