import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../src/"+path, import.meta.url),"utf8");
const main=read("main.jsx"),jsx=read("FinanceRenderDiagnostics.jsx"),css=read("financeRenderDiagnostics.css");
test("isolated opt-in test-only diagnostic not mounted for production or normal Preview",()=>{
  assert.match(main,/isTestEnvironment\s*&&/);
  assert.match(main,/get\("perfLab"\)\s*===\s*"1"/);
  assert.match(main,/showRenderLab\s*&&\s*<FinanceRenderDiagnostics/);
  assert.match(main,/<FinanceVisualizerApp\s*\/>/);
});
test("read-only diagnostics have reversible modes and no financial persistence imports",()=>{
  assert.match(jsx,/document\.documentElement\.dataset\.mhPerfMode\s*=\s*mode/);
  assert.match(jsx,/delete document\.documentElement\.dataset\.mhPerfMode/);
  for(const mode of ["normal","no-blur","no-sticky","no-animation","no-space","no-metal","minimal"]) assert.ok(jsx.includes(mode));
  assert.match(jsx,/addEventListener\("scroll"/);
  assert.match(jsx,/cancelAnimationFrame\(raf\)/);
  assert.doesNotMatch(jsx,/supabase|fetch\(|localStorage|addRecord|updateRecord|deleteRecord|financeCloudService|financeRecords/);
});
test("visual isolation CSS only, never touches data or fields",()=>{
  assert.match(css,/data-mh-perf-mode="no-blur"/);
  assert.match(css,/data-mh-perf-mode="no-space"/);
  assert.match(css,/data-mh-perf-mode="no-metal"/);
  assert.match(css,/backdrop-filter:none!important/);
  assert.doesNotMatch(css,/(?:income|expense)\s*=|supabase|record-id|amount\s*:/i);
});
