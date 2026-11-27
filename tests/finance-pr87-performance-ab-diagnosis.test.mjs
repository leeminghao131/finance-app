import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveFinancePerformanceMode,
  FINANCE_PRODUCTION_HOST,
  FINANCE_PERF_MODES,
} from "../src/financePerformanceDiagnostic.js";

const testHost = "finance-performance-preview-example.vercel.app";
const mode = (search,tier="preview",hostname=testHost) =>
  resolveFinancePerformanceMode({tier,hostname,search});

test("Only explicitly selected diagnosis modes are enabled on Vercel Preview",()=>{
  for (const selected of FINANCE_PERF_MODES)
    assert.equal(mode("?mh_perf="+selected), selected);
  assert.equal(mode(""),"normal");
  assert.equal(mode("?mh_perf=unknown"),"normal");
  assert.equal(mode("?mh_perf=paint-lite&mh_perf=both"),"paint-lite");
});

test("No diagnostics can activate on original Production host",()=>{
  for (const tier of ["production","preview","development","unknown"]) {
    for (const selected of FINANCE_PERF_MODES)
      assert.equal(mode("?mh_perf="+selected,tier,FINANCE_PRODUCTION_HOST),"normal");
  }
});

test("Non-Preview builds and non-Vercel hosts always ignore flags",()=>{
  for (const tier of ["production","development","unknown",null])
    assert.equal(mode("?mh_perf=both",tier,testHost),"normal");
  assert.equal(resolveFinancePerformanceMode({tier:undefined,hostname:testHost,search:"?mh_perf=both"}),"normal");
  assert.equal(mode("?mh_perf=both","preview","localhost"),"normal");
  assert.equal(mode("?mh_perf=i18n-off","preview","example.com"),"normal");
});

test("Translation DOM scanning can be isolated without changing data or translation words",()=>{
  const layer=readFileSync(new URL("../src/FinanceLanguageLayer.jsx",import.meta.url),"utf8");
  assert.match(layer,/if \(!financePerformanceSkipsTranslation\(\)\) localizeNode\(document\.body, language\)/);
  assert.match(layer,/if \(financePerformanceSkipsTranslation\(\)\) return undefined;/);
  assert.match(layer,/new MutationObserver/);
  assert.match(layer,/observer\.observe\(document\.body/);
  assert.doesNotMatch(layer,/supabase|loadCloudData|addRecord|deleteRecord/);
});

test("Experimental paint reduction only affects opted-in desktop Preview",()=>{
  const css=readFileSync(new URL("../src/financePerformanceDiagnostic.css",import.meta.url),"utf8");
  assert.match(css,/@media \(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css,/data-mh-perf-diag="paint-lite"/);
  assert.match(css,/data-mh-perf-diag="both"/);
  assert.doesNotMatch(css,/display:\s*none\s*!important|visibility:\s*hidden\s*!important/);
});

test("Diagnostic overlay is independent of finance state and enabled only on Preview",()=>{
  const src=readFileSync(new URL("../src/financePerformanceDiagnostic.js",import.meta.url),"utf8");
  const main=readFileSync(new URL("../src/main.jsx",import.meta.url),"utf8");
  assert.match(src,/tier !== "preview"/);
  assert.match(src,/data-i18n-ignore/);
  assert.match(src,/requestAnimationFrame/);
  assert.match(src,/longTasks/);
  assert.doesNotMatch(src,/localStorage|sessionStorage|supabase\.|\.from\(|fetch\(/);
  assert.match(main,/startFinancePreviewFrameMonitor\(\)/);
  assert.match(main,/FinanceVisualizerApp/);
});
