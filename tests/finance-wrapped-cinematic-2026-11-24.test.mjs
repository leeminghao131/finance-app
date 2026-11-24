import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const story = read("FinanceWrapped.jsx");
const stage = read("FinanceWrappedStage.jsx");
const css = read("financeWrappedCinematic.css");
const calculations = read("financeStage1Analytics.js");
const activity = read("financeActivity.js");

test("Wrapped stays on the existing verified monthly/quarterly/yearly/activity calculations", () => {
  assert.match(story, /const report=useMemo\(/);
  assert.match(story, /financeWrapped\(records,\{mode,month,quarterStart,year,monthRows,budgetTemplate\}\)/);
  assert.match(story, /activitySummary\(selected,records,activityLinks\)/);
  assert.match(story, /const w=report.value,cur=w\?\.current/);
  assert.match(calculations, /export function financeWrapped\(/);
  assert.match(activity, /export function activitySummary\(/);
  assert.match(story, /exportStoryImage\(w,hideAmounts\)/);
  assert.match(story, /canvas\.toBlob/);
  assert.match(story, /const \[hideNotes,setHideNotes\]/);
  assert.match(story, /const \[slide,setSlide\]=useState\(0\),\[hideAmounts,setHideAmounts\]/);
});

test("Cinematic mode offers ten visual scenes and no connection or mutation API", () => {
  assert.match(story, /import FinanceWrappedStage from "\.\/FinanceWrappedStage\.jsx"/);
  assert.match(story, /import "\.\/financeWrappedCinematic\.css"/);
  assert.match(stage, /function OrbitalCrest/);
  assert.match(stage, /function CategoryGalaxy/);
  assert.match(stage, /function PaymentOrbit/);
  assert.match(stage, /function Podium/);
  assert.match(stage, /function NotesConstellation/);
  assert.match(stage, /function Timeline/);
  assert.match(stage, /function BudgetDial/);
  assert.match(stage, /function Changes/);
  assert.match(stage, /case 0:/);
  assert.match(stage, /case 8:/);
  assert.match(stage, /default:/);
  assert.doesNotMatch(stage, /\bsupabase\b|\.insert\(|\.update\(|\.delete\(|fetch\(|localStorage|sessionStorage/);
});

test("Interactive storyboard provides accessible chapter navigation, autoplay, touch and keyboard", () => {
  assert.match(story, /className="mh-wrap-progress"/);
  assert.match(story, /aria-label=\{\(zh\?"跳到第 "/);
  assert.match(story, /setPlaying\(value=>!value\)/);
  assert.match(story, /window\.setTimeout\(\(\)=>setSlide/);
  assert.match(story, /window\.clearTimeout\(timer\)/);
  assert.match(story, /onTouchStart=/);
  assert.match(story, /onTouchEnd=/);
  assert.match(story, /ArrowRight/);
  assert.match(story, /ArrowLeft/);
  assert.match(stage, /onClick=\{\(\) => setChosen\(index\)\}/);
  assert.match(stage, /aria-pressed=/);
  assert.match(stage, /role="group"/);
});

test("New visuals preserve privacy and original detailed slides remain accessible", () => {
  assert.match(story, /hideNotes=\{hideNotes\}/);
  assert.match(story, /display=\{display\}/);
  assert.match(story, /<details className="mh-wrap-details">/);
  assert.match(story, /slides\[slide\]\.body/);
  assert.match(stage, /hideNotes \? "••••" : item\.name/);
  assert.match(stage, /active\.note && !hideNotes/);
  assert.match(story, /hideAmounts\?"RM ••••":money\(n\)/);
  assert.match(stage, /data-i18n-ignore/);
  assert.match(story, /w\?\.disclaimer/);
  assert.match(stage, /budget\.missingMonths > 0/);
});

test("Wrapped CSS is scoped, safe for mobile, and honors reduced-motion", () => {
  assert.match(css, /\.mh-cosmic-modal-sheet \.mh-wrap/);
  assert.match(css, /@keyframes mh-wrap-spin/);
  assert.match(css, /@keyframes mh-wrap-enter/);
  assert.match(css, /@keyframes mh-wrap-rise/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /backdrop-filter:\s*blur|filter:\s*blur|(?:^|\n)\s*:root\s*\{|(?:^|\n)\s*body\s*\{/);
});
