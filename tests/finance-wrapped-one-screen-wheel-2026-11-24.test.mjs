import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const story=read("FinanceWrapped.jsx");
const wheel=read("FinanceWrappedWheelPager.jsx");
const deck=read("FinanceWrappedSceneDeck.jsx");
const css=read("financeWrappedCinematic.css");
const overlay=read("FinanceOverlay.jsx");

test("Wrapped uses a one-viewport modal without modifying the shared FinanceOverlay",()=>{
  assert.match(story,/FinanceWrappedWheelPager/);
  assert.match(story,/FinanceWrappedSceneDeck/);
  assert.match(css,/\.mh-cosmic-modal-sheet:has\(\.mh-wrap\)/);
  assert.match(css,/height:min\(860px, calc\(100dvh - 12px\)\) !important/);
  assert.match(css,/\.mh-cosmic-modal-sheet \.mh-wrap-shell \{\s*flex:1 1 0;/);
  assert.match(css,/\.mh-cosmic-modal-sheet \.mh-wrap-stage \{\s*flex:1 1 0;/);
  assert.match(css,/\.mh-wrap-deck \{\s*position:relative;\s*height:100%/);
  assert.match(css,/overflow:hidden !important/);
  assert.match(overlay,/overflow-y-auto rounded-2xl bg-white/);
  assert.doesNotMatch(overlay,/mh-wrap/);
});

test("Wheel navigation is local to the modal, non-passive and prevents unwanted page scroll",()=>{
  assert.match(wheel,/root\.addEventListener\("wheel", wheel, \{ passive: false \}\)/);
  assert.match(wheel,/root\.removeEventListener\("wheel", wheel\)/);
  assert.match(wheel,/event\.preventDefault\(\)/);
  assert.match(wheel,/event\.ctrlKey \|\| event\.metaKey/);
  assert.match(wheel,/\.mh-wrap-details\[open\], select, input, textarea/);
  assert.match(wheel,/now - lastNavigationTime < 440/);
  assert.match(wheel,/Math\.abs\(accumulated\) < 40/);
  assert.match(story,/setSlide\(index=>Math\.max\(0,Math\.min\(slides.length-1,index\+direction\)\)\)/);
  assert.doesNotMatch(wheel,/document\.addEventListener|window\.addEventListener|supabase|\.insert\(|\.update\(|\.delete\(/);
});

test("Wrapped navigates with one rendered scene and a lightweight directional transition",()=>{
  assert.match(deck,/import React, \{ memo, useRef \}/);
  assert.match(deck,/chapter < previousRef\.current\.chapter \? "back" : "forward"/);
  assert.match(deck,/export default memo\(FinanceWrappedSceneDeck\)/);
  assert.equal((deck.match(/<FinanceWrappedStage /g)||[]).length,1);
  assert.doesNotMatch(deck,/departure|setDeparture|useLayoutEffect|setTimeout|out-forward|out-back/);
  assert.match(css,/mh-wrap-deck__page--in-forward/);
  assert.match(css,/mh-wrap-deck__page--in-back/);
  assert.match(css,/@keyframes mh-wrap-theater-in-next/);
  assert.match(css,/@keyframes mh-wrap-theater-in-back/);
  assert.doesNotMatch(css,/@keyframes mh-wrap-theater-out/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(deck,/supabase|localStorage|sessionStorage|fetch\(|\.insert\(|\.delete\(/);
});

test("Original detailed statistics are accessible in an inset scrollable layer",()=>{
  assert.match(story,/<details className="mh-wrap-details">/);
  assert.match(story,/slides\[slide\]\.body/);
  assert.match(css,/\.mh-cosmic-modal-sheet \.mh-wrap-details\[open\] \{\s*position:absolute;\s*inset:0;/);
  assert.match(css,/\.mh-cosmic-modal-sheet \.mh-wrap-details\[open\] \.mh-wrap-details__body \{\s*flex:1 1 0;\s*min-height:0;\s*overflow-y:auto/);
});

test("Money calculations, privacy and exports stay in their original component",()=>{
  assert.match(story,/financeWrapped\(records,\{mode,month,quarterStart,year,monthRows,budgetTemplate\}\)/);
  assert.match(story,/activitySummary\(selected,records,activityLinks\)/);
  assert.match(story,/exportStoryImage\(w,hideAmounts\)/);
  assert.match(story,/const display=useCallback\(n=>hideAmounts\?"RM ••••":money\(n\),\[hideAmounts\]\)/);
  assert.match(story,/hideNotes=\{hideNotes\}/);
  assert.match(story,/onTouchStart=/);
  assert.match(story,/onTouchEnd=/);
  assert.match(story,/ArrowRight/);
  assert.match(story,/ArrowLeft/);
  assert.match(story,/setPlaying\(value=>!value\)/);
});
