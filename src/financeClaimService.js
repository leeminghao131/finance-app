import {claimSen,validateClaimDraft,validateClaimRepayment} from "./financeClaims.js";
import {requireCalendarDate,localDateMY} from "./financeCalendar.js";

const claimColumns="id,user_id,client_request_id,title,claimant,amount,method,paid_on,note,submitted_on,cancelled_at,version,created_at,updated_at";
const repaymentColumns="id,user_id,claim_id,client_request_id,amount,method,received_on,note,voided_at,version,created_at,updated_at";
const requireOwner=(userId)=>{if(!userId)throw new Error("Sign in to save a claim.");};
function matches(row,payload,fields){
  return !!row && fields.every(k=>k==="amount"
    ?claimSen(row.amount)===claimSen(payload.amount)
    :String(row[k]??"")===String(payload[k]??""));
}
async function findRequest(client,table,userId,requestId,columns){
  const {data,error}=await client.from(table).select(columns)
    .eq("user_id",userId).eq("client_request_id",requestId).maybeSingle();
  if(error)throw error;
  return data;
}
function requestConflict(message){
  const error=new Error(message);error.financeClaimRequestConflict=true;return error;
}
function explainWriteFailure(error){
  if(error?.financeClaimRequestConflict)return error;
  const message=String(error?.message||"Network response uncertain");
  return new Error(message+". If network was interrupted, refresh to confirm before retrying with the SAME draft.");
}
async function idempotentInsert(client,{table,userId,requestId,payload,columns,fields,beforeInsert}){
  const first=await findRequest(client,table,userId,requestId,columns);
  if(first){
    if(!matches(first,payload,fields)||table==="finance_claims"&&first.cancelled_at)
      throw requestConflict("This claim request ID belongs to a different or cancelled payment. Refresh and review before submitting again.");
    return first;
  }
  if(beforeInsert)await beforeInsert();
  const {data,error}=await client.from(table).insert({...payload,user_id:userId,client_request_id:requestId})
    .select(columns).single();
  if(!error&&data){
    if(!matches(data,payload,fields)||data.user_id!==userId)
      throw new Error("Server claim confirmation does not match the submitted payment.");
    return data;
  }
  // A timeout/unique collision can mean the database saved successfully.
  // Query by stable request ID; never automatically insert again with a new ID.
  try{
    const recovered=await findRequest(client,table,userId,requestId,columns);
    if(recovered){
      if(!matches(recovered,payload,fields)||table==="finance_claims"&&recovered.cancelled_at)
        throw requestConflict("Server returned a different or cancelled claim for this request ID. Refresh before submitting again.");
      return recovered;
    }
  }catch(e){throw explainWriteFailure(e);}
  throw explainWriteFailure(error);
}
export async function createFinanceClaim(client,userId,draft,requestId,confirmedMatchingIds=null){
  requireOwner(userId);
  if(!requestId)throw new Error("Missing stable claim request ID.");
  const payload=validateClaimDraft(draft);
  return idempotentInsert(client,{
    table:"finance_claims",userId,requestId,payload,columns:claimColumns,
    beforeInsert:Array.isArray(confirmedMatchingIds)?async()=>{
      const {data,error}=await client.from("finance_claims").select("id")
        .eq("user_id",userId).eq("title",payload.title).eq("claimant",payload.claimant)
        .eq("paid_on",payload.paid_on).eq("method",payload.method).eq("amount",payload.amount);
      if(error||!Array.isArray(data))throw new Error("Cannot verify matching claims; nothing submitted.");
      if(data.length!==new Set(confirmedMatchingIds).size||data.some(row=>!confirmedMatchingIds.includes(row.id)))
        throw new Error("A matching advance appeared on another device. Refresh and review the claim before retrying.");
    }:null,
    fields:["title","claimant","amount","method","paid_on","note"],
  });
}
export async function createFinanceClaimRepayment(client,userId,claim,draft,existing,requestId){
  requireOwner(userId);
  if(!claim||claim.user_id!==userId)throw new Error("Claim owner mismatch.");
  if(!requestId)throw new Error("Missing stable reimbursement request ID.");
  // Check this exact request BEFORE recalculating outstanding. A previous write
  // may have committed while the network response was lost; then the claim is
  // already fully repaid and validating a fresh payment would falsely reject
  // a safe retry. The recovered row is never inserted or counted twice.
  const recovered=await findRequest(client,"finance_claim_repayments",userId,requestId,repaymentColumns);
  if(recovered){
    const expected={
      claim_id:claim.id,
      amount:claimSen(draft.amount)/100,
      method:String(draft.method||"").trim(),
      received_on:requireCalendarDate(draft.received_on),
      note:String(draft.note||"").trim().slice(0,1000),
    };
    if(!matches(recovered,expected,["claim_id","amount","method","received_on","note"]))
      throw new Error("This reimbursement request ID belongs to a different payment; refusing duplicate or overwrite.");
    return recovered;
  }
  const payload=validateClaimRepayment(draft,claim,existing);
  return idempotentInsert(client,{
    table:"finance_claim_repayments",userId,requestId,payload,columns:repaymentColumns,
    fields:["claim_id","amount","method","received_on","note"],
  });
}
export async function submitFinanceClaim(client,userId,claim,date=localDateMY()){
  requireOwner(userId);
  if(claim.user_id!==userId||claim.cancelled_at)throw new Error("Claim unavailable.");
  if(claim.submitted_on)return claim;
  requireCalendarDate(date);
  const {data,error}=await client.from("finance_claims").update({submitted_on:date})
    .eq("id",claim.id).eq("user_id",userId).eq("version",claim.version)
    .is("cancelled_at",null).is("submitted_on",null)
    .select(claimColumns).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("Claim changed on another device. Refresh before submitting again.");
  return data;
}
export async function cancelFinanceClaim(client,userId,claim,repayments=[]){
  requireOwner(userId);
  if(claim.user_id!==userId||claim.cancelled_at)throw new Error("Claim unavailable.");
  if(repayments.some(r=>r.claim_id===claim.id&&!r.voided_at))
    throw new Error("Claim has repayments. Void those entries before cancellation.");
  const {data,error}=await client.from("finance_claims").update({cancelled_at:new Date().toISOString()})
    .eq("id",claim.id).eq("user_id",userId).eq("version",claim.version)
    .is("cancelled_at",null).select(claimColumns).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("Claim changed on another device. Refresh before cancelling.");
  return data;
}
export async function voidFinanceClaimRepayment(client,userId,entry){
  requireOwner(userId);
  if(entry.user_id!==userId||entry.voided_at)throw new Error("Repayment unavailable.");
  const {data,error}=await client.from("finance_claim_repayments")
    .update({voided_at:new Date().toISOString()})
    .eq("id",entry.id).eq("user_id",userId).eq("version",entry.version)
    .is("voided_at",null).select(repaymentColumns).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("Repayment changed on another device. Refresh before correcting.");
  return data;
}
