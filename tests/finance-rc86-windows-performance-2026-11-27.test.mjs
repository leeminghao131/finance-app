import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const effects = readFileSync(new URL("../src/FinanceVisualEffects.jsx", import.meta.url), "utf8");
const desktopCss = readFileSync(new URL("../src/financeDesktopPerformance.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("Windows-only performance CSS imported last; mobile style untouched", () => {
  assert.match(app, /import "\.\/financeDesktopPerformance\.css"/);
  assert.match(desktopCss, /@media \(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.doesNotMatch(desktopCss, /display:\s*none|visibility:\s*hidden|pointer-events:\s*none/);
  assert.match(desktopCss, /\.mh-dashboard-header\s*\{[\s\S]*?backdrop-filter:\s*none/);
});

test("Heavy decorative animations are frozen only on desktop, interactive fields are untouched", () => {
  assert.match(desktopCss, /\.mh-transfer-orbit__track/);
  assert.match(desktopCss, /\.mh-transfer-orbit__wire/);
  assert.match(desktopCss, /\.mh-steampunk-assistant-emblem__gear/);
  assert.doesNotMatch(desktopCss, /\.mh-(record-input|add-card|currency-input)|\.mh-cosmic-modal-sheet\s*\{/);
});

test("Expense coins remain enabled, mobile retains original 42 items", () => {
  assert.match(effects, /desktopLite \? 16 : 42/);
  assert.match(effects, /desktopLite \? 3200 : 5500/);
  assert.match(effects, /desktopCoinDrop/);
  assert.match(effects, /realisticCoinDrop/);
  assert.match(effects, /React\.memo\(CoinRainEffectView\)/);
});

test("Income coins still animate; desktop does not use continuous expensive glow filter", () => {
  assert.match(effects, /desktopLite \? "incomeCoinSpinLite 2\.85s/);
  assert.match(effects, /incomeCoinGlow 0\.9s/);
  assert.match(effects, /React\.memo\(IncomeCoinSpinEffectView\)/);
});

test("Desktop visual work never reads/saves financial data or changes business callbacks", () => {
  assert.doesNotMatch(effects, /supabase|loadCloudData|deleteRecord|updateRecord|saveBudgets|importCsv|addRecord/);
  assert.doesNotMatch(desktopCss, /supabase|\.from\(|\.rpc\(/);
  assert.match(app, /<CoinRainEffect trigger=\{coinRainTrigger\} \/>/);
  assert.match(app, /<IncomeCoinSpinEffect trigger=\{incomeCoinTrigger\} \/>/);
});
