import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = file => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
const modal = src("FinanceOverlay.jsx");
const dialogs = src("financeCosmicDialogs.css");
const i18n = src("FinanceLanguageLayer.jsx");
const app = src("App.jsx");
const mobile = src("FinanceMobileRecords.jsx");
const tooltip = src("FinanceTrendSummaryTooltip.jsx");
const surfaces = src("financeCosmicWholeApp.css");

test("Shared modal retains trigger-origin 300ms motion and finance focus/scroll guards", () => {
  assert.match(modal, /FINANCE_MODAL_MOTION_MS = 300/);
  assert.match(modal, /source\.left - modalRect\.left/);
  assert.match(modal, /source\.top - modalRect\.top/);
  assert.match(modal, /source\.width \/ modalRect\.width/);
  assert.match(modal, /source\.height \/ modalRect\.height/);
  assert.match(modal, /direction: open \? "normal" : "reverse"/);
  assert.match(modal, /openDialogStack\.push\(currentDialog\)/);
  assert.match(modal, /acquireBodyScrollLock\(\)/);
  assert.match(modal, /releaseBodyScrollLock\(\)/);
  assert.match(modal, /onCloseRef\.current/);
  assert.match(modal, /setMounted\(false\)/);
  assert.match(modal, /open \? children : lastChildrenRef\.current/);
  assert.match(modal, /createPortal\(/);
});

test("Backdrop fade is composited opacity, not repainted background-color or border radius", () => {
  assert.match(modal, /const backdropMotion = veil\.animate\(\[/);
  assert.match(modal, /\{ opacity: 0 \}/);
  assert.match(modal, /\{ opacity: 1 \}/);
  assert.match(modal, /dialog\.style\.willChange = "transform, opacity"/);
  assert.match(modal, /veil\.style\.willChange = "opacity"/);
  assert.doesNotMatch(modal, /backgroundColor: "rgba\(2, 6, 23/);
  assert.doesNotMatch(modal, /borderRadius: "10px"/);
  assert.match(modal, /<div ref=\{veilRef\} className="mh-cosmic-modal-backdrop__veil" aria-hidden="true" \/>/);
  assert.match(dialogs, /mh-cosmic-modal-backdrop__veil/);
  assert.match(dialogs, /pointer-events: none/);
  assert.match(dialogs, /background: rgba\(2,7,15,\.72\)/);
  assert.match(modal, /prefers-reduced-motion: reduce/);
});

test("Portal text translation coalesces overlapping subtree events without changing language semantics", () => {
  assert.match(i18n, /const addedRoots = new Set\(\)/);
  assert.match(i18n, /const changedText = new Set\(\)/);
  assert.match(i18n, /const changedAttributes = new Map\(\)/);
  assert.match(i18n, /coveredByAddedAncestor/);
  assert.match(i18n, /localizeNode\(root, languageNow\)/);
  assert.match(i18n, /updateTextNode\(node, languageNow\)/);
  assert.match(i18n, /updateAttribute\(element, attribute, languageNow\)/);
  assert.match(i18n, /document\.createTreeWalker\(node, NodeFilter\.SHOW_ELEMENT \| NodeFilter\.SHOW_TEXT\)/);
  assert.match(i18n, /data-i18n-ignore/);
  assert.doesNotMatch(i18n, /node\.value\s*=|element\.value\s*=/);
  assert.match(i18n, /persistFinanceLanguage/);
});

test("Repeated MYR amounts and transaction hover reuse formatters with identical formatting", () => {
  assert.match(app, /const myrCurrencyFormatter = new Intl\.NumberFormat\("en-MY", \{ style: "currency", currency: "MYR" \}\)/);
  assert.match(app, /const money = \(v\) => myrCurrencyFormatter\.format\(Number\(v \|\| 0\)\)/);
  assert.match(mobile, /const recordCurrencyFormatter = new Intl\.NumberFormat\("en-MY", \{ style: "currency", currency: "MYR" \}\)/);
  assert.match(mobile, /const currency = \(amount\) => recordCurrencyFormatter\.format\(Number\(amount \|\| 0\)\)/);
  assert.match(tooltip, /const tooltipCurrencyFormatter = new Intl\.NumberFormat\("en-MY"/);
  assert.match(tooltip, /"RM " \+ tooltipCurrencyFormatter\.format\(Number\(amount\)\)/);
  const fresh = value => new Intl.NumberFormat("en-MY", {style:"currency",currency:"MYR"}).format(Number(value || 0));
  const cachedFormatter = new Intl.NumberFormat("en-MY", {style:"currency",currency:"MYR"});
  for (const value of [null, undefined, "", 0, 1, 24.55, 100, -9.2, "100.00", 1234567.89]) {
    assert.equal(cachedFormatter.format(Number(value || 0)),fresh(value));
  }
});

test("Only offscreen showcases and repeated ledger rows defer painting; preserve interactive chart sizing", () => {
  assert.match(surfaces, /@supports \(content-visibility: auto\)/);
  assert.match(surfaces, /:is\(\.mh-cosmic-top5,\.mh-cosmic-heatmap\)/);
  assert.match(surfaces, /contain-intrinsic-size: auto 500px/);
  assert.match(surfaces, /\.mh-cosmic-modal-sheet \.mh-record-card/);
  assert.match(surfaces, /contain-intrinsic-size: auto 144px/);
  assert.doesNotMatch(surfaces, /content-visibility:\s*hidden/);
  for (const component of ["FinanceNativeChart.jsx", "FinanceNativeMultiSeriesChart.jsx"]) {
    const code = src(component);
    assert.match(code, /ResizeObserver/);
    assert.match(code, /clientWidth/);
  }
});

test("Global performance layer cannot mutate finance records, currency amounts or production settings", () => {
  for (const source of [modal,dialogs,i18n,surfaces]) {
    assert.doesNotMatch(source, /\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bimportCsv\b|\bsaveBudgets\b|\bloadCloudData\b/);
    assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.delete\(|\bTRUNCATE\b|\bDROP TABLE\b/);
  }
  assert.match(app, /const money = \(v\) => myrCurrencyFormatter\.format/);
});
