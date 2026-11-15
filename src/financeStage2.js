import {calendarMonthDays,requireCalendarDate,shiftCalendarDay} from "./financeCalendar.js";
import {cents} from "./financeStage1Analytics.js";

// Stage 2: all helpers are pure/read-only and use integer sen when comparing money.
// No helper issues SQL, changes a saved transaction, or moves Money Transfers.
const iso=raw=>requireCalendarDate(raw);
const dayNum=date=>Date.parse(iso(date)+"T00:00:00Z")/86400000;
const addMonth=(anchor,offset)=>{
  const [y,m,d]=anchor.split("-").map(Number);
  const base=new Date(Date.UTC(y,m-1+offset,1));
  const month=base.toISOString().slice(0,7);
  return month+"-"+String(Math.min(d,calendarMonthDays(month))).padStart(2,"0");
};
const cleanAmount=(v,positive=true)=>{
  const raw=String(v??"").trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw))throw Error("Enter a valid RM amount with at most two decimals.");
  const amount=cents(raw);
  if(positive&&amount<=0||!Number.isSafeInteger(amount))throw Error("A positive, safe RM amount is required.");
  return amount/100;
};
const cleanText=(value,max)=>{
  const text=String(value??"").trim();
  if(text.length>max)throw Error("Text exceeds allowed length; no content was truncated.");
  return text;
};
const uniqueIds=list=>{
  const s=new Set();
  for(const item of list){if(s.has(item.id))throw Error("Duplicate planning ID.");s.add(item.id);}
};
export function validateBills(raw){
  if(!Array.isArray(raw)||raw.length>40)throw Error("At most 40 recurring bills.");
  const bills=raw.map(b=>{
    if(!b||typeof b!=="object"||Array.isArray(b))throw Error("Invalid bill plan.");
    const id=String(b.id||"");
    if(!/^[A-Za-z0-9-]{8,100}$/.test(id))throw Error("Invalid bill ID.");
    const title=cleanText(b.title,90);
    if(!title)throw Error("Bill name is required.");
    const amount=cleanAmount(b.amount);
    const category=cleanText(b.category,100),method=cleanText(b.method,100);
    if(!category||!method)throw Error("Bill Category and Method are required.");
    const cycle=String(b.cycle||"monthly");
    if(!["weekly","monthly","quarterly","yearly"].includes(cycle))throw Error("Invalid bill cycle.");
    const anchorDate=iso(b.anchorDate);
    const leadDays=Number(b.leadDays??3);
    if(!Number.isInteger(leadDays)||leadDays<0||leadDays>30)throw Error("Reminder lead days must be 0–30.");
    const occurrences=b.occurrences??[];
    if(!Array.isArray(occurrences)||occurrences.length>160)throw Error("Too many bill confirmations. Archive in a future revision.");
    const saved=occurrences.map(x=>{
      const due=iso(x?.due),status=x?.status;
      if(!["paid","skipped","snoozed"].includes(status))throw Error("Invalid bill occurrence status.");
      const recordId=status==="paid"?String(x?.recordId||""):"";
      if(status==="paid"&&(!recordId||recordId.length>100))throw Error("Paid bills must link an existing Expense.");
      const remindOn=status==="snoozed"?iso(x?.remindOn):"";
      return {due,status,recordId,remindOn};
    });
    if(new Set(saved.map(x=>x.due)).size!==saved.length)throw Error("Duplicate bill occurrence.");
    return {id,title,amount,category,method,cycle,anchorDate,leadDays,active:b.active!==false,occurrences:saved};
  });
  uniqueIds(bills);return bills;
}
export function billOccurrences(bills,asOfDate,records=[],history=35,horizon=35){
  iso(asOfDate);
  if(!Array.isArray(records))throw Error("Verified Expense records are unavailable.");
  const first=shiftCalendarDay(asOfDate,-history),last=shiftCalendarDay(asOfDate,horizon),items=[];
  for(const b of validateBills(bills)){
    if(!b.active)continue;
    let cursor=0;
    const offset=b.cycle==="weekly"?7:b.cycle==="monthly"?1:b.cycle==="quarterly"?3:12;
    for(let n=0;n<520;n++){
      const due=b.cycle==="weekly"?shiftCalendarDay(b.anchorDate,n*offset):addMonth(b.anchorDate,n*offset);
      if(due>last)break;
      if(due<first)continue;
      const status=b.occurrences.find(o=>o.due===due);
      const linked=status?.status==="paid"
        ?records.some(r=>String(r.id)===status.recordId&&r.type==="expense"&&!r.deleted_at):false;
      const dismissed=status?.status==="skipped"||status?.status==="paid"&&linked;
      const noticeDate=status?.status==="snoozed"?status.remindOn:shiftCalendarDay(due,-b.leadDays);
      items.push({id:b.id+":"+due,billId:b.id,title:b.title,category:b.category,method:b.method,
        amount:b.amount,due,noticeDate,phase:due<asOfDate?"overdue":due===asOfDate?"today":"upcoming",
        status:status?.status==="paid"&&!linked?"unlinked":status?.status||"pending",
        linkedRecordId:linked?status.recordId:null,
        visible:!dismissed&&noticeDate<=asOfDate,
        snoozed:status?.status==="snoozed"&&noticeDate>asOfDate});
    }
  }
  return items.sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title));
}
export function withBillOccurrence(bills,billId,due,change){
  iso(due);
  const snapshot=validateBills(bills);
  if(!snapshot.some(b=>b.id===billId))throw Error("Bill not found. Refresh first.");
  return validateBills(snapshot.map(b=>{
    if(b.id!==billId)return b;
    const occurrences=b.occurrences.filter(x=>x.due!==due);
    if(change){
      if(!["paid","skipped","snoozed"].includes(change.status))throw Error("Unsupported action.");
      occurrences.push({...change,due});
    }
    return {...b,occurrences:occurrences.sort((a,b)=>a.due.localeCompare(b.due))};
  }));
}

