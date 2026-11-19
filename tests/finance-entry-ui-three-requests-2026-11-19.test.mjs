import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=file=>readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const app=src("App.jsx"),panel=src("FinanceActivityPanel.jsx"),dock=src("FinanceInsightsDock.jsx");
const fx=src("FinanceCurrencyInput.jsx"),css=src("financeUi.css");

test("Activity auto-tag banner is a direct vibrating launcher for the existing modal",()=>{
  assert.match(app, /activeActivity\(activities\)&&<button type="button"/);
  assert.match(app, /ref=\{activityStatusTriggerRef\} disabled=\{!initialDataReady\|\|dataLoading\}/);
  assert.match(app, /onClick=\{\(\)=>setActivityOpenRequest\(count=>count\+1\)\}/);
  assert.match(app, /mh-modal-trigger/);
  assert.match(app, /activityOpenRequest=\{activityOpenRequest\}/);
  assert.match(app, /activityStatusTriggerRef=\{activityStatusTriggerRef\}/);
  assert.match(app, /onActivityOpenRequestHandled=\{\(\)=>setActivityOpenRequest\(0\)\}/);
  assert.match(dock, /<FinanceActivityPanel activities=\{activities\}/);
  assert.match(dock, /activityOpenRequest=\{activityOpenRequest\} activityStatusTriggerRef=\{activityStatusTriggerRef\}/);
  assert.match(panel, /useEffect\(\(\)=>\{\s*if\(!activityOpenRequest\)return;/);
  assert.match(panel, /returnFocusRef\.current=activityStatusTriggerRef\?\.current\|\|triggerRef\.current/);
  assert.match(panel, /onActivityOpenRequestHandled\(\)/);
  assert.match(panel, /<FinanceOverlay open=\{open\}/);
  for(const action of ['status("paused")','status("active")','status("finished")']){
    assert.ok(panel.includes(action),action+" remains in the same modal");
  }
  assert.match(css, /@keyframes mh-universal-hover-vibrate/);
  assert.match(css, /button:is\(\.mh-modal-trigger/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Category section has only the original editable selector and custom-category actions",()=>{
  assert.doesNotMatch(app, /mh-entry-category-chips|Quick category choices/);
  assert.doesNotMatch(css, /mh-entry-category-chips|"chips chips"/);
  assert.match(css, /"category method"\s+"date note"/);
  assert.match(app, /<label className="mh-entry-category block">/);
  assert.match(app, /value=\{form\.category\}/);
  assert.match(app, /<option value=\{ADD_CATEGORY_VALUE\}>/);
  assert.match(app, /<option value=\{DELETE_CATEGORY_VALUE\}>/);
  assert.match(app, /setDeleteOptionPanel\(\{ kind: "category", type: form\.type \}\)/);
  assert.match(app, /<FinanceQuickNotes records=\{records\}/);
});

test("Currency is selected with ONE accessible dropdown, without a second reveal button",()=>{
  assert.doesNotMatch(app, /currencyToolsOpen|setCurrencyToolsOpen|mh-entry-currency-panel/);
  assert.match(app, /<FinanceCurrencyInput compact date=\{form\.date\} currency=\{fxCurrency\}/);
  assert.match(fx, /<select aria-label=\{zh\?"交易货币":"Transaction currency"\} value=\{currency\}/);
  assert.match(fx, /onChange=\{e=>onCurrency\(e\.target\.value\)\}/);
  assert.match(fx, /compact\?"mh-entry-fx-direct__picker"/);
  assert.match(fx, /currency!=="MYR"&&<div/);
  assert.match(css, /\.mh-ui \.mh-entry-fx-direct__select \{/);
  assert.match(app, /writeFxCurrencyPreference\(user\?\.id,code,localStorage\)/);
  assert.match(fx, /getReferenceFxRate\(currency,date,fetch,ctrl\.signal\)/);
  assert.match(app, /fxMeta=makeFxSnapshot\(\{currency:fxCurrency,foreignAmount:fxForeignAmount/);
  assert.match(app, /const \[amountEntryMode, setAmountEntryMode\] = useState\("rm"\)/);
  assert.match(app, /onSubmit=\{addRecord\}/);
});
