import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = file => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
const app = src("App.jsx");
const css = src("financeCosmicPremium.css");
const deepSpace = src("financeCosmicDeepSpace.svg");
const frame = src("financeOrnateBrassFrame.svg");
const steel = src("financeHammeredSteel.svg");
const transfer = src("FinanceTransferPanel.jsx");
const bell = src("FinanceStage2Hub.jsx");
const assistant = src("FinanceRuleAssistant.jsx");

test("Premium theme remains isolated and solely visual", () => {
  assert.match(app, /import "\.\/financeCosmicPilot\.css";\s*import "\.\/financeCosmicPremium\.css";/);
  assert.match(app, /className="mh-ui mh-cosmic-pilot min-h-screen/);
  assert.match(css, /\.mh-ui\.mh-cosmic-pilot \{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:html|body|:root)\s*\{/);
  assert.doesNotMatch(css, /https?:\/\/|@import|position:\s*fixed.*important/i);
  assert.doesNotMatch(css, /(?:#|\.)(?:addRecord|updateRecord|deleteRecord|saveBudgets|loadCloudData)/);
});

test("Heavy brass frame is genuine scalable 9-slice ornament, not a flat 1px stroke", () => {
  assert.match(css, /border-image-source:\s*url\("\.\/financeOrnateBrassFrame\.svg"\)/);
  assert.match(css, /border-image-slice:\s*70/);
  assert.match(css, /border-image-width:\s*25px/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(frame, /<linearGradient id="trim"/);
  assert.match(frame, /<radialGradient id="rivet"/);
  assert.match(frame, /End-capped rail brackets/);
  assert.match(frame, /scale\(-1/);
  assert.match(css, /inset 0 0 0 4px/);
  assert.match(css, /box-shadow:[\s\S]*?inset 0/);
});

test("Real layered space scenery and hammered steel are static local SVG assets", () => {
  for (const svg of [deepSpace, frame, steel]) {
    assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /<script|<animate|<foreignObject|onload=|(?:xlink:)?href=/i);
  }
  assert.match(deepSpace, /nebulaBlur/);
  assert.match(deepSpace, /planetSurface/);
  assert.match(deepSpace, /Orbital \/ brass astrolabe/);
  assert.match(deepSpace, /Large cropped Earth-like planet/);
  assert.match(deepSpace, /filter="url\(#nebulaBlur\)"/);
  assert.match(steel, /feTurbulence/);
  assert.match(css, /financeCosmicDeepSpaceStatic\.svg/);
  assert.match(css, /financeHammeredSteelGrain\.png/);
  assert.match(css, /background-attachment:\s*scroll/);
});

test("Header, Transfer, Heatmap, Top5 and icon launchers share one metal system", () => {
  for (const name of [
    "mh-dashboard-header", "mh-dashboard-today__metric",
    "mh-dashboard-quick-actions", "mh-transfer-console", "mh-transfer-orbit",
    "mh-cosmic-panel", "mh-cosmic-heatmap", "mh-cosmic-heat__day",
    "mh-cosmic-top5", "mh-cosmic-top5__record",
    "mh-stage2-notifications__bell", "mh-rule-assistant__launcher",
  ]) {
    assert.ok(css.includes(name), "missing shared theme component: " + name);
  }
  assert.match(app, /<Card className="mh-cosmic-panel mh-cosmic-heatmap">/);
  assert.match(app, /<Card className="mh-cosmic-panel mh-cosmic-top5">/);
  assert.match(app, /className="mh-cosmic-top5__amount/);
  assert.match(app, /className="mh-cosmic-top5__name/);
  assert.match(app, /className="mh-cosmic-top5__rank/);
  assert.match(css, /mh-dashboard-today__metric--income strong/);
  assert.match(css, /mh-dashboard-today__metric--expense strong/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("Heatmap still uses real daily amounts and ranking still uses real records", () => {
  assert.match(app, /const max=visibleDays\.reduce\(\(largest,day\)=>Math\.max\(largest,day\.amount\|\|0\),1\)/);
  assert.match(app, /const intensity=d\.amount>0\?0\.18\+\(d\.amount\/max\)\*0\.72:0\.06/);
  assert.match(app, /"--mh-day-intensity":intensity/);
  assert.match(app, /d\.amount>0\?money\(d\.amount\)\.replace\("MYR","RM"\):"–"/);
  assert.match(app, /records\.map\(\(record, index\) =>/);
  assert.match(app, /formatCategoryLabel\(record\.category\)\}\s*· \{recordMethod\(record\)\}/);
  assert.match(app, /money\(record\.amount\)/);
  assert.match(app, /disabled=\{lockedCategory\}/);
  assert.match(app, /onChange=\{\(event\) => setCategory\(event\.target\.value\)\}/);
  assert.match(transfer, /<form onSubmit=\{onTransfer\}/);
  assert.match(transfer, /<FinanceTransferCorners methods=\{methodOptions\}/);
  assert.match(bell, /<FinanceNotificationEmblem active=\{alertCount>0\}/);
  assert.match(assistant, /<FinanceAssistantEmblem \/>/);
  assert.doesNotMatch(css, /\.mh-cosmic-pilot\s+\.mh-calc-keypad/);
});
