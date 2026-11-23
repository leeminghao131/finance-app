import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {getClaimRequest,confirmClaimRequest} from "../src/financeClaimRequestId.js";
import {
  isCurrentFinanceOwner,matchesOpenedVersion,removeRowById,upsertUniqueVersionedRow
} from "../src/financeMutationSafety.js";

const source=(path)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const draft={title:"private-claim-description",claimant:"private-company",amount:"100.00",
  method:"BANK",paid_on:"2026-01-08",note:"private-note-value"};
function store(){
  const values=new Map();
  return {
    values,
    getItem(key){return values.has(key)?values.get(key):null;},
    setItem(key,value){values.set(key,String(value));},
    removeItem(key){values.delete(key);}
  };
}

test("P0 claim refresh/reload uses same stable UUID, keeps only hashed intent",async()=>{
  const storage=store();
  const first=await getClaimRequest("owner1","advance",draft,storage,webcrypto);
  const refresh=await getClaimRequest("owner1","advance",{...draft,amount:"100"},storage,webcrypto);
  assert.equal(first.requestId,refresh.requestId);
  assert.equal(first.key,refresh.key);
  assert.equal(storage.values.size,1);
  const content=[...storage.values.entries()].flat().join("\n");
  for(const secret of [draft.title,draft.claimant,draft.note,draft.method,draft.paid_on])
    assert.ok(!content.includes(secret),"saved metadata must not contain private Claim fields");
  const other=await getClaimRequest("owner2","advance",draft,storage,webcrypto);
  assert.notEqual(other.requestId,first.requestId);
  assert.notEqual(other.key,first.key);
  const different=await getClaimRequest("owner1","advance",{...draft,note:"another purchase"},storage,webcrypto);
  assert.notEqual(different.requestId,first.requestId);
  // An uncertain reply must NEVER delete the stable pending request identity.
  assert.equal((await getClaimRequest("owner1","advance",draft,storage,webcrypto)).requestId,first.requestId);
});

test("P0 reimbursement retries preserve UUID including across fully-paid state",async()=>{
  const storage=store();
  const entry={claimId:"claim-one",amount:"35.00",method:"BANK",received_on:"2026-01-10",note:"Received"};
  const req=await getClaimRequest("owner","repayment",entry,storage,webcrypto);
  const retry=await getClaimRequest("owner","repayment",{...entry,amount:"35"},storage,webcrypto);
  assert.equal(req.requestId,retry.requestId);
  const secondClaim=await getClaimRequest("owner","repayment",{...entry,claimId:"claim-two"},storage,webcrypto);
  assert.notEqual(secondClaim.requestId,req.requestId,"two independent claim repayments cannot share an ID");
  assert.equal(confirmClaimRequest("owner","repayment",req,storage),true);
  assert.equal(confirmClaimRequest("owner","repayment",req,storage),false);
  const legitimateNew=await getClaimRequest("owner","repayment",entry,storage,webcrypto);
  assert.notEqual(legitimateNew.requestId,req.requestId,
    "after acknowledged repayment a distinct new intent receives a new request ID");
});

test("P0 no account can acknowledge another account's cached Claim ID",async()=>{
  const s=store();
  const r=await getClaimRequest("a","advance",draft,s,webcrypto);
  assert.equal(confirmClaimRequest("b","advance",r,s),false);
  assert.equal(confirmClaimRequest("a","repayment",r,s),false);
  assert.equal((await getClaimRequest("a","advance",draft,s,webcrypto)).requestId,r.requestId);
  assert.equal(confirmClaimRequest("a","advance",r,s),true);
  assert.equal(s.values.size,0);
});

test("P0 Claim storage failures and invalid IDs refuse all financial writes",async()=>{
  const denyRead={getItem(){throw Error("blocked")}};
  const denyWrite={getItem(){return null;},setItem(){throw Error("blocked")}};
  await assert.rejects(getClaimRequest("a","advance",draft,denyRead,webcrypto),/Cannot safely read/);
  await assert.rejects(getClaimRequest("a","advance",draft,denyWrite,webcrypto),/could not be saved/);
  await assert.rejects(getClaimRequest("a","advance",{...draft,amount:"bad"},store(),webcrypto),/amount/i);
  const invalid=store();
  invalid.setItem("mh-finance-pending-claim-v1:a:advance:malformed","broken");
  const r=await getClaimRequest("a","advance",draft,invalid,webcrypto);
  invalid.setItem(r.key,"{malformed");
  await assert.rejects(getClaimRequest("a","advance",draft,invalid,webcrypto),/cannot be verified/);
  assert.equal(confirmClaimRequest("a","advance",r,invalid),false);
});

test("P0 simultaneous tabs share ID when browser lock serializes first requests",async()=>{
  const s=store();const sequence=[];
  const locks={async request(name,opts,callback){sequence.push(name);return callback();}};
  const [a,b]=await Promise.all([
    getClaimRequest("a","advance",draft,s,webcrypto,locks),
    getClaimRequest("a","advance",draft,s,webcrypto,locks)
  ]);
  assert.equal(a.requestId,b.requestId);
  assert.equal(sequence.length,2);
  assert.equal(sequence[0],sequence[1]);
});

