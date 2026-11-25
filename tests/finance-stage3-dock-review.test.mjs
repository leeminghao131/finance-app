import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FINANCE_DOCK_IDS,normalizeDockOrder,moveDockItem,readDockOrder,saveDockOrder} from "../src/financeDockOrder.js";
const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("drawer order retains all eleven tools, ignores duplicates/obsolete IDs and reorders safely",()=>{
  assert.equal(FINANCE_DOCK_IDS.length,11);
  assert.deepEqual(normalizeDockOrder(["review","review","unknown","activity"]).slice(0,2),["review","activity"]);
  assert.equal(new Set(normalizeDockOrder(["review"])).size,10);
  assert.equal(moveDockItem(FINANCE_DOCK_IDS,"accounts","wrapped")[0],"accounts");
  assert.equal(moveDockItem(FINANCE_DOCK_IDS,"wrapped","accounts").at(-3),"wrapped");
  assert.deepEqual(moveDockItem(FINANCE_DOCK_IDS,"none","wrapped"),[...FINANCE_DOCK_IDS]);
});

test("drawer order persists to account-scoped localStorage only, without Supabase",()=>{
  const map=new Map();
  const storage={getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,val)};
  assert.equal(saveDockOrder("test-user-A",["review","wrapped"],storage),true);
  assert.equal(readDockOrder("test-user-A",storage)[0],"review");
  assert.equal(readDockOrder("test-user-B",storage)[0],"wrapped");
  assert.equal(map.size,1);
  assert.equal(saveDockOrder(null,["review"],storage),false);
  assert.deepEqual(readDockOrder("test-user-A",{getItem:()=>"{invalid-json"}),[...FINANCE_DOCK_IDS]);
});

test("arrow has explicit hover/focus collapse guard; long press swaps slots without triggering launchers",()=>{
  const dock=src("FinanceInsightsDock.jsx"),css=src("financeUi.css");
  assert.match(dock,/setExpanded\(p=>!p\)/);
  assert.match(dock,/data-suppress-hover=\{suppressHover\?"true":"false"\}/);
  assert.match(css,/\.mh-insights-dock\[data-suppress-hover="true"\]/);
  assert.match(dock,/window\.setTimeout\(\(\)=>\{/);
  assert.match(dock,/suppressClickRef\.current=true/);
  assert.match(dock,/saveDockOrder\(userId,orderRef\.current\)/);
  assert.match(dock,/onPointerDown=\{e=>beginLongPress\(e,id\)\}/);
  assert.ok(!dock.includes("supabase.from("));
});

test("Review notification reuses existing soft-delete and never runs direct DELETE SQL",()=>{
  const app=src("App.jsx"),hub=src("FinanceStage2Hub.jsx"),review=src("FinanceReviewInbox.jsx");
  assert.match(app,/onDeleteRecord=\{deleteRecord\}/);
  assert.match(hub,/onDeleteRecord=\{onDeleteRecord\}/);
  assert.match(review,/onClick=\{\(\)=>removeRecord\(c\)\}/);
  assert.match(review,/await onDeleteRecord\(c\.record\.id\)/);
  assert.match(review,/Move this record to Recycle Bin/);
  assert.match(app,/\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.ok(!review.includes('supabase.from('));
});

test("Activity buttons give immediate feedback while preserving versioned cloud save",()=>{
  const panel=src("FinanceActivityPanel.jsx");
  assert.match(panel,/pendingRef\.current=true/);
  assert.match(panel,/busyAction==="paused"/);
  assert.match(panel,/busyAction==="finished"/);
  assert.match(panel,/role="status" aria-live="polite"/);
  assert.match(panel,/onUpdate\(selected,\{status:next\}\)/);
  assert.match(panel,/status\("paused"\)/);
});


test("single import/export tool integrates with drawer order and has split options",()=>{
  const dock=src("FinanceInsightsDock.jsx"),data=src("FinanceDataToolsLauncher.jsx");
  assert.equal(FINANCE_DOCK_IDS.at(-1),"data-tools");
  assert.match(dock,/onOpenDataTool/);
  assert.match(dock,/<FinanceDataToolsLauncher/);
  assert.match(data,/onMouseEnter=\{\(\)=>setOpen\(true\)\}/);
  assert.match(data,/onOpen\(kind,event\.currentTarget\)/);
  assert.match(data,/launch\("import",event\)/);
  assert.match(data,/launch\("export",event\)/);
});
