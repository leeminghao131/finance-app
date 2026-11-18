import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {orbitGeometry,orbitCurve} from "../src/financeTransferOrbit.js";
import {FINANCE_DOCK_IDS,normalizeDockOrder,moveDockItem} from "../src/financeDockOrder.js";

const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("All custom and builtin methods sit at equally spaced radial positions",()=>{
  const methods=["BANK","TNG","CASH","GRAB PAY","支付宝"];
  const ring=orbitGeometry(methods);
  assert.ok(ring.radius>=143);
  assert.equal(ring.count,5);
  assert.equal(ring.nodes.length,5);
  assert.deepEqual(ring.nodes.map(node=>node.method),methods);
  const radii=ring.nodes.map(node=>Math.hypot(node.x-ring.center,node.y-ring.center));
  for(const radius of radii)assert.ok(Math.abs(radius-ring.radius)<0.00001);
  const angles=ring.nodes.map(node=>Math.atan2(node.y-ring.center,node.x-ring.center));
  for(let i=1;i<angles.length;i++){
    const step=(angles[i]-angles[i-1]+2*Math.PI)%(2*Math.PI);
    assert.ok(Math.abs(step-2*Math.PI/methods.length)<0.00001);
  }
  const ten=orbitGeometry([...methods,"ALIPAY","WISE","MAYBANK","OCBC","Paypal"]);
  assert.equal(ten.count,10);
  assert.ok(ten.radius>ring.radius);
  assert.equal(new Set(ten.nodes.map(node=>node.method)).size,10);
  assert.deepEqual(orbitGeometry([...methods,"支付宝"]).nodes.map(node=>node.method),methods);
  assert.equal(orbitGeometry([]).count,0);
});

test("Transfer wire path references the correct endpoints and handles empty inputs",()=>{
  const ring=orbitGeometry(["BANK","TNG","CASH","GRAB PAY","支付宝"]);
  assert.equal(orbitCurve(null,ring.nodes[1],ring.center),"");
  const path=orbitCurve(ring.nodes[0],ring.nodes[1],ring.center);
  assert.match(path,/^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
  assert.ok(!/NaN|undefined/.test(path));
});

test("Single Transfer console owns the only new transfer amount input, retains money guards and history",()=>{
  const panel=src("FinanceTransferPanel.jsx");
  const orbit=src("FinanceTransferCorners.jsx");
  const app=src("App.jsx");
  assert.match(panel,/<FinanceTransferCorners/);
  assert.match(panel,/amount=\{transferForm\.amount\}/);
  assert.match(panel,/onAmountChange=\{value=>\{/);
  assert.doesNotMatch(panel,/<label className="block text-sm text-slate-700">Amount \(RM\)/);
  assert.match(orbit,/<input type="text" inputMode="numeric" required disabled=\{disabled\}/);
  assert.match(panel,/const amount=\(Number\(digits\|\|0\)\/100\)\.toFixed\(2\)/);
  assert.match(panel,/transferForm\.fromMethod===transferForm\.toMethod/);
  assert.match(panel,/Number\(transferForm\.amount\)<=0/);
  assert.match(panel,/<FinanceOverlay open=\{historyOpen\}/);
  assert.match(panel,/onUpdateTransfer\(editing\.id,editing\)/);
  assert.match(panel,/onDeleteTransfer\(id\)/);
  assert.match(panel,/onRestoreTransfer\(row\.id\)/);
  assert.match(app,/<FinanceTransferPanel/);
  assert.match(app,/getTransferRequestId\(user\.id,payload,sessionStorage,crypto\)/);
});

test("Circular transfer nodes support both tap and pointer drag with accessible amount",()=>{
  const orbit=src("FinanceTransferCorners.jsx"),css=src("financeUi.css");
  assert.match(orbit,/orbitGeometry\(methods\)/);
  assert.match(orbit,/nodes\.map\(node=>/);
  assert.match(orbit,/setPointerCapture\(event\.pointerId\)/);
  assert.match(orbit,/onPointerMove=\{pointerMove\}/);
  assert.match(orbit,/onPointerCancel=\{e=>pointerFinish\(e,true\)\}/);
  assert.match(orbit,/onFrom\(pointer\.method\);onTo\(target\)/);
  assert.match(orbit,/onFrom\(pendingSource\);onTo\(method\)/);
  assert.match(orbit,/onTo\(""\)/);
  assert.match(orbit,/className="mh-transfer-orbit__amount"/);
  assert.match(orbit,/scrollLeft=Math\.max\(0,\(viewport\.scrollWidth-viewport\.clientWidth\)\/2\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.mh-transfer-orbit__wire/);
  assert.match(css, /\.mh-transfer-orbit__node\.is-target/);
  assert.match(css, /\.mh-transfer-orbit__core/);
  assert.ok(!orbit.includes("supabase.from("));
});

test("Assistant accepts only preset button questions, with all rule calculations unchanged",()=>{
  const assistant=src("FinanceRuleAssistant.jsx"),rules=src("financeAssistantRules.js");
  assert.match(assistant,/ASSISTANT_SUGGESTIONS\.map/);
  assert.match(assistant,/onClick=\{\(\)=>ask\(text\)\}/);
  assert.doesNotMatch(assistant,/<input\b/);
  assert.doesNotMatch(assistant,/<textarea\b/);
  assert.doesNotMatch(assistant,/<form\b/);
  assert.match(assistant,/onOpenTool\(entry\.reply\.action,trigger\.current\)/);
  assert.match(rules,/calculateCashForecast/);
  assert.match(rules,/summarizeMonthlyBudget/);
  assert.ok(!assistant.includes("supabase.from("));
});

test("One sortable CSV / Excel drawer entry replaces two header entry buttons",()=>{
  const dock=src("FinanceInsightsDock.jsx"),app=src("App.jsx"),launcher=src("FinanceDataToolsLauncher.jsx");
  assert.equal(FINANCE_DOCK_IDS.length,9);
  assert.equal(FINANCE_DOCK_IDS.filter(id=>id==="data-tools").length,1);
  assert.equal(normalizeDockOrder(["review","activity"]).at(-1),"data-tools");
  assert.equal(new Set(moveDockItem(FINANCE_DOCK_IDS,"data-tools","activity")).size,9);
  assert.match(dock,/<FinanceDataToolsLauncher disabled=\{disabled\} onOpen=\{onOpenDataTool\}/);
  assert.match(launcher,/onMouseEnter=\{\(\)=>setOpen\(true\)\}/);
  assert.match(launcher,/onClick=\{\(\)=>setOpen\(true\)\}/);
  assert.match(launcher,/launch\("import",event\)/);
  assert.match(launcher,/launch\("export",event\)/);
  assert.match(app,/onOpenDataTool=\{\(kind,trigger\)=>/);
  assert.match(app,/<FinanceOverlay open=\{importOpen\}/);
  assert.match(app,/<FinanceOverlay open=\{exportOpen\}/);
  assert.match(app, /const FinanceCsvImportPanel = React\.lazy/);
  assert.match(app, /const FinanceExcelExportPanel = React\.lazy/);
  const firstHeader=app.split('<header className="flex flex-col')[1]?.split("</header>")[0];
  assert.ok(firstHeader,"dashboard header must exist");
  assert.doesNotMatch(firstHeader,/⬆ Import CSV|⬇ Export Excel/);
  assert.match(app,/onImported=\{\(\) => loadCloudData\(\{background:true\}\)\}/);
  assert.match(src("FinanceExcelExportPanel.jsx"),/verifyFinanceWorkbook\(workbook,stats\)/);
});
