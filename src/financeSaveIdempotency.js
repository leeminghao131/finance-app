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
  let saved=null;
  try { saved=JSON.parse(storage.getItem(key(userId)) || "null"); } catch { /* untrusted local cache */ }
  if (saved?.fingerprint===fingerprint && UUID.test(saved?.requestId || "")) {
    return saved.requestId;
  }
  const requestId=cryptoProvider.randomUUID();
  // Persist BEFORE sending. If storage is unavailable, refuse the write rather
  // than sending an operation that cannot be safely retried.
  storage.setItem(key(userId),JSON.stringify({requestId,fingerprint}));
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
