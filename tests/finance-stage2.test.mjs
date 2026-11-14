import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 validateBills,billOccurrences,withBillOccurrence,findReviewCandidates,
 validateReviewState,confirmReview,recordFingerprint,reconcileMethod,validateAccountChecks
} from "../src/financeStage2.js";
const src=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const bill={id:"bill-abcdefgh",title:"Internet",amount:"89.90",category:"住房",method:"BANK",
 anchorDate:"2026-11-30",cycle:"monthly",leadDays:3,active:true,occurrences:[]};
const rows=[
 {id:"rec-1",version:2,date:"2026-11-15",type:"expense",amount:500.01,category:"饮食",method:"TNG",note:"",updated_at:"2026-11-15T01:00:00Z"},
 {id:"rec-2",version:1,date:"2026-11-12",type:"expense",amount:12.50,category:"交通",method:"BANK",note:"Lunch"},
 {id:"rec-3",version:1,date:"2026-11-12",type:"expense",amount:12.50,category:"交通",method:"BANK",note:"Lunch"},
 {id:"rec-4",version:1,date:"2026-12-01",type:"income",amount:1200,category:"Salary",method:"BANK",note:"Future"},
 {id:"rec-del",version:1,date:"2026-11-15",type:"expense",amount:1000,category:"饮食",method:"TNG",note:"",deleted_at:"2026-11-15"},
];
test("Stage2 bill plans validate RM, cycles, dates, owner-safe IDs and duplicate statuses",()=>{
 const v=validateBills([bill]);assert.equal(v[0].amount,89.9);
 assert.throws(()=>validateBills([{...bill,amount:"89.999"}]));
 assert.throws(()=>validateBills([{...bill,cycle:"daily"}]));
 assert.throws(()=>validateBills([{...bill,anchorDate:"2026-02-29"}]));
 assert.throws(()=>validateBills([bill,bill]),/Duplicate/);
 assert.throws(()=>validateBills([{...bill,occurrences:[{due:"2026-11-30",status:"paid"}]}]),/link/);
});
test("Stage2 reminder follows MY calendar, lead days, monthly leap clamping and no false automatic payment",()=>{
 const occurrences=billOccurrences([bill],"2026-11-28",rows,35,45);
 assert.equal(occurrences[0].due,"2026-11-30");
 assert.equal(occurrences[0].noticeDate,"2026-11-27");
 assert.equal(occurrences[0].visible,true);
 const future=billOccurrences([bill],"2026-11-26",rows,35,45);
 assert.equal(future[0].visible,false);
 const skipped=withBillOccurrence([bill],bill.id,"2026-11-30",{status:"skipped"});
 assert.equal(billOccurrences(skipped,"2026-11-28",rows,35,45)[0].visible,false);
 const snoozed=withBillOccurrence([bill],bill.id,"2026-11-30",{status:"snoozed",remindOn:"2026-11-29"});
 assert.equal(billOccurrences(snoozed,"2026-11-28",rows,35,45)[0].visible,false);
 assert.equal(billOccurrences(snoozed,"2026-11-29",rows,35,45)[0].visible,true);
 const january={...bill,anchorDate:"2027-01-31"};
 assert.equal(billOccurrences([january],"2027-02-28",rows,60,60).map(x=>x.due).includes("2027-02-28"),true);
});
test("Stage2 bill cannot mark paid unless an existing Expense exists and remains undeleted",()=>{
 const paid=withBillOccurrence([bill],bill.id,"2026-11-30",{status:"paid",recordId:"rec-2"});
 assert.equal(billOccurrences(paid,"2026-11-29",rows,30,45)[0].visible,false);
 const missing=billOccurrences(paid,"2026-11-29",rows.filter(x=>x.id!=="rec-2"),30,45)[0];
 assert.equal(missing.status,"unlinked");assert.equal(missing.visible,true);
 const deleted=billOccurrences(paid,"2026-11-29",[...rows.filter(x=>x.id!=="rec-2"),{...rows[1],deleted_at:"2026-11-15"}],30,45)[0];
 assert.equal(deleted.status,"unlinked");
});
test("Stage2 anomaly review includes high expenses, duplicate transactions, empty note and future dates",()=>{
 const c=findReviewCandidates(rows,{threshold:500,decisions:[]},"2026-11-15");
 const a=c.find(x=>x.id==="rec-1");
 assert.deepEqual(a.reasons,["large","missingNote"]);
 assert.ok(c.find(x=>x.id==="rec-2").reasons.includes("duplicate"));
 assert.ok(c.find(x=>x.id==="rec-3").reasons.includes("duplicate"));
 assert.ok(c.find(x=>x.id==="rec-4").reasons.includes("futureDate"));
 assert.ok(!c.some(x=>x.id==="rec-del"));
 assert.equal(a.confirmed,false);
});
test("Stage2 confirming a record only saves review fingerprint and changes after edits",()=>{
 const state={threshold:500,decisions:[]},snap=JSON.stringify(rows);
 const confirmed=confirmReview(state,rows[0],"2026-11-15");
 assert.equal(confirmed.decisions[0].fingerprint,recordFingerprint(rows[0]));
 assert.equal(findReviewCandidates(rows,confirmed,"2026-11-15").find(x=>x.id==="rec-1").confirmed,true);
 const changed=rows.map(x=>x.id==="rec-1"?{...x,note:"Confirmed",version:3}:x);
 assert.equal(findReviewCandidates(changed,confirmed,"2026-11-15").find(x=>x.id==="rec-1").confirmed,false);
 assert.equal(JSON.stringify(rows),snap);
 assert.throws(()=>validateReviewState({...confirmed,decisions:[...confirmed.decisions,...confirmed.decisions]}),/duplicate/);
});
test("Stage2 account checks preserve actual and ledger values with cents, including overdraft",()=>{
 const x=reconcileMethod("BANK","1400.45","1450.10","2026-11-15","check-abcdefgh","Check bank");
 assert.equal(x.actual,1400.45);assert.equal(x.ledger,1450.1);assert.equal(x.difference,-49.65);
 assert.equal(validateAccountChecks([x])[0].difference,-49.65);
 const y=reconcileMethod("CASH","-20","-10","2026-11-15","check-12345678");
 assert.equal(y.difference,-10);
 assert.throws(()=>reconcileMethod("TNG","20.123",20,"2026-11-15","check-abcd1234"),/Invalid/);
 assert.throws(()=>validateAccountChecks([x,x]),/Duplicate/);
});
test("Stage2 UI has top-right bounce, review mini-popup, account manual prefill, no auto records writes",()=>{
 const app=src("App.jsx"),cloud=src("financeCloudService.js"),hub=src("FinanceStage2Hub.jsx");
 const css=src("financeUi.css"),bills=src("FinanceRecurringBills.jsx"),review=src("FinanceReviewInbox.jsx");
 const account=src("FinanceAccountReconciliation.jsx");
 assert.match(app,/<FinanceStage2Hub/);
 assert.match(app,/queueSettingsField\(column, normalized\)/);
 assert.match(app,/saveStage2Field\("recurring_bills"/);
 assert.match(app,/saveStage2Field\("review_state"/);
 assert.match(app,/saveStage2Field\("account_checks"/);
 assert.match(cloud,/saved_filters,recurring_bills,review_state,account_checks/);
 assert.match(css,/mh-stage2-jump/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(hub,/mh-stage2-notifications__toast/);
 assert.match(hub,/selectedId=\{selectedRecordId\}/);
 assert.match(bills,/Confirm paid \(link only\)/);
 assert.match(bills,/withBillOccurrence/);
 assert.match(review,/onUpdateRecord\(c.record.id,fieldName,editValue\)/);
 assert.match(review,/confirmReview\(reviewState,c.record,localDateMY\(\)\)/);
 assert.match(account,/onPrefillRecord/);
 assert.match(account,/reconcileMethod/);
 assert.match(app,/setAmountEntryMode\("rm"\)/);
 assert.match(app,/id="mh-stage2-add-record-form"/);
 assert.ok(!hub.includes("supabase.from"));
 assert.ok(!review.includes("supabase.from"));
 assert.ok(!account.includes("supabase.from"));
});
