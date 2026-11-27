import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/financeDesktopMaterialBudget.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("desktop material optimization is isolated to mouse and large-screen viewports", () => {
  assert.match(css, /@media \(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden|pointer-events:\s*none/);
  assert.doesNotMatch(css, /\.mh-ui\s+\*\s*\{/);
});

test("existing mobile visuals, brass nine-slice frames and buttons are untouched", () => {
  assert.match(css, /\.mh-ui\.mh-cosmic-pilot\s*\{[\s\S]*?background-image:\s*none/);
  assert.match(css, /\.mh-dashboard-header/);
  assert.match(css, /\.mh-dashboard-today__metric/);
  assert.match(css, /\.mh-transfer-console::before/);
  assert.match(css, /\.mh-cosmic-top5__record/);
  assert.doesNotMatch(css, /border-image|border-radius\s*:|button\s*\{/);
});

test("fix is CSS-only and does not touch financial records, auth or sync", () => {
  assert.match(app, /import "\.\/financeDesktopMaterialBudget\.css"/);
  assert.doesNotMatch(css, /supabase|\baddRecord\b|\bupdateRecord\b|\bdeleteRecord\b|\bloadCloudData\b|\bimportCsv\b|\bsaveBudgets\b/);
});

test("temporary Preview debug code is not referenced by the release entrypoint", () => {
  const entry = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const language = readFileSync(new URL("../src/FinanceLanguageLayer.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(entry, /financePerformanceDiagnostic|startFinancePreviewFrameMonitor|mh_perf/);
  assert.doesNotMatch(language, /financePerformanceDiagnostic|financePerformanceSkipsTranslation/);
});
