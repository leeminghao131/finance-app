import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");

test("Stage 2.6: notifications retain due bills and pending reviews, and add outstanding claims",()=>{
  const hub=source("FinanceStage2Hub.jsx");
  const alerts=hub.slice(hub.indexOf("  const alerts=["),hub.indexOf("  // Only overdue bills"));
  assert.match(alerts,/\.\.\.billsDue\.map\(x=>\(\{type:"bill"/);
  assert.match(alerts,/\.\.\.candidates\.map\(x=>\(\{type:"review"/);
  assert.match(alerts,/\.\.\.claims\.filter\(x=>x\.outstanding>0\)/);
  assert.doesNotMatch(alerts,/accounts|reconcil|checks/);
  assert.doesNotMatch(hub,/const reconciliationAlerts=/);
  assert.doesNotMatch(hub,/type:"accounts",id:/);
  assert.doesNotMatch(hub,/账户有差额|Balance difference/);
});

test("Stage 2.6: bell count and jumping toasts cover bills, reviews and outstanding claims",()=>{
  const hub=source("FinanceStage2Hub.jsx"),css=source("financeUi.css");
  assert.match(hub,/const firstOfType=\["claim","bill","review"\]/);
  assert.match(hub,/const prioritized=\[\.\.\.firstOfType/);
  assert.match(hub,/const alertCount=alerts\.length/);
  assert.match(hub,/mh-stage2-notifications__bell/);
  assert.match(hub,/mh-stage2-notifications__count/);
  assert.match(hub,/mh-stage2-notifications__toast/);
  assert.match(hub,/prioritized\.slice\(0,3\)\.map/);
  assert.match(hub,/prioritized\.map\(item=><button/);
  assert.match(hub,/item\.type==="bill"\?t\("账单到期提醒","Bill due"\)/);
  assert.match(hub,/t\("交易待确认","Review transaction"\)/);
  assert.equal((hub.match(/open\(item\.type,item\.ref,e\.currentTarget\)/g)||[]).length,2);
  assert.match(css,/@keyframes mh-stage2-jump/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("Stage 2.6: clicking retained alert still opens the SPECIFIC bill or suspicious record",()=>{
  const hub=source("FinanceStage2Hub.jsx");
  assert.match(hub,/setSelectedBillId\(type==="bill"\?ref:null\)/);
  assert.match(hub,/setSelectedRecordId\(type==="review"\?ref:null\)/);
  assert.match(hub,/selectedBillId=\{selectedBillId\}/);
  assert.match(hub,/selectedId=\{selectedRecordId\}/);
  assert.match(hub,/mode==="bill"&&<FinanceRecurringBills/);
  assert.match(hub,/mode==="review"&&<FinanceReviewInbox/);
  assert.doesNotMatch(hub,/onOpenAccountCheck\?\.\(ref,source\)/);
});

test("Stage 2.6: left Balance Check drawer and ALL reconciliation operations are unchanged",()=>{
  const hub=source("FinanceStage2Hub.jsx"),dock=source("FinanceInsightsDock.jsx"),
    app=source("App.jsx"),account=source("FinanceAccountReconciliation.jsx");
  assert.match(dock,/onOpenStage2Tool\("accounts",e\.currentTarget\)/);
  assert.match(app,/if\(type==="accounts"\)\{openStage2AccountCheck\(null,source\);return;\}/);
  assert.match(app,/setStage2ToolRequest\(\{type:"accounts",method,source\}\)/);
  assert.match(hub,/\["bill","review","accounts"\]\.includes\(toolRequest\.type\)/);
  assert.match(hub,/mode==="accounts"&&<FinanceAccountReconciliation/);
  assert.match(hub,/onExecuteTransfers=\{onExecuteTransfers\}/);
  assert.match(hub,/onSave=\{onSaveChecks\}/);
  assert.match(account,/planReconciliationTransfers\(normalizedBalances,actualByMethod\)/);
  assert.match(account,/note:"balance"/);
  assert.match(account,/onClick=\{executePlan\}/);
  assert.match(account,/onClick=\{saveAllChecks\}/);
});

test("Stage 2.6: four anomaly switches and bill payment idempotency remain in place",()=>{
  const review=source("FinanceReviewInbox.jsx"),bills=source("FinanceRecurringBills.jsx");
  assert.match(review,/REVIEW_RULE_KEYS\.map/);
  assert.match(review,/role="switch"/);
  assert.match(review,/onUpdateRecord\(c\.record\.id,fieldName,editValue,editVersion\)/);
  assert.match(bills,/onConfirmPayment\(\{billId:event\.billId,due:event\.due\}\)/);
  assert.match(source("financeBillPayment.js"),/recurringBillRequestId/);
  assert.match(source("financeStage2.js"),/findReviewCandidates/);
});
