import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("Stage 2.3: both reconciliation residual types share literal note balance",()=>{
 const ui=source("FinanceAccountReconciliation.jsx");
 const begin=ui.indexOf("const fillResidual=(x)=>{");
 const end=ui.indexOf("  return <>",begin);
 assert.ok(begin>=0&&end>begin);
 const handler=ui.slice(begin,end);
 assert.match(handler,/type:x\.type,amount:String\(x\.amount\),method:x\.method,/);
 assert.match(handler,/note:"balance"/);
 assert.match(handler,/onPrefillRecord\(/);
 assert.match(handler,/window\.confirm\(/);
 assert.ok(!handler.includes("Reconciliation discrepancy - check underlying cause"));
 assert.ok(!handler.includes("supabase"));
 assert.ok(!handler.includes("addRecord"));
 assert.ok(!handler.includes("onExecuteTransfers"));
 const app=source("App.jsx");
 assert.match(app,/function prefillStage2Record\(next\)/);
 assert.match(app,/note:String\(next\.note \|\| ""\)/);
 assert.match(app,/id="mh-stage2-add-record-form"/);
 assert.ok(!app.includes('note:"balance"'));
});

test("Stage 2.3: all seven drawer entry points are independent and non-layout-shifting",()=>{
 const dock=source("FinanceInsightsDock.jsx"),css=source("financeUi.css");
 for(const label of ["FinanceWrapped","FinanceScenarioSimulator","FinanceMonthComparison","FinanceSavingsGoals"])
   assert.ok(dock.includes(label),label);
 for(const [type,label] of [
  ["bill","固定账单"],["review","异常记录复查"],["accounts","余额对账"]
 ]){
   assert.ok(dock.includes('onOpenStage2Tool("'+type+'",e.currentTarget)'),type);
   assert.ok(dock.includes(label),label);
 }
 assert.match(dock,/disabled=\{disabled\} aria-haspopup="dialog"/);
 assert.match(dock,/className="mh-insights-dock__button"/);
 assert.match(css,/transform: translate3d\(calc\(-100% \+ 34px\), -50%, 0\)/);
 assert.match(css,/max-height: calc\(100dvh - 32px\)/);
 assert.match(css,/overflow-y: auto/);
 assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});

test("Stage 2.3: dock bill/review entries reuse the EXISTING notification modal and handlers",()=>{
 const app=source("App.jsx"),hub=source("FinanceStage2Hub.jsx");
 assert.match(app,/const \[stage2ToolRequest,setStage2ToolRequest\] = useState\(null\)/);
 assert.match(app,/<FinanceStage2Hub toolRequest=\{stage2ToolRequest\}/);
 assert.match(app,/onOpenStage2Tool=\{openStage2DockTool\}/);
 assert.match(app,/setStage2ToolRequest\(\{type,source\}\)/);
 assert.match(hub,/handledRequestRef/);
 assert.match(hub,/useEffect\(\(\)=>\{/);
 assert.match(hub,/triggerRef\.current=toolRequest\.source\|\|null/);
 assert.match(hub,/setSelectedBillId\(null\)/);
 assert.match(hub,/setSelectedRecordId\(null\)/);
 assert.match(hub,/mode==="bill"&&<FinanceRecurringBills/);
 assert.match(hub,/mode==="review"&&<FinanceReviewInbox/);
 assert.ok(!source("FinanceInsightsDock.jsx").includes("<FinanceRecurringBills"));
 assert.ok(!source("FinanceInsightsDock.jsx").includes("<FinanceReviewInbox"));
});

test("Stage 2.3: bell remains animated; notification list opens the corresponding specific alert",()=>{
 const hub=source("FinanceStage2Hub.jsx"),css=source("financeUi.css");
 assert.match(hub,/mh-stage2-notifications__bell/);
 assert.match(hub,/mh-stage2-notifications__count/);
 assert.match(hub,/mh-stage2-notifications__toast/);
 assert.match(hub,/prioritized\.slice\(0,3\)\.map/);
 assert.match(hub,/prioritized\.map\(item=><button/);
 const calls=hub.match(/open\(item\.type,item\.ref,e\.currentTarget\)/g)||[];
 assert.equal(calls.length,2,"both per-record toast and full notification list must open actual item");
 assert.match(hub,/setSelectedBillId\(type==="bill"\?ref:null\)/);
 assert.match(hub,/setSelectedRecordId\(type==="review"\?ref:null\)/);
 assert.match(hub,/onOpenAccountCheck\?\.\(ref,source\)/);
 assert.ok(!hub.includes('open("bill",null,e.currentTarget)'));
 assert.ok(!hub.includes('open("review",null,e.currentTarget)'));
 assert.ok(!hub.includes('open("accounts",null,e.currentTarget)'));
 assert.match(css,/@keyframes mh-stage2-jump/);
 assert.match(css,/mh-stage2-notifications__alert-list/);
 assert.match(css,/max-height: min\(52dvh, 430px\)/);
 assert.match(css,/\.mh-stage2-notifications__toast \{ animation: none !important; \}/);
});

test("Stage 2.4: account drawer entry and discrepancy notification both target floating Balance Check dialog",()=>{
 const app=source("App.jsx"),hub=source("FinanceStage2Hub.jsx");
 const transfer=source("FinanceTransferPanel.jsx");
 assert.match(app,/function openStage2AccountCheck\(method=null,source=null\)/);
 assert.match(app,/onOpenAccountCheck=\{openStage2AccountCheck\}/);
 assert.match(app,/if\(type==="accounts"\)\{openStage2AccountCheck\(null,source\);return;\}/);
 assert.match(app,/setStage2ToolRequest\(\{type:"accounts",method,source\}\)/);
 assert.match(app,/setStage2ToolRequest\(\{type:"accounts",method,source\}\)/);
 assert.match(hub,/mode==="accounts"&&<FinanceAccountReconciliation/);
 assert.match(hub,/if\(type==="accounts"\)\{/);
 assert.match(hub,/onOpenAccountCheck\?\.\(ref,source\)/);
 assert.match(transfer,/<FinanceOverlay open=\{historyOpen\}/);
 assert.ok(!transfer.includes("FinanceAccountReconciliation"));
 assert.match(transfer,/onTransfer/);
 assert.match(hub,/<FinanceAccountReconciliation/);
});

test("Stage 2.3: no finance DB schema, cloud or core write handler changes needed",()=>{
 const app=source("App.jsx"),dock=source("FinanceInsightsDock.jsx");
 assert.match(app,/function addRecord/);
 assert.match(app,/function updateRecord/);
 assert.match(app,/function deleteRecord/);
 assert.match(app,/function saveBudgets/);
 assert.match(app,/function loadCloudData/);
 assert.match(app,/executeStage2Reconciliation/);
 assert.match(app,/confirmStage2BillPayment/);
 assert.match(dock,/onOpenStage2Tool/);
});
