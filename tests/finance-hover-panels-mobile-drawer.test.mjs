import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const notifications=read("FinanceStage2Hub.jsx");
const assistant=read("FinanceRuleAssistant.jsx");
const dock=read("FinanceInsightsDock.jsx");
const css=read("financeUi.css");

test("Bell opens on desktop mouse hover, stays open across its panel and closes on leaving",()=>{
  assert.match(notifications,/const hoverCloseTimerRef=useRef\(null\)/);
  assert.match(notifications,/event\.pointerType==="mouse"/);
  assert.match(notifications,/\(hover: hover\) and \(pointer: fine\)/);
  assert.match(notifications,/const hoverOpen=event=>/);
  assert.match(notifications,/setMenu\(true\)/);
  assert.match(notifications,/onPointerEnter=\{hoverOpen\}/);
  assert.match(notifications,/onPointerLeave=\{hoverLeave\}/);
  assert.match(notifications,/onPointerEnter=\{event=>\{if\(isDesktopHover\(event\)\)cancelHoverClose\(\);\}\}/);
  assert.match(notifications,/setMenu\(false\)/);
  assert.match(notifications,/window\.setTimeout\(\(\)=>\{/);
  assert.match(notifications,/\,150\)/);
  assert.match(notifications,/window\.clearTimeout\(hoverCloseTimerRef\.current\)/);
  assert.match(notifications,/event\.nativeEvent\?\.pointerType==="touch"/);
  assert.match(notifications,/setMenu\(value=>!value\)/);
  assert.match(notifications,/data-menu-open=\{menu\?"true":"false"\}/);
  assert.match(css,/\.mh-stage2-notifications\[data-menu-open="true"\] \{ pointer-events: auto; \}/);
  assert.match(notifications,/onClick=\{e=>open\(item\.type,item\.ref,e\.currentTarget\)\}/);
  assert.match(notifications,/onConfirmPayment=\{onConfirmBillPayment\}/);
  assert.match(notifications,/onSave=\{onSaveReview\}/);
});

test("Assistant opens on mouse hover and remains while hovering its question panel",()=>{
  assert.match(assistant,/const hoverCloseTimerRef=useRef\(null\)/);
  assert.match(assistant,/event\.pointerType==="mouse"/);
  assert.match(assistant,/const handleHoverOpen=event=>/);
  assert.match(assistant,/onPointerLeave=\{handleHoverLeave\}/);
  assert.match(assistant,/onPointerEnter=\{handleHoverOpen\}/);
  assert.match(assistant,/onPointerEnter=\{event=>\{if\(desktopHover\(event\)\)clearHoverClose\(\);\}\}/);
  assert.match(assistant,/window\.setTimeout\(\(\)=>\{/);
  assert.match(assistant,/setOpen\(false\)/);
  assert.match(assistant,/\,150\)/);
  assert.match(assistant,/window\.clearTimeout\(hoverCloseTimerRef\.current\)/);
  assert.match(assistant,/setOpen\(value=>!value\)/);
  assert.match(assistant,/ASSISTANT_SUGGESTIONS\.map/);
  assert.match(assistant,/answerFinanceQuestion\(question,ctx,zh\)/);
  assert.match(assistant,/onOpenTool\(entry\.reply\.action,trigger\.current\)/);
  assert.doesNotMatch(assistant,/\bsupabase\b|\.insert\(|\.update\(|\.upsert\(/);
});

test("Mobile drawer has a top-left accessible launcher and NEVER exposes the old 34px edge",()=>{
  assert.match(dock,/className="mh-insights-dock__mobile-launcher"/);
  assert.match(dock,/aria-controls="mh-insights-dock-panel"/);
  assert.match(dock,/id="mh-insights-dock-panel"/);
  assert.match(dock,/onClick=\{\(\)=>\{setSuppressHover\(false\);setExpanded\(true\);\}\}/);
  assert.match(dock,/className="mh-insights-dock__toggle"/);
  assert.match(dock,/className="mh-insights-dock__outside"/);
  assert.match(dock,/beginLongPress\(e,id\)/);
  assert.match(dock,/saveDockOrder\(userId,orderRef\.current\)/);
  assert.match(css,/\.mh-insights-dock__mobile-launcher \{ display: none; \}/);
  assert.match(css,/@media \(max-width: 767px\) \{[\s\S]*?\.mh-insights-dock__mobile-launcher \{[\s\S]*?position: fixed;[\s\S]*?top: calc\(env\(safe-area-inset-top, 0px\) \+ 72px\);/);
  assert.match(css,/\.mh-insights-dock,\s*\.mh-insights-dock:focus-within,\s*\.mh-insights-dock\[data-suppress-hover="true"\] \{[\s\S]*?translate3d\(-110%, -50%, 0\) !important;[\s\S]*?visibility: hidden;/);
  assert.match(css,/\.mh-insights-dock\[data-expanded="true"\] \{[\s\S]*?translate3d\(0, -50%, 0\) !important;[\s\S]*?visibility: visible;/);
  assert.match(css,/@media \(hover:hover\) and \(pointer:fine\) \{[\s\S]*?\.mh-insights-dock:hover/);
});

test("Hover/drawer UI code does not affect money writers, Supabase or notification data services",()=>{
  for(const source of [assistant,dock,css]){
    assert.doesNotMatch(source,/\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bimportCsv\b|\bsaveBudgets\b|\bloadCloudData\b|\.from\("records"\)/);
  }
  assert.match(notifications,/billOccurrences\(bills,today,records,70,35\)/);
  assert.match(notifications,/findReviewCandidates\(records,reviewState,today\)/);
  assert.match(dock,/onOpenStage2Tool\("accounts",e\.currentTarget\)/);
  assert.match(dock,/onOpenStage2Tool\("review",e\.currentTarget\)/);
});
