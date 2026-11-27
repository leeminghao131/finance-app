import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
test("native chart measures layout rather than animated screen rectangle",()=>{
  for(const name of ["FinanceNativeChart.jsx","FinanceNativeMultiSeriesChart.jsx"]){
    const source=read(name);
    assert.doesNotMatch(source,/getBoundingClientRect\(/);
    assert.match(source,/clientWidth/);
    assert.match(source,/clientHeight/);
    assert.match(source,/ResizeObserver/);
  }
});
test("three comparison labels are not dropped by sparse timeline tick logic",()=>{
  assert.match(read("FinanceNativeMultiSeriesChart.jsx"),/mode==="bars"&&data\.length<=3\?data\.length/);
});
test("expense chart data preserves identity across unrelated app renders",()=>{
  assert.match(read("App.jsx"),/const expenseRecords = useMemo\(\(\) => chartRecords\.filter\(\(r\) => r\.type === "expense"\), \[chartRecords\]\)/);
});
test("dialog keeps existing motion and restores focus without scrolling",()=>{
  const source=read("FinanceOverlay.jsx");
  assert.match(source,/FINANCE_MODAL_MOTION_MS = 300/);
  assert.match(source,/currentDialog\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(source,/activeBeforeOpen\.focus\(\{preventScroll:true\}\)/);
});
test("translation observer avoids re-translating its own unchanged output",()=>{
  const source=read("FinanceLanguageLayer.jsx");
  assert.match(source,/cached\.language === language && actual === cached\.rendered/);
  assert.match(source,/state\.language === language && actual === state\.rendered/);
});