test("P0 edit may use ONLY the version captured at editing start",()=>{
  assert.equal(matchesOpenedVersion(1,1),true);
  assert.equal(matchesOpenedVersion("27",27),true);
  assert.equal(matchesOpenedVersion(2,3),false);
  assert.equal(matchesOpenedVersion(undefined,3),false);
  assert.equal(matchesOpenedVersion(null,3),false);
  assert.equal(matchesOpenedVersion("1.5",1.5),false);
  const ref={current:"user-A"};
  assert.equal(isCurrentFinanceOwner(ref,"user-A"),true);
  ref.current="user-B";
  assert.equal(isCurrentFinanceOwner(ref,"user-A"),false);
  ref.current=null;
  assert.equal(isCurrentFinanceOwner(ref,"user-B"),false);
});

test("P0 version-aware recovery never duplicates rows or downgrades a newer sync",()=>{
  const v1={id:"r",version:1,amount:100};
  const v2={id:"r",version:2,amount:150};
  const v3={id:"r",version:3,amount:175};
  const a={id:"a",version:1,amount:35};
  assert.deepEqual(upsertUniqueVersionedRow([v1,a],v2),[v2,a]);
  assert.deepEqual(upsertUniqueVersionedRow([v3,a],v2),[v3,a]);
  assert.deepEqual(upsertUniqueVersionedRow([v1,v2,a],v3),[v3,a]);
  assert.deepEqual(upsertUniqueVersionedRow([a],v2),[v2,a]);
  assert.deepEqual(removeRowById([a,v1,v2],"r"),[a]);
  assert.throws(()=>upsertUniqueVersionedRow([],{}),/invalid/);
});

test("P0 every record/transfer/FX edit captures its original version; RLS CAS retained",()=>{
  const app=source("App.jsx");
  const mobile=source("FinanceMobileRecords.jsx");
  const advanced=source("FinanceAdvancedResults.jsx");
  const review=source("FinanceReviewInbox.jsx");
  const transfer=source("FinanceTransferPanel.jsx");
  const fx=source("FinanceFxRecordEditor.jsx");
  assert.match(app,/openedRef\.current=\{value:value\?\?"",version:recordVersion\}/);
  assert.match(app,/onSave\(draft,opened\.version\)/);
  assert.match(app,/async function updateRecord\(recordId, field, value, openedVersion=null\)/);
  assert.match(app,/matchesOpenedVersion\(openedVersion,current\.version\)/);
  assert.match(app,/\.eq\("version", openedVersion===null\?current\.version:openedVersion\)/);
  assert.match(app,/matchesOpenedVersion\(edit\.version,current\.version\)/);
  assert.match(app,/\.eq\("version",edit\.version\)/);
  assert.match(app,/const openedVersion=change\.expectedVersion\?\?original\?\.version/);
  assert.match(app,/\.eq\("version",openedVersion\)/);
  assert.match(mobile,/setEditVersion\(item\.version\)/);
  assert.match(mobile,/onUpdate\(record\.id, field, draft, editVersion\)/);
  assert.match(advanced,/onUpdate\(r\.id,field,next,openedVersion\)/);
  assert.match(review,/setEditVersion\(c\.record\.version\)/);
  assert.match(review,/onUpdateRecord\(c\.record\.id,fieldName,editValue,editVersion\)/);
  assert.match(transfer,/version:item\.version/);
  assert.match(fx,/openedVersionRef\.current=record\.version/);
  assert.match(fx,/expectedVersion:openedVersionRef\.current/);
  assert.doesNotMatch(app,/\.from\("(?:records|transfers)"\)\s*\.delete\(/);
});

test("P0 pending old-owner replies cannot update new account UI; restored rows are deduped",()=>{
  const app=source("App.jsx");
  for(const name of ["updateTransfer","deleteTransfer","restoreTransfer",
    "updateRecord","updateForeignRecord","deleteRecord","restoreRecord"]){
    const start=app.indexOf("async function "+name+"(");
    assert.ok(start>0,name+" exists");
    const end=app.indexOf("\n  }",start);
    const block=app.slice(start,end);
    assert.match(block,/isCurrentFinanceOwner\(liveUserIdRef,owner\)/,name);
    assert.ok(block.indexOf("if(!isCurrentFinanceOwner(liveUserIdRef,owner))return false;")>=0,
      "must recheck live owner after awaited SQL in "+name);
  }
  for(const label of ["upsertUniqueVersionedRow(previous,removed)",
    "upsertUniqueVersionedRow(previous,restored)",
    "upsertUniqueVersionedRow(rows,deleted)",
    "upsertUniqueVersionedRow(rows,restored)"])
    assert.ok(app.includes(label),"missing dedupe "+label);
  const claim=source("FinanceClaimTracker.jsx");
  assert.match(claim,/getClaimRequest\(/);
  assert.match(claim,/confirmClaimRequest\(/);
  assert.match(claim,/busyRef\.current/);
  assert.doesNotMatch(claim,/const makeRequest=\(\)=>crypto\.randomUUID\(\)/);
});
