// Stable, per-account Claim request intent across refresh, lost network replies
// and new tabs. This file stores ONLY a SHA-256 fingerprint and a random UUID,
// NEVER claim descriptions, payees, notes, dates or amounts in browser storage.
// The database retains its unique (user_id, client_request_id) constraint.
// A successful acknowledged write clears ONLY the matching intent; uncertain
// outcomes preserve the same UUID until read-after-commit recovery succeeds.
import {claimSen,validateClaimDraft} from "./financeClaims.js";
import {requireCalendarDate} from "./financeCalendar.js";

const PREFIX="mh-finance-pending-claim-v1:";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function normalizedIntent(kind,draft){
  if(kind==="advance"){
    const x=validateClaimDraft(draft);
    return [x.title,x.claimant,claimSen(x.amount),x.method,x.paid_on,x.note];
  }
  if(kind==="repayment"){
    if(!draft?.claimId||typeof draft.claimId!=="string")
      throw new Error("Missing Claim ID for reimbursement.");
    const cents=claimSen(draft.amount);
    const method=String(draft.method||"").trim();
    if(!method)throw new Error("Choose a repayment account.");
    return [draft.claimId,cents,method,requireCalendarDate(draft.received_on),
      String(draft.note||"").trim().slice(0,1000)];
  }
  throw new Error("Unknown Claim request type.");
}
async function hashIntent(owner,kind,draft,cryptoProvider){
  if(!cryptoProvider?.randomUUID||!cryptoProvider?.subtle?.digest)
    throw new Error("Secure request tracking unavailable; Claim not submitted.");
  const signature=JSON.stringify([owner,kind,...normalizedIntent(kind,draft)]);
  const buffer=await cryptoProvider.subtle.digest("SHA-256",new TextEncoder().encode(signature));
  return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,"0")).join("");
}
function readPending(storage,key){
  let raw;
  try{raw=storage.getItem(key);}
  catch{throw new Error("Cannot safely read Claim retry status; nothing submitted.");}
  if(raw===null)return null;
  let item;
  try{item=JSON.parse(raw);}catch{
    throw new Error("Claim retry status cannot be verified. Nothing submitted; inspect Claim history.");
  }
  if(!item||!UUID.test(item.requestId||""))
    throw new Error("Claim retry ID is invalid. Nothing submitted; inspect Claim history.");
  return item.requestId;
}
export async function getClaimRequest(userId,kind,draft,storage,cryptoProvider,locks=null){
  if(!userId||!storage)throw new Error("Claim requires a signed-in account and browser retry storage.");
  const fingerprint=await hashIntent(userId,kind,draft,cryptoProvider);
  const key=PREFIX+userId+":"+kind+":"+fingerprint;
  const acquire=()=>{
    const existing=readPending(storage,key);
    if(existing)return {requestId:existing,key};
    const requestId=cryptoProvider.randomUUID();
    if(!UUID.test(requestId))throw new Error("Invalid secure Claim request ID.");
    try{storage.setItem(key,JSON.stringify({requestId}));}
    catch{throw new Error("Claim retry ID could not be saved; nothing submitted.");}
    const committed=readPending(storage,key);
    if(committed!==requestId)
      throw new Error("Concurrent Claim request detected; nothing submitted. Retry safely.");
    return {requestId,key};
  };
  // Chromium/Web Locks serializes first attempts across multiple open tabs.
  // Browsers without this facility still use an exact-ID read-after-write check.
  if(locks?.request)return locks.request("mh-claim:"+key,{mode:"exclusive"},acquire);
  return acquire();
}
export function confirmClaimRequest(userId,kind,request,storage){
  if(!userId||!storage||!request?.requestId||!request?.key)return false;
  if(!request.key.startsWith(PREFIX+userId+":"+kind+":"))return false;
  let current;
  try{current=readPending(storage,request.key);}catch{return false;}
  if(current!==request.requestId)return false;
  try{storage.removeItem(request.key);return true;}catch{return false;}
}
