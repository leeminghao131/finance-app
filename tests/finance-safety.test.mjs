import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/supabaseClient.js", import.meta.url), "utf8");

test("Supabase client uses deployment environment variables instead of embedded credentials", () => {
  assert.match(client, /import\.meta\.env\.VITE_SUPABASE_URL/);
  assert.match(client, /import\.meta\.env\.VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(client, /sb_secret_|service_role/i);
  assert.doesNotMatch(client, /https:\/\/[a-z0-9]{20}\.supabase\.co/i);
});

test("App retains authentication and cloud tables", () => {
  assert.match(app, /supabase\.auth\.getSession\(/);
  assert.match(app, /supabase\.auth\.onAuthStateChange\(/);
  for (const table of ["records", "transfers", "user_settings"]) {
    assert.ok(app.includes('.from("' + table + '")'), 'Cloud table missing: ' + table);
  }
  assert.match(app, /if\s*\(!session\)/);
});

test("Balance method alias normalization preserves historical method meaning", () => {
  const fn = app.match(/function normalizeMethodForBalance\(method\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fn, "normalizeMethodForBalance function missing");
  const normalize = vm.runInNewContext(fn[0] + "\nnormalizeMethodForBalance", Object.create(null), { timeout: 1000 });
  for (const old of ["BANK IN", "ONLINE BANK IN", "DEBIT CARD", "BANK"]) {
    assert.equal(normalize(old), "BANK");
  }
  for (const kept of ["TNG", "CASH", "GRAB PAY"]) {
    assert.equal(normalize(kept), kept);
  }
});

test("Record and transfer writes retain explicit user ownership", () => {
  assert.match(app, /user_id:\s*user\.id/);
  assert.match(app, /\.from\("records"\)\s*\.insert\(/);
  assert.match(app, /\.from\("transfers"\)\s*\.insert\(/);
});

test("Record edits and soft deletes require owner and optimistic version checks", () => {
  assert.match(app, /async function updateRecord\(recordId, field, value\)/);
  assert.match(app, /async function deleteRecord\(recordId\)/);
  assert.match(app, /async function restoreRecord\(recordId\)/);
  assert.match(app, /parseEditedAmount\(value\)/);
  assert.match(app, /\.eq\("version", current\.version\)/);
  assert.match(app, /\.eq\("user_id", user\.id\)/);
  assert.match(app, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(app, /\.update\(\{ deleted_at: null \}\)/);
  assert.doesNotMatch(app, /\.from\("records"\)\s*\.delete\(/);
  assert.match(app, /deleteConfirm === record\.id/);
});

test("Realtime, count-checked paging and recycle bin remain enabled", () => {
  assert.match(app, /channel\.on\("postgres_changes"/);
  assert.match(app, /fetchFinanceSnapshot\(/);
  const cloud = readFileSync(new URL("../src/financeCloudService.js", import.meta.url), "utf8");
  assert.match(cloud, /loadEveryOwnedRow\(/);
  assert.match(cloud, /splitRecordStatus\(/);
  assert.match(app, /Recycle Bin/);
  assert.match(app, /setUndoDeleted\(removed\)/);
});

test("This preview build fails closed instead of connecting to production Supabase", () => {
  assert.match(client, /SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby"/);
  assert.match(client, /isTestEnvironment = supabaseUrl === requiredSandboxUrl/);
  assert.match(client, /hasSupabaseEnv = Boolean\(isTestEnvironment && supabaseAnonKey\)/);
  assert.match(app, /TEST MODE \/ 测试环境/);
});
