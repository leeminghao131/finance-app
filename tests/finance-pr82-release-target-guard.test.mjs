import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyFinanceSupabaseTarget,
  FINANCE_TEST_PROJECT_URL,
  FINANCE_PRODUCTION_PROJECT_URL,
  FINANCE_CANONICAL_PRODUCTION_HOST,
} from "../src/financeSupabaseTarget.js";

const original = FINANCE_CANONICAL_PRODUCTION_HOST;
const previewHost = "finance-preview-example.vercel.app";

function target(vercelEnvironment, hostname, supabaseUrl, hasAnonKey = true) {
  return classifyFinanceSupabaseTarget({
    vercelEnvironment, hostname, supabaseUrl, hasAnonKey,
  });
}

test("Production build at original URL may use only real Production Supabase", () => {
  assert.equal(target("production", original, FINANCE_PRODUCTION_PROJECT_URL), "production");
  assert.equal(target("production", original, FINANCE_TEST_PROJECT_URL), null);
});

test("Production build on Preview deployment hostname must not connect Production", () => {
  assert.equal(target("production", previewHost, FINANCE_PRODUCTION_PROJECT_URL), null);
});

test("Preview build on Preview hostname may use independent TEST Supabase", () => {
  assert.equal(target("preview", previewHost, FINANCE_TEST_PROJECT_URL), "test");
  assert.equal(target("preview", previewHost, FINANCE_PRODUCTION_PROJECT_URL), null);
});

test("Preview and local builds must fail closed at actual Production hostname", () => {
  assert.equal(target("preview", original, FINANCE_TEST_PROJECT_URL), null);
  assert.equal(target("development", original, FINANCE_TEST_PROJECT_URL), null);
  assert.equal(target("preview", original, FINANCE_PRODUCTION_PROJECT_URL), null);
});

test("Local browser with test config connects TEST only", () => {
  assert.equal(target("development", "localhost", FINANCE_TEST_PROJECT_URL), "test");
  assert.equal(target("development", "localhost", FINANCE_PRODUCTION_PROJECT_URL), null);
});

test("Unknown build target must never connect a database", () => {
  for (const env of [null, undefined, "", "staging", "custom", "non-production"]) {
    assert.equal(target(env, previewHost, FINANCE_TEST_PROJECT_URL), null);
    assert.equal(target(env, original, FINANCE_PRODUCTION_PROJECT_URL), null);
  }
});

test("Missing anon API key blocks both database targets", () => {
  assert.equal(target("preview", previewHost, FINANCE_TEST_PROJECT_URL, false), null);
  assert.equal(target("production", original, FINANCE_PRODUCTION_PROJECT_URL, false), null);
});

test("Wrong HTTP endpoint, trailing slash or malformed input fails closed", () => {
  assert.equal(target("production", original, FINANCE_PRODUCTION_PROJECT_URL + "/"), null);
  assert.equal(target("production", original, FINANCE_PRODUCTION_PROJECT_URL.replace("https:", "http:")), null);
  assert.equal(target("preview", previewHost, "https://malicious.invalid"), null);
  assert.equal(target("preview", previewHost, null), null);
});

test("Official hostname comparison is case-insensitive but exact", () => {
  assert.equal(target("production", original.toUpperCase(), FINANCE_PRODUCTION_PROJECT_URL), "production");
  assert.equal(target("production", "subdomain." + original, FINANCE_PRODUCTION_PROJECT_URL), null);
});

test("No side effects: repeated target selection returns identical result", () => {
  assert.equal(target("preview", previewHost, FINANCE_TEST_PROJECT_URL), target("preview", previewHost, FINANCE_TEST_PROJECT_URL));
});
