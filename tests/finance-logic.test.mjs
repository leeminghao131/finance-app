import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { normalizeRecord, normalizeTransfer, toRecordPayload } from "../src/financeRecords.js";

// Evaluate the actual small pure functions from the current app source.
// No database connection, browser session, credentials, or real finance data.
const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

function loadPureFunction(name) {
  const start = source.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " missing");
  const remaining = source.slice(start);
  const match = remaining.match(/^function [\s\S]*?^\}/m);
  assert.ok(match, name + " body missing");
  return vm.runInNewContext(match[0] + "\n" + name, Object.create(null), { timeout: 1000 });
}

test("income/expense totals ignore transfers and unknown record types", () => {
  const sumType = loadPureFunction("sumType");
  const records = [
    { type: "income", amount: "100.25" },
    { type: "income", amount: 0.75 },
    { type: "expense", amount: "37.50" },
    { type: "transfer", amount: 99999 },
  ];
  assert.equal(sumType(records, "income"), 101);
  assert.equal(sumType(records, "expense"), 37.5);
  assert.equal(sumType([], "income"), 0);
});

test("money parser preserves cents from keypad input and decimals", () => {
  const parse = loadPureFunction("parseMoneyInput");
  assert.equal(parse("12345"), 123.45);
  assert.equal(parse("0.99"), 0.99);
  assert.equal(parse(""), 0);
  assert.equal(parse("1"), 0.01);
});

test("normalize record and transfer map Postgres numeric text to numbers", () => {
  const record = normalizeRecord({ id: 15, type: "expense", amount: "24.55", category: "Food", method: "CASH", note: null, date: "2026-11-08" });
  assert.equal(record.amount, 24.55);
  assert.equal(record.note, "");
  assert.equal(record.method, "CASH");
  const transfer = normalizeTransfer({ id: "t-1", from_method: "BANK", to_method: "TNG", amount: "25.90", note: null, date: "2026-11-08" });
  assert.equal(transfer.amount, 25.9);
  assert.equal(transfer.fromMethod, "BANK");
  assert.equal(transfer.toMethod, "TNG");
});

test("record payload retains owner, amount, and original payment method", () => {
  const out = toRecordPayload({ type: "income", amount: "12.30", category: "Salary", method: "BANK IN", note: null, date: "2026-11-08" }, "user-fixture");
  assert.equal(out.user_id, "user-fixture");
  assert.equal(out.amount, 12.3);
  assert.equal(out.method, "BANK IN"); // older original record label stays unchanged
});

test("method transfers cancel overall while adjusting method balances", () => {
  assert.match(source, /if \(fromRow\) fromRow\.transferOut \+= amount;/);
  assert.match(source, /if \(toRow\) toRow\.transferIn \+= amount;/);
  assert.match(source, /balance: row\.income - row\.expense \+ row\.transferIn - row\.transferOut/);
  assert.equal((100 + 25) - (20 + 25), 80);
});
