import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
const app = read("App.jsx");
const theme = read("financeCosmicPilot.css");
const sky = read("financeCosmicSky.svg");
const transfer = read("FinanceTransferPanel.jsx");
const bell = read("FinanceStage2Hub.jsx");
const assistant = read("FinanceRuleAssistant.jsx");

test("The pilot is scoped only to the signed-in dashboard and fully removable", () => {
  assert.match(app, /import "\.\/financeUi\.css";\s*import "\.\/financeCosmicPilot\.css";/);
  assert.match(app, /className="mh-ui mh-cosmic-pilot min-h-screen/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \{/);
  assert.doesNotMatch(theme, /(?:^|\n)\s*(?:body|html|:root)\s*\{/);
  assert.match(theme, /No visual style is injected into Records, Budget, charts or editing overlays/);
});

test("The first batch is restricted to backdrop, summary/header, transfer and floating controls", () => {
  assert.match(theme, /financeCosmicSky\.svg/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-dashboard-header/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-dashboard-today__metric/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-dashboard-quick-actions/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-transfer-console/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-transfer-orbit/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-stage2-notifications__bell/);
  assert.match(theme, /\.mh-ui\.mh-cosmic-pilot \.mh-rule-assistant__launcher/);
  assert.doesNotMatch(theme, /(?:\s|^)@import|https?:\/\/|(?:\s|^)url\(["']?https?:/);
  assert.doesNotMatch(theme, /(?:#|\.)(?:deleteRecord|updateRecord|addRecord|saveBudgets)/);
});

test("UI-only theme preserves financial meaning and accessibility", () => {
  assert.match(theme, /mh-dashboard-today__metric--income strong/);
  assert.match(theme, /mh-dashboard-today__metric--expense strong/);
  assert.match(theme, /mh-dashboard-today__metric--neutral strong/);
  assert.match(theme, /outline: 2px solid #dabb86/);
  assert.match(theme, /prefers-reduced-motion: reduce/);
  assert.match(theme, /background-attachment: scroll/);
  assert.match(theme, /pointer-events: none/);
  assert.match(transfer, /<form onSubmit=\{onTransfer\}/);
  assert.match(transfer, /<FinanceTransferCorners methods=\{methodOptions\}/);
  assert.match(bell, /<FinanceNotificationEmblem active=\{alertCount>0\}/);
  assert.match(assistant, /<FinanceAssistantEmblem \/>/);
});

test("Starfield is static, local and muted, with no remote assets or animation", () => {
  assert.match(sky, /viewBox="0 0 1600 1000"/);
  assert.match(sky, /fill="#091321"/);
  assert.match(sky, /Static subdued starfield/);
  assert.doesNotMatch(sky, /<script|<animate|<foreignObject|https?:\/\/|onload=|href=/i);
});
