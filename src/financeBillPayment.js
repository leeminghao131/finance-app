import {requireCalendarDate} from "./financeCalendar.js";
import {validateBills,billOccurrences} from "./financeStage2.js";
import {normalizeRecord} from "./financeRecords.js";
import {cents} from "./financeStage1Analytics.js";
import {canonicalFinanceMethod} from "./financeMethodKeys.js";

const fields="id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at";
const validOwner=id=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(String(id||""));

/**
 * Deterministic cross-device request key for one bill occurrence.
 * The existing UNIQUE (user_id,client_request_id) index on public.records
 * ensures retries and simultaneous phones cannot duplicate an Expense.
 * No PII/financial amounts are included in this key, and no secret is stored.
 */
export async function recurringBillRequestId(userId,billId,due,cryptoProvider=globalThis.crypto){
  if(!validOwner(userId)||!/^[a-zA-Z0-9-]{8,100}$/.test(String(billId)))
    throw new Error("Cannot verify bill and user identity.");
  requireCalendarDate(due);
  if(!cryptoProvider?.subtle?.digest)throw new Error("Secure request identity is unavailable. Payment not sent.");
  const material=new TextEncoder().encode("mh-finance-stage2.1-bill-payment:v1:"+userId+":"+billId+":"+due);
  const hash=new Uint8Array(await cryptoProvider.subtle.digest("SHA-256",material));
  if(hash.length<16)throw new Error("Secure digest unavailable.");
  const bytes=hash.slice(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
}

export function checkBillPaymentEligibility(bills,billId,due,records=[],today){
  requireCalendarDate(today);
  const plans=validateBills(bills);
  const bill=plans.find(b=>b.id===billId&&b.active);
  if(!bill)throw Error("Bill plan is missing or inactive. Refresh the page.");
  const occurrence=billOccurrences(plans,today,records,90,45).find(e=>e.billId===billId&&e.due===due);
  if(!occurrence)throw Error("Selected bill date is no longer scheduled. Refresh.");
  if(occurrence.status==="paid"||occurrence.status==="unlinked")
    throw Error("This bill was already marked paid. Restore or review its existing Expense; do not create another.");
  if(occurrence.status==="skipped")throw Error("This bill occurrence was skipped. Review the plan before paying.");
  if(!occurrence.visible)throw Error("This bill is not currently due for payment confirmation.");
  return bill;
}
export function matchesBillPaymentRecord(row,bill){
  return !!row&&row.type==="expense"&&!row.deleted_at
    &&cents(row.amount)===cents(bill.amount)
    &&String(row.category)===bill.category
    &&canonicalFinanceMethod(row.method)===canonicalFinanceMethod(bill.method)
    &&String(row.note||"")===bill.title;
}

/**
 * Deliberately separate from protected addRecord(). Only one owner-scoped,
 * idempotent INSERT (or read-after-commit recovery) happens here.
 * Settings status is saved separately by existing version-checked callback.
 * If that second write fails, re-clicking recovers this EXACT Expense ID.
 */
export async function createBillPaymentExpense(client,userId,bill,due,paidDate,cryptoProvider=globalThis.crypto){
  if(!client||!validOwner(userId))throw Error("Sign in to a verified finance account first.");
  requireCalendarDate(paidDate);
  const verified=validateBills([bill])[0];
  const requestId=await recurringBillRequestId(userId,verified.id,due,cryptoProvider);
  const existing=async()=>{
    const {data,error}=await client.from("records").select(fields)
      .eq("user_id",userId).eq("client_request_id",requestId).maybeSingle();
    if(error)throw error;
    return data;
  };
  const confirm=row=>{
    if(row?.deleted_at)throw Error("The original bill Expense is in Recycle Bin. Restore/review it; no new Expense was created.");
    if(!matchesBillPaymentRecord(row,verified))
      throw Error("A prior bill payment was modified or does not match this plan. Review the existing Expense manually; do not recreate it.");
    return normalizeRecord(row);
  };
  // Read-before-insert is a speed optimization; database uniqueness is the authority.
  const prior=await existing();
  if(prior)return {record:confirm(prior),created:false,requestId};
  const payload={user_id:userId,type:"expense",amount:verified.amount,
    category:verified.category,method:canonicalFinanceMethod(verified.method),note:verified.title,
    date:paidDate,client_request_id:requestId};
  let inserted;
  try{
    const {data,error}=await client.from("records").insert(payload).select(fields).single();
    if(error){
      if(error.code!=="23505")throw error;
    }else inserted=data;
  }catch(error){
    // A lost HTTP response can occur AFTER the server committed. Always try recovery
    // with the same stable key, never a fresh INSERT request ID.
    const recovered=await existing();
    if(recovered)return {record:confirm(recovered),created:false,requestId};
    throw error;
  }
  if(inserted)return {record:confirm(inserted),created:true,requestId};
  const recovered=await existing();
  if(!recovered)throw Error("Bill payment not confirmed. Refresh verified records before retrying.");
  return {record:confirm(recovered),created:false,requestId};
}
