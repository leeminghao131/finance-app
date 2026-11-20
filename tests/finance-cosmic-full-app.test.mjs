import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const app=read("App.jsx"),overlay=read("FinanceOverlay.jsx");
const core=read("financeCosmicWholeApp.css");
const modules=read("financeCosmicModules.css");
const dialogs=read("financeCosmicDialogs.css");
const charts=read("financeCosmicCharts.css");

test("whole-app palette is opt-in within existing cosmic dashboard only",()=>{
  for(const name of ["financeCosmicWholeApp","financeCosmicModules","financeCosmicDialogs","financeCosmicCharts"])
    assert.ok(app.includes('import "./'+name+'.css";'), "missing CSS import: "+name);
  assert.match(core,/\.mh-ui\.mh-cosmic-pilot/);
  assert.match(core,/--mh-full-green/);
  assert.match(core,/--mh-full-red/);
  assert.match(core,/--mh-full-blue/);
  assert.doesNotMatch(core,/(?:^|\n)\s*(?:html|body|:root)\s*\{/);
});
test("login and portal floating panels styled without changing their event logic",()=>{
  assert.equal((app.match(/className="mh-cosmic-auth min-h-screen/g)||[]).length,2);
  assert.match(overlay,/mh-cosmic-modal-backdrop fixed inset-0/);
  assert.match(overlay,/mh-cosmic-modal-sheet w-full/);
  assert.match(dialogs,/\.mh-cosmic-auth/);
  assert.match(dialogs,/\.mh-cosmic-modal-sheet/);
  assert.match(dialogs,/overscroll-behavior:contain/);
  assert.match(dialogs,/color-scheme:dark/);
  assert.match(dialogs,/@media\(max-width:767px\)/);
  assert.match(overlay,/createPortal\(/);
  assert.match(overlay,/onCloseRef\.current/);
});
test("every requested finance area receives visual coverage",()=>{
  for(const name of [
    "mh-add-card","mh-analysis-filter","mh-dashboard-today",
    "mh-record-card","mh-transfer-console","mh-cosmic-top5",
    "mh-category-picker","mh-insights-dock","mh-rule-assistant",
    "mh-stage2-notifications"
  ]) assert.ok(modules.includes(name)||core.includes(name),"missing module "+name);
  for(const name of ["CSV Import Preview","Savings Goal Editor","bg-red-50","bg-green-50","table","input","select"])
    assert.ok(dialogs.includes(name),"missing floating interface "+name);
  assert.match(charts,/\.recharts-cartesian-axis-tick/);
  assert.match(charts,/\.recharts-default-tooltip/);
  assert.match(charts,/\.recharts-cartesian-grid/);
});
test("performance guard: no new filtered SVG backgrounds, infinite animation or fixed art",()=>{
  for(const css of [core,modules,dialogs,charts]){
    assert.doesNotMatch(css,/feTurbulence|feGaussianBlur|@keyframes|animation:\s*[^;]*infinite/i);
    assert.doesNotMatch(css,/background-attachment:\s*fixed|backdrop-filter:\s*blur\(/i);
    assert.doesNotMatch(css,/https?:\/\/|@import|!important\s*;\s*transform/);
  }
  assert.match(dialogs,/financeCosmicDeepSpaceStatic\.svg/);
  assert.match(core,/backdrop-filter:none/);
});
test("money display semantics and field focus retained",()=>{
  assert.match(core,/mh-full-green:#84e3c4/);
  assert.match(core,/mh-full-red:#ffaba3/);
  assert.match(core,/focus-visible/);
  assert.match(dialogs,/mh-cosmic-modal-sheet :is\(input,select,textarea,button\):focus-visible/);
  assert.doesNotMatch(core+modules+dialogs+charts,/saveBudgets|loadCloudData|deleteRecord|updateRecord|addRecord|importCsv|onSubmit\s*=/);
});