const normalizeMethod=value=>{
  const raw=String(value||"").trim(),upper=raw.toUpperCase();
  return ["BANK IN","ONLINE BANK IN","DEBIT CARD"].includes(upper)?"BANK":raw;
};
export const recordFingerprint=r=>
  [r.id,r.version??"",r.updated_at??"",r.date,r.type,r.amount,r.category,r.method,r.note??""].join("|");
export const REVIEW_RULE_KEYS=Object.freeze(["large","duplicate","missingNote","futureDate"]);
export const DEFAULT_REVIEW_RULES=Object.freeze({
  large:true,duplicate:true,missingNote:true,futureDate:true
});
export function validateReviewState(input){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid Review Inbox state.");
  const threshold=cleanAmount(input.threshold??500);
  const settings=input.enabled??DEFAULT_REVIEW_RULES;
  if(!settings||typeof settings!=="object"||Array.isArray(settings))
    throw Error("Review switches are invalid.");
  const enabled={...DEFAULT_REVIEW_RULES};
  for(const rule of REVIEW_RULE_KEYS){
    if(settings[rule]!==undefined&&typeof settings[rule]!=="boolean")
      throw Error("Review switch must be on or off.");
    if(settings[rule]!==undefined)enabled[rule]=settings[rule];
  }
  const decisions=input.decisions??[];
  if(!Array.isArray(decisions)||decisions.length>5000)throw Error("Review history exceeds safety limit.");
  const seen=new Set();
  const normalized=decisions.map(d=>{
    const id=String(d?.recordId??"");
    if(!id||id.length>100||seen.has(id))throw Error("Invalid or duplicate reviewed record.");
    seen.add(id);
    const fingerprint=String(d.fingerprint||"");
    if(!fingerprint||fingerprint.length>900)throw Error("Invalid review fingerprint.");
    const checkedAt=iso(d.checkedAt);
    return {recordId:id,fingerprint,checkedAt};
  });
  return {threshold,enabled,decisions:normalized};
}
export function findReviewCandidates(records,rawState={},asOfDate,limitDays=180){
  iso(asOfDate);
  if(!Array.isArray(records))throw Error("Complete finance records not ready.");
  const state=validateReviewState({threshold:rawState?.threshold??500,enabled:rawState?.enabled,decisions:rawState?.decisions??[]});
  const start=shiftCalendarDay(asOfDate,-limitDays);
  const today=asOfDate;
  const rows=records.filter(r=>r&&!r.deleted_at&&["expense","income"].includes(r.type));
  const reviewed=new Map(state.decisions.map(d=>[d.recordId,d.fingerprint]));
  const duplicates=new Map();
  for(const r of rows){
    const key=[r.date,r.type,r.category,normalizeMethod(r.method),Math.round(Number(r.amount)*100)].join("|");
    const group=duplicates.get(key)||[];group.push(r);duplicates.set(key,group);
  }
  const results=[];
  for(const r of rows){
    if(!r.date||r.date<start)continue;
    const reasons=[];
    if(state.enabled.large&&r.type==="expense"&&cents(r.amount)>=cents(state.threshold))reasons.push("large");
    if(state.enabled.missingNote&&!String(r.note||"").trim())reasons.push("missingNote");
    if(state.enabled.futureDate&&r.date>today)reasons.push("futureDate");
    const key=[r.date,r.type,r.category,normalizeMethod(r.method),Math.round(Number(r.amount)*100)].join("|");
    if(state.enabled.duplicate&&(duplicates.get(key)||[]).length>1)reasons.push("duplicate");
    if(!reasons.length)continue;
    const fingerprint=recordFingerprint(r);
    const confirmed=reviewed.get(String(r.id))===fingerprint;
    results.push({id:String(r.id),record:r,reasons,fingerprint,confirmed});
  }
  return results.sort((a,b)=>Number(a.confirmed)-Number(b.confirmed)
    ||b.record.date.localeCompare(a.record.date)||String(a.record.id).localeCompare(String(b.record.id)));
}
export function confirmReview(state,record,atDate){
  const prior=validateReviewState(state),id=String(record.id);
  const decisions=prior.decisions.filter(d=>d.recordId!==id);
  decisions.push({recordId:id,fingerprint:recordFingerprint(record),checkedAt:iso(atDate)});
  return validateReviewState({...prior,decisions});
}

export function validateAccountChecks(input){
  if(!Array.isArray(input)||input.length>800)throw Error("Account reconciliation history reached its safe limit.");
  const result=input.map(x=>{
    if(!x||typeof x!=="object")throw Error("Invalid reconciliation entry.");
    const id=String(x.id||"");
    if(!/^[A-Za-z0-9-]{8,100}$/.test(id))throw Error("Invalid reconciliation ID.");
    const method=cleanText(x.method,100);
    if(!method)throw Error("Select a Method.");
    const date=iso(x.date);
    const counted=Number(x.actual),ledger=Number(x.ledger);
    if(!Number.isFinite(counted)||!Number.isFinite(ledger))throw Error("Invalid reconciliation amount.");
    // Actual account amount may be negative (overdraft) and must retain sen precision.
    const a=cents(counted),l=cents(ledger);
    return {id,method,date,actual:a/100,ledger:l/100,difference:(a-l)/100,note:cleanText(x.note,240)};
  });
  uniqueIds(result);return result;
}
export function reconcileMethod(method,actual,ledger,date,id,note=""){
  return validateAccountChecks([{id,method,date,actual,ledger,note}])[0];
}
