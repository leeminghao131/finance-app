// Client request keys prevent a lost HTTP response from creating a second
// server row when the same pending add-record operation is retried.
// No financial values or notes are written to sessionStorage.
const PREFIX = "mh-finance-pending-record-v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function key(userId) { return PREFIX + userId; }

export async function getRecordRequestId(userId, payload, storage, cryptoProvider) {
  if (!userId || !storage || !cryptoProvider?.randomUUID || !cryptoProvider?.subtle?.digest) {
    throw new Error("Secure request tracking is unavailable; record not submitted.");
  }
  const signature = JSON.stringify([
    userId,payload.type,Number(payload.amount).toFixed(2),
    payload.category,payload.method,payload.note,payload.date,
  ]);
  const raw = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(signature));
  const fingerprint = Array.from(new Uint8Array(raw), byte=>byte.toString(16).padStart(2,"0")).join("");
  // FX transactions may round to the SAME MYR amount despite differing original
  // foreign amounts/currencies/rates. Never conflate those distinct intents.
  // Keep the original MYR fingerprint unchanged for backward-compatible retries.
  const fxFields=payload.fx_currency
    ? [payload.fx_currency,String(payload.fx_amount??""),String(payload.fx_rate??""),
       payload.fx_rate_date??"",payload.fx_provider??""] : null;
  const fxDigest=fxFields===null?null:await cryptoProvider.subtle.digest(
    "SHA-256",new TextEncoder().encode(JSON.stringify(fxFields)));
  const fxFingerprint=fxDigest===null?null:Array.from(new Uint8Array(fxDigest),
    byte=>byte.toString(16).padStart(2,"0")).join("");
  let saved=null;
  try { saved=JSON.parse(storage.getItem(key(userId)) || "null"); } catch { /* untrusted local cache */ }
  if (saved?.fingerprint===fingerprint && UUID.test(saved?.requestId || "")) {
    if (fxFingerprint===null && !saved.fxFingerprint) return saved.requestId;
    if (fxFingerprint!==null && (!saved.fxFingerprint || saved.fxFingerprint===fxFingerprint)) {
      // Old pending FX requests lack the second fingerprint. Preserve their
      // request ID for no-duplicate recovery; verify the SERVER row on conflict.
      return saved.requestId;
    }
  }
  const requestId=cryptoProvider.randomUUID();
  // Store hashes only, NEVER original amounts, notes, rates or currency details.
  storage.setItem(key(userId),JSON.stringify({
    requestId,fingerprint,...(fxFingerprint===null?{}:{fxFingerprint}),
  }));
  return requestId;
}

export function confirmRecordRequest(userId, requestId, storage) {
  if (!userId || !requestId || !storage) return;
  let saved;
  try { saved=JSON.parse(storage.getItem(key(userId)) || "null"); } catch { return; }
  if (saved?.requestId===requestId) {
    try { storage.removeItem(key(userId)); } catch { /* already committed; keep UI success */ }
  }
}

const TRANSFER_PREFIX = "mh-finance-pending-transfer-v1:";
export async function getTransferRequestId(userId, payload, storage, cryptoProvider) {
  if (!userId || !storage || !cryptoProvider?.randomUUID || !cryptoProvider?.subtle?.digest) {
    throw new Error("Secure transfer request tracking is unavailable; transfer not submitted.");
  }
  const signature = JSON.stringify([
    userId,payload.from_method,payload.to_method,Number(payload.amount).toFixed(2),
    payload.note,payload.date,
  ]);
  const bytes=await cryptoProvider.subtle.digest("SHA-256",new TextEncoder().encode(signature));
  const fingerprint=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
  const storageKey=TRANSFER_PREFIX+userId;
  let saved=null;
  try {saved=JSON.parse(storage.getItem(storageKey)||"null");} catch {}
  if (saved?.fingerprint===fingerprint && UUID.test(saved?.requestId||"")) return saved.requestId;
  const requestId=cryptoProvider.randomUUID();
  storage.setItem(storageKey,JSON.stringify({requestId,fingerprint}));
  return requestId;
}

export function confirmTransferRequest(userId,requestId,storage) {
  if (!userId || !requestId || !storage) return;
  const storageKey=TRANSFER_PREFIX+userId;
  let saved=null;
  try {saved=JSON.parse(storage.getItem(storageKey)||"null");} catch {return;}
  if(saved?.requestId===requestId) {
    try {storage.removeItem(storageKey);} catch {}
  }
}

// Read-after-commit recovery must never claim a DIFFERENT transaction was saved.
// The DB owns the UUID uniqueness check; these comparisons protect the user UI.
function decimalEquivalent(left,right){
  const canon=value=>{
    const raw=String(value??"").trim();
    if(!/^\\d+(?:\\.\\d+)?$/.test(raw))return null;
    const [whole,frac=""]=raw.split(".");
    const suffix=frac.replace(/0+$/,"");
    return whole.replace(/^0+(?=\\d)/,"")+(suffix?"."+suffix:"");
  };
  const a=canon(left),b=canon(right);
  return a!==null&&b!==null&&a===b;
}
function sameMYRCents(left,right){
  const a=Number(left),b=Number(right);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return false;
  const ac=Math.round(a*100),bc=Math.round(b*100);
  return Number.isSafeInteger(ac)&&Number.isSafeInteger(bc)&&ac===bc;
}
export function assertRecoveredRecordMatchesPayload(row,payload){
  if(!row||row.type!==payload.type||row.category!==payload.category||
     row.method!==payload.method||row.date!==payload.date||
     String(row.note||"")!==String(payload.note||"")||
     !sameMYRCents(row.amount,payload.amount)||
     String(row.fx_currency||"")!==String(payload.fx_currency||"")) {
    throw new Error("Recovered record differs from the pending transaction. Review Transaction Records; no new record was acknowledged.");
  }
  if(payload.fx_currency&&(
     !decimalEquivalent(row.fx_amount,payload.fx_amount)||
     !decimalEquivalent(row.fx_rate,payload.fx_rate)||
     row.fx_rate_date!==payload.fx_rate_date||
     row.fx_provider!==payload.fx_provider)) {
    throw new Error("Recovered FX record does not match its original foreign amount/rate. Check Transaction Records before retrying.");
  }
  return row;
}
export function assertRecoveredTransferMatchesPayload(row,payload){
  if(!row||row.from_method!==payload.from_method||row.to_method!==payload.to_method||
     row.date!==payload.date||String(row.note||"")!==String(payload.note||"")||
     !sameMYRCents(row.amount,payload.amount)) {
    throw new Error("Recovered Transfer differs from the pending transfer. Check Transfer History; no new Transfer was acknowledged.");
  }
  return row;
}
