import test from "node:test";
import assert from "node:assert/strict";
import { parseEditedAmount, splitRecordStatus, loadEveryOwnedRow } from "../src/financeData.js";

test("edited money retains MYR value, not keypad cents", () => {
  for (const [input, wanted] of [
    ["100", 100], ["2500", 2500], ["99.50", 99.5], ["0.01", 0.01],
    ["2500.05", 2500.05], ["1.5", 1.5], [100, 100],
  ]) assert.equal(parseEditedAmount(input), wanted);
  for (const invalid of ["", "0", "0.00", "-1", "abc", "1.234", "1e4", "100,000", "Infinity"]) {
    assert.throws(() => parseEditedAmount(invalid), Error, "Must reject " + invalid);
  }
});

test("deleted rows are excluded while original IDs and amounts are retained", () => {
  const rows = [
    { id: 1, amount: 123, deleted_at: null },
    { id: 2, amount: 45.67, deleted_at: "2026-11-08T12:00:00Z" },
    { id: 3, amount: 0.01, deleted_at: null },
  ];
  const { active, deleted } = splitRecordStatus(rows);
  assert.deepEqual(active.map(r => r.id), [1, 3]);
  assert.deepEqual(deleted.map(r => r.id), [2]);
  assert.equal(deleted[0].amount, 45.67);
});

function fakeClient(rows, overrides = {}) {
  let hits = 0;
  const calls = [];
  return {
    calls,
    from(table) {
      const options = { table, owner: null, head: false, start: 0, end: -1 };
      const query = {
        select(_columns, opts = {}) { options.head = !!opts.head; return this; },
        eq(column, value) {
          if (column === "user_id") options.owner = value;
          return this;
        },
        order(column) {
          assert.equal(column, "id");
          return this;
        },
        async range(start, end) {
          options.start = start; options.end = end;
          calls.push({ table, start, end, owner: options.owner });
          const sorted = rows.filter(row => row.user_id === options.owner)
            .slice().sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
          const data = sorted.slice(start, end + 1);
          return { data, error: null };
        },
        then(ok, fail) {
          hits += 1;
          const count = overrides.count?.(hits) ?? rows.filter(row => row.user_id === options.owner).length;
          return Promise.resolve({ count, error: null }).then(ok, fail);
        },
      };
      return query;
    },
  };
}

test("more than 1000 owned records are loaded in safe 500-row pages", async () => {
  const rows = Array.from({ length: 2501 }, (_, i) => ({ id: i + 1, user_id: "userA", amount: i + 0.01 }));
  rows.push({ id: 7000, user_id: "userB", amount: 900000 });
  const db = fakeClient(rows);
  const progress = [];
  const result = await loadEveryOwnedRow(db, "records", "id,amount", "userA", (loaded, total) => progress.push([loaded,total]));
  assert.equal(result.length, 2501);
  assert.equal(result.at(-1).id, 2501);
  assert.equal(db.calls.length, 6);
  assert.ok(db.calls.every((call) => call.end-call.start < 500 && call.owner === "userA"));
  assert.deepEqual(progress.at(-1), [2501,2501]);
});

test("unstable count never reports a partial finance balance as complete", async () => {
  const rows = Array.from({length:12},(_,i)=>({id:i+1,user_id:"u"}));
  const db = fakeClient(rows,{count:()=>13});
  await assert.rejects(loadEveryOwnedRow(db,"records","id","u"),/changed during synchronization/);
  assert.equal(db.calls.length,3);
});

test("empty tables and explicit user isolation work", async () => {
  const db = fakeClient([{id:1,user_id:"someone-else"}]);
  const got = await loadEveryOwnedRow(db,"transfers","id","current");
  assert.deepEqual(got,[]);
  await assert.rejects(loadEveryOwnedRow(db,"records","id",""),/signed-in user/);
});
