import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateBills,billOccurrences} from "../src/financeStage2.js";

const src=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const bill={id:"bill-12345678",title:"Fake Internet",amount:80,category:"住房",
  method:"BANK",anchorDate:"2026-11-15",cycle:"monthly",active:true,occurrences:[]};

test("Stage 2.4: newly created recurring bills default to SAME-DAY notification, not three days early",()=>{
 const component=src("FinanceRecurringBills.jsx");
 assert.match(component,/cycle:"monthly",leadDays:0,active:true,occurrences:\[\]/);
 assert.match(component,/setDraft\(bill\?.*:blank\(\)\)/);
 const verified=validateBills([bill]);
 assert.equal(verified[0].leadDays,0);
 const yesterday=billOccurrences([bill],"2026-11-14",[],3,6);
 assert.equal(yesterday[0].due,"2026-11-15");
 assert.equal(yesterday[0].noticeDate,"2026-11-15");
 assert.equal(yesterday[0].visible,false);
 const due=billOccurrences([bill],"2026-11-15",[],3,6);
 assert.equal(due[0].phase,"today");
 assert.equal(due[0].visible,true);
 const legacy=validateBills([{...bill,leadDays:3}]);
 assert.equal(legacy[0].leadDays,3,"explicitly saved legacy warning days are untouched");
 assert.equal(billOccurrences(legacy,"2026-11-12",[],3,6)[0].visible,true);
});

test("Stage 2.4: dock buttons lift smoothly without rearranging any dashboard cards",()=>{
 const css=src("financeUi.css"),dock=src("FinanceInsightsDock.jsx");
 assert.match(css,/\.mh-insights-dock__button:not\(:disabled\):hover/);
 assert.match(css,/translate3d\(3px,-3px,0\) scale\(1\.025\)/);
 assert.match(css,/transition: transform 290ms cubic-bezier/);
 assert.match(css,/box-shadow: 0 10px 22px/);
 assert.match(css,/max-height: calc\(100dvh - 32px\)/);
 assert.match(css,/overflow-y: auto/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 for(const type of ["bill","review","accounts"])
  assert.ok(dock.includes('onOpenStage2Tool("'+type+'",e.currentTarget)'));
});

test("Stage 2.4: Transfer History opens from header button as a FULL floating modal",()=>{
 const ui=src("FinanceTransferPanel.jsx");
 assert.match(ui,/ref=\{historyTriggerRef\}/);
 assert.match(ui,/onClick=\{\(\)=>\{setShowAll\(true\);setHistoryOpen\(true\);\}\}/);
 assert.match(ui,/<FinanceOverlay open=\{historyOpen\} triggerRef=\{historyTriggerRef\}/);
 const form=ui.indexOf("<form onSubmit={onTransfer}");
 const modal=ui.indexOf("<FinanceOverlay open={historyOpen}");
 const filter=ui.indexOf('<h3 className="font-bold">{t("转账历史","Transfer History")}</h3>',modal);
 const trash=ui.indexOf("Transfer Recycle Bin",modal);
 const close=ui.lastIndexOf("</FinanceOverlay>");
 assert.ok(form>=0&&form<modal&&modal<filter&&filter<trash&&trash<close,
  "Transfer form remains in card while complete History/Recycle Bin move inside modal");
 assert.match(ui,/onUpdateTransfer\(editing\.id,editing\)/);
 assert.match(ui,/onDeleteTransfer\(id\)/);
 assert.match(ui,/onRestoreTransfer\(row\.id\)/);
 assert.match(ui,/onRestoreTransfer\(undoTransfer\.id\)/);
 assert.match(ui,/setMonth/);
 assert.match(ui,/setKeyword/);
 assert.match(ui,/setLimit\(n=>n\+25\)/);
 assert.match(ui,/disabled=\{pending\}/);
 assert.ok(!ui.includes('role="tablist"'));
 assert.ok(!ui.includes("<FinanceAccountReconciliation"));
});

test("Stage 2.4: all-balance reconciliation is accessible ONLY as a floating popup",()=>{
 const app=src("App.jsx"),hub=src("FinanceStage2Hub.jsx");
 const transfer=src("FinanceTransferPanel.jsx");
 assert.match(hub,/<FinanceOverlay open=\{!!mode\}/);
 assert.match(hub,/mode==="accounts"&&<FinanceAccountReconciliation/);
 assert.match(hub,/onExecuteTransfers=\{onExecuteTransfers\}/);
 assert.match(hub,/onSave=\{onSaveChecks\}/);
 assert.match(hub,/selectedMethod=\{selectedAccountMethod\}/);
 assert.match(app,/onOpenAccountCheck=\{openStage2AccountCheck\}/);
 assert.match(app,/onExecuteTransfers=\{executeStage2Reconciliation\}/);
 assert.match(app,/setStage2ToolRequest\(\{type:"accounts",method,source\}\)/);
 assert.ok(!app.includes("setTransferToolTab"));
 assert.ok(!transfer.includes("FinanceAccountReconciliation"));
 assert.ok(!transfer.includes('role="tablist"'));
 assert.match(hub,/const prefillAndClose=record=>/);
 assert.match(hub,/if\(ok\)close\(\)/);
 assert.match(hub,/onPrefillRecord=\{prefillAndClose\}/);
 assert.match(src("FinanceAccountReconciliation.jsx"),/note:"balance"/);
});

test("Stage 2.6: specific BILL and REVIEW notifications open targets, balance dock stays available",()=>{
 const hub=src("FinanceStage2Hub.jsx"),dock=src("FinanceInsightsDock.jsx"),app=src("App.jsx");
 assert.match(hub,/prioritized\.slice\(0,3\)\.map/);
 assert.equal((hub.match(/open\(item\.type,item\.ref,e\.currentTarget\)/g)||[]).length,2);
 assert.match(hub,/setSelectedBillId\(type==="bill"\?ref:null\)/);
 assert.match(hub,/setSelectedRecordId\(type==="review"\?ref:null\)/);
 assert.doesNotMatch(hub,/reconciliationAlerts/);
 assert.match(hub,/setSelectedAccountMethod\(toolRequest\.type==="accounts"\?\(toolRequest\.method\|\|null\):null\)/);
 assert.match(app,/function openStage2AccountCheck\(method=null,source=null\)/);
 assert.match(app,/if\(type==="accounts"\)\{openStage2AccountCheck\(null,source\);return;\}/);
 assert.match(dock,/onOpenStage2Tool\("accounts",e\.currentTarget\)/);
 assert.match(hub,/mh-stage2-notifications__toast/);
 assert.match(src("financeUi.css"),/@keyframes mh-stage2-jump/);
});

test("Stage 2.4: data-writes and ledger calculations remain in existing modules",()=>{
 const app=src("App.jsx"),transfer=src("FinanceTransferPanel.jsx");
 for(const symbol of ["addRecord","updateRecord","deleteRecord","FinanceCsvImportPanel","saveBudgets","loadCloudData","executeStage2Reconciliation","confirmStage2BillPayment"])
  assert.ok(app.includes(symbol),symbol);
 for(const symbol of ["onTransfer","onUpdateTransfer","onDeleteTransfer","onRestoreTransfer","undoTransfer"])
  assert.ok(transfer.includes(symbol),symbol);
 assert.match(src("FinanceAccountReconciliation.jsx"),/planReconciliationTransfers/);
 assert.match(src("financeBillPayment.js"),/client\.from\("records"\)\.insert/);
});
