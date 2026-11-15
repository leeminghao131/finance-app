import {parseOpeningAmount,calculateMethodBalances} from "./financeOpeningBalance.js";
import {normalizeTransfer} from "./financeRecords.js";
import {canonicalFinanceMethod} from "./financeMethodKeys.js";
import {requireCalendarDate} from "./financeCalendar.js";

const SAFE_LIMIT=Number.MAX_SAFE_INTEGER;
const toCents=value=>{
  const parsed=parseOpeningAmount(value);
  const n=Math.round(parsed*100);
  if(!Number.isSafeInteger(n)||Math.abs(n)>SAFE_LIMIT/8)throw Error("Amount exceeds safe reconciliation range.");
  return n;
};
export const rm=sen=>Number((sen/100).toFixed(2));

/**
 * Actual - ledger:
 *   positive means this Method needs an INCOMING missing transfer;
 *   negative means it needs an OUTGOING missing transfer.
 * Neither transfer changes overall assets; unmatched residual needs independent
 * investigation (possibly a missing Income/Expense), never auto-corrected.
 */
export function planReconciliationTransfers(balances,actualByMethod){
  if(!Array.isArray(balances)||!balances.length||balances.length>30)
    throw Error("Complete account balances are required (maximum 30 Methods).");
  const seen=new Set();
  const rows=balances.map(row=>{
    const method=canonicalFinanceMethod(row.method);
    if(!method||seen.has(method))throw Error("Duplicate/invalid Method in balance snapshot.");
    seen.add(method);
    if(!Object.hasOwn(actualByMethod??{},method))
      throw Error("Enter the actual balance for every Method before matching.");
    const actual=toCents(actualByMethod[method]);
    const ledger=toCents(row.balance);
    return {method,ledger,actual,difference:actual-ledger};
  });
  const donor=rows.filter(x=>x.difference<0).map(x=>({...x,remaining:-x.difference}));
  const receiver=rows.filter(x=>x.difference>0).map(x=>({...x,remaining:x.difference}));
  const transfers=[];
  for(const from of donor){
    for(const to of receiver){
      if(from.remaining<=0)break;
      if(to.remaining<=0)continue;
      const size=Math.min(from.remaining,to.remaining);
      if(size>0){
        transfers.push({fromMethod:from.method,toMethod:to.method,amount:rm(size)});
        from.remaining-=size;to.remaining-=size;
      }
    }
  }
  const remainingIncome=receiver.reduce((sum,x)=>sum+x.remaining,0);
  const remainingExpense=donor.reduce((sum,x)=>sum+x.remaining,0);
  const ledgerTotal=rows.reduce((sum,x)=>sum+x.ledger,0);
  const actualTotal=rows.reduce((sum,x)=>sum+x.actual,0);
  if(!Number.isSafeInteger(ledgerTotal)||!Number.isSafeInteger(actualTotal))
    throw Error("Unsafe balance total.");
  if(actualTotal-ledgerTotal!==remainingIncome-remainingExpense)
    throw Error("Reconciliation invariant violated: no transfers executed.");
  return {rows:rows.map(r=>({...r,ledger:rm(r.ledger),actual:rm(r.actual),difference:rm(r.difference)})),
    transfers,remainingIncome:rm(remainingIncome),remainingExpense:rm(remainingExpense),
    difference:rm(actualTotal-ledgerTotal),ledgerTotal:rm(ledgerTotal),actualTotal:rm(actualTotal)};
}

const ownerId=id=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id||""));
const columns="id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at";
export async function reconciliationTransferId(userId,signature,index,cryptoProvider=globalThis.crypto){
  if(!ownerId(userId)||!cryptoProvider?.subtle?.digest||!Number.isInteger(index)||index<0)
    throw Error("Safe reconciliation transfer identity unavailable.");
  const src=new TextEncoder().encode("mh-finance-reconcile-v1:"+userId+":"+signature+":"+index);
  const b=new Uint8Array(await cryptoProvider.subtle.digest("SHA-256",src));
  if(b.length<16)throw Error("Safe digest missing.");
  const v=b.slice(0,16);
  v[6]=(v[6]&15)|64;v[8]=(v[8]&63)|128;
  const h=Array.from(v,x=>x.toString(16).padStart(2,"0")).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
export function reconciliationSignature(plan,date){
  requireCalendarDate(date);
  return JSON.stringify({date,rows:plan.rows.map(r=>[r.method,r.ledger,r.actual]),
    transfers:plan.transfers.map(t=>[t.fromMethod,t.toMethod,t.amount])});
}
/** Idempotent isolated service using existing owner RLS + UNIQUE client_request_id. */
export async function writeReconciliationTransfer(client,userId,plan,date,index,cryptoProvider=globalThis.crypto){
  const t=plan.transfers[index];
  if(!t||t.fromMethod===t.toMethod||toCents(t.amount)<=0||!client)
    throw Error("Invalid planned reconciliation transfer.");
  const requestId=await reconciliationTransferId(userId,reconciliationSignature(plan,date),index,cryptoProvider);
  const read=async()=>{
    const {data,error}=await client.from("transfers").select(columns)
      .eq("user_id",userId).eq("client_request_id",requestId).maybeSingle();
    if(error)throw error;return data;
  };
  const confirm=row=>{
    if(row.deleted_at)throw Error("Previous reconciliation transfer is in Recycle Bin; stop to inspect.");
    if(row.from_method!==t.fromMethod||row.to_method!==t.toMethod||toCents(row.amount)!==toCents(t.amount))
      throw Error("Prior transfer differs from plan. Stop and inspect original.");
    return normalizeTransfer(row);
  };
  const previous=await read();
  if(previous)return {transfer:confirm(previous),created:false};
  const payload={user_id:userId,from_method:t.fromMethod,to_method:t.toMethod,
    amount:t.amount,date,note:"Balance reconciliation",client_request_id:requestId};
  let inserted=null;
  try{
    const {data,error}=await client.from("transfers").insert(payload).select(columns).single();
    if(error){
      if(error.code!=="23505")throw error;
    }else inserted=data;
  }catch(e){
    const recovered=await read();
    if(recovered)return {transfer:confirm(recovered),created:false};
    throw e;
  }
  if(inserted)return {transfer:confirm(inserted),created:true};
  const recovered=await read();
  if(!recovered)throw Error("Unconfirmed transfer. Refresh verified cloud data before retrying.");
  return {transfer:confirm(recovered),created:false};
}
export function methodBalancesFromSnapshot(snapshot,methodOptions,normalize=canonicalFinanceMethod){
  return calculateMethodBalances(snapshot.records,snapshot.transfers,methodOptions,
    snapshot.settingsRow?.opening_balances||{},normalize);
}
