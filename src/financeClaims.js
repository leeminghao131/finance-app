import {requireCalendarDate,localDateMY} from "./financeCalendar.js";

// Claims are a separate cash-flow ledger, NEVER an Income, Expense or Transfer.
export function claimSen(value){
  const raw=String(value??"").trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error("Use a positive RM amount with at most 2 decimals.");
  const [whole,fraction=""]=raw.split(".");
  const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(cents)||cents<=0||cents>999999999999)
    throw new Error("Claim amount is outside the safe range.");
  return cents;
}
const asRM=sen=>sen/100;
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||""));
export function validateClaimDraft(draft,today=localDateMY()){
  const amount=claimSen(draft.amount),paid_on=requireCalendarDate(draft.paid_on);
  if(paid_on>today)throw new Error("Only money already paid can become a claim.");
  const method=String(draft.method||"").trim();
  const title=String(draft.title||"").trim();
  const claimant=String(draft.claimant||"").trim();
  const note=String(draft.note||"").trim();
  if(!title||title.length>160)throw new Error("Provide a claim description (up to 160 characters).");
  if(!claimant||claimant.length>160)throw new Error("Provide the company or person who owes you.");
  if(!method||method.length>120)throw new Error("Choose the payment method.");
  if(note.length>1000)throw new Error("Note is too long.");
  return {paid_on,amount:asRM(amount),method,title,claimant,note};
}
export function validateClaimRepayment(draft,claim,existing=[],today=localDateMY()){
  if(!claim||claim.cancelled_at)throw new Error("Claim is not active.");
  const received_on=requireCalendarDate(draft.received_on);
  if(received_on>today||received_on<claim.paid_on)throw new Error("Repayment date must be after the advance and no later than today.");
  const method=String(draft.method||"").trim();
  if(!method||method.length>120)throw new Error("Choose the actual receiving method.");
  const cents=claimSen(draft.amount);
  const repaid=existing.filter(row=>row.claim_id===claim.id&&!row.voided_at)
    .reduce((sum,row)=>sum+claimSen(row.amount),0);
  if(cents>claimSen(claim.amount)-repaid)throw new Error("Repayment cannot exceed the outstanding claim.");
  return {claim_id:claim.id,amount:asRM(cents),received_on,method,note:String(draft.note||"").trim().slice(0,1000)};
}
export function validateClaimSnapshot(claims=[],repayments=[],userId=null){
  if(!Array.isArray(claims)||!Array.isArray(repayments))throw new Error("Claim cloud snapshot is incomplete.");
  const unique=new Set(),claimMap=new Map(),totals=new Map();
  for(const claim of claims){
    if(!validId(claim.id)||unique.has("c"+claim.id))throw new Error("Invalid or duplicate claim ID.");
    unique.add("c"+claim.id);
    if(userId&&claim.user_id!==userId)throw new Error("Claim owner mismatch.");
    claimSen(claim.amount);requireCalendarDate(claim.paid_on);
    if(!claim.method||!claim.title||!claim.claimant||Number(claim.version)<1)
      throw new Error("Claim contains invalid fields.");
    claimMap.set(claim.id,claim);
  }
  for(const row of repayments){
    if(!validId(row.id)||unique.has("r"+row.id))throw new Error("Invalid or duplicate repayment ID.");
    unique.add("r"+row.id);
    if(userId&&row.user_id!==userId)throw new Error("Repayment owner mismatch.");
    const claim=claimMap.get(row.claim_id);
    if(!claim||claim.user_id!==row.user_id)throw new Error("Repayment does not belong to a visible claim.");
    requireCalendarDate(row.received_on);
    if(row.received_on<claim.paid_on||!row.method||Number(row.version)<1)
      throw new Error("Invalid claim repayment.");
    const amount=claimSen(row.amount);
    if(!row.voided_at){
      if(claim.cancelled_at)throw new Error("Cancelled claim has a live repayment.");
      totals.set(claim.id,(totals.get(claim.id)||0)+amount);
    }
  }
  for(const claim of claims)
    if((totals.get(claim.id)||0)>claimSen(claim.amount))
      throw new Error("Claim was over-reimbursed; financial totals are blocked.");
  return {claims,repayments};
}
export function claimCashMovements(claims=[],repayments=[]){
  const visible=new Map(claims.filter(c=>!c.cancelled_at).map(c=>[c.id,c]));
  const events=[];
  for(const c of visible.values())
    events.push({id:"claim:"+c.id,date:c.paid_on,method:c.method,sen:-claimSen(c.amount),kind:"advance"});
  for(const r of repayments){
    if(r.voided_at||!visible.has(r.claim_id))continue;
    events.push({id:"repayment:"+r.id,date:r.received_on,method:r.method,sen:claimSen(r.amount),kind:"reimbursement"});
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export function claimCashSenUntil(events=[],day=localDateMY()){
  return events.filter(e=>e.date<=day).reduce((sum,e)=>sum+e.sen,0);
}
export function claimSummary(claims=[],repayments=[],day=localDateMY()){
  const byClaim=new Map();
  for(const r of repayments)
    if(!r.voided_at&&r.received_on<=day)byClaim.set(r.claim_id,(byClaim.get(r.claim_id)||0)+claimSen(r.amount));
  const rows=claims.filter(c=>c.paid_on<=day).map(c=>{
    const cancelled=!!c.cancelled_at;
    const paidSen=cancelled?0:byClaim.get(c.id)||0;
    const remainingSen=cancelled?0:claimSen(c.amount)-paidSen;
    return {...c,repaid:asRM(paidSen),outstanding:asRM(Math.max(0,remainingSen)),
      progress:paidSen?Math.min(100,paidSen/claimSen(c.amount)*100):0,
      status:cancelled?"cancelled":remainingSen<=0?"completed":c.submitted_on?"submitted":"pending"};
  }).sort((a,b)=>b.paid_on.localeCompare(a.paid_on)||String(b.created_at||"").localeCompare(String(a.created_at||"")));
  const active=rows.filter(c=>!c.cancelled_at);
  return {rows,open:active.filter(c=>c.outstanding>0),
    outstanding:asRM(active.reduce((sum,c)=>sum+Math.round(c.outstanding*100),0)),
    reimbursed:asRM(active.reduce((sum,c)=>sum+Math.round(c.repaid*100),0))};
}
export function withClaimMethodBalances(base=[],movements=[],day=localDateMY(),normalize=x=>String(x||"").trim()){
  const map=new Map(base.map(row=>[normalize(row.method),{...row,claimOut:0,claimIn:0}]));
  for(const event of movements){
    if(event.date>day)continue;
    const key=normalize(event.method);
    if(!key)throw new Error("Claim has invalid method.");
    if(!map.has(key))map.set(key,{method:key,openingBalance:0,income:0,expense:0,
      transferIn:0,transferOut:0,balance:0,claimOut:0,claimIn:0});
    const row=map.get(key);
    if(event.sen<0)row.claimOut+=-event.sen;
    else row.claimIn+=event.sen;
  }
  return [...map.values()].map(row=>({...row,claimOut:asRM(row.claimOut),
    claimIn:asRM(row.claimIn),
    balance:asRM(Math.round(Number(row.balance)*100)+row.claimIn-row.claimOut)}));
}
