import {requireCalendarDate,inclusiveCalendarDays,localDateMY} from "./financeCalendar.js";
import {cents,rm} from "./financeStage1Analytics.js";

const uuid=/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
export function validActivityTitle(title){
  if(typeof title!=="string"||!title.trim()||title.trim().length>90)throw Error("Activity name must be 1–90 characters.");
  return title.trim();
}
export function validActivityBudget(value){
  if(value===null||value===undefined||String(value).trim()==="")return null;
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(value).trim()))throw Error("Enter a valid activity budget in RM.");
  const sen=cents(value);
  if(sen<=0||sen>99999999999999)throw Error("Activity budget must be positive and within the permitted range.");
  return rm(sen);
}
const idOf=x=>String(x??"");
export function normalizeActivity(row){
  if(!row||!uuid.test(idOf(row.id))||!uuid.test(idOf(row.user_id)))throw Error("Invalid activity identity.");
  const status=String(row.status);
  if(!["active","paused","finished"].includes(status))throw Error("Invalid activity status.");
  const startedOn=requireCalendarDate(String(row.started_on));
  const endedOn=row.ended_on?requireCalendarDate(String(row.ended_on)):null;
  if((status==="finished")!==Boolean(endedOn)||endedOn&&endedOn<startedOn)
    throw Error("Inconsistent activity dates.");
  const version=Number(row.version);
  if(!Number.isSafeInteger(version)||version<1)throw Error("Invalid activity version.");
  return {id:idOf(row.id),userId:idOf(row.user_id),title:validActivityTitle(row.title),
    budget:validActivityBudget(row.budget),status,startedOn,endedOn,version};
}
export function validateActivities(rows){
  if(!Array.isArray(rows)||rows.length>1000)throw Error("Incomplete or invalid Activities snapshot.");
  const verified=rows.map(normalizeActivity),ids=new Set(),users=new Set();
  for(const row of verified){
    if(ids.has(row.id))throw Error("Duplicate Activity ID in verified snapshot.");
    ids.add(row.id);
    if(row.status==="active"){if(users.has(row.userId))throw Error("Multiple active Activities.");users.add(row.userId);}
  }
  return verified;
}
export function normalizeActivityLink(row){
  if(!row||!uuid.test(idOf(row.id))||!uuid.test(idOf(row.user_id))||!uuid.test(idOf(row.activity_id))||
    !/^\d+$/.test(idOf(row.record_id)))throw Error("Invalid Activity link.");
  const version=Number(row.version);
  if(!Number.isSafeInteger(version)||version<1)throw Error("Invalid Activity link version.");
  return {id:idOf(row.id),userId:idOf(row.user_id),activityId:idOf(row.activity_id),
    recordId:idOf(row.record_id),removedAt:row.removed_at||null,version};
}
export function validateActivityLinks(rows,activities=[],records=[]){
  if(!Array.isArray(rows)||rows.length>250000)throw Error("Incomplete Activity links snapshot.");
  const ids=new Set(),byRecord=new Set();
  const aById=new Map(activities.map(a=>[a.id,a]));
  const rById=new Map(records.map(r=>[String(r.id),r]));
  return rows.map(normalizeActivityLink).map(link=>{
    if(ids.has(link.id)||byRecord.has(link.recordId))throw Error("Duplicate Activity link ID/record.");
    ids.add(link.id);byRecord.add(link.recordId);
    const activity=aById.get(link.activityId);
    if(!activity||activity.userId!==link.userId)throw Error("Activity link crosses account ownership.");
    // A saved Expense may later be edited into Income. Keep the old link
    // metadata recoverable, but exclude that row from Activity spending.
    const record=rById.get(link.recordId);
    if(!record)throw Error("Activity link targets a missing record.");
    return link;
  });
}
export const activeActivity=activities=>activities.find(a=>a.status==="active")||null;
export const activityOfRecord=(recordId,links,activities)=>{
  const link=links.find(l=>l.recordId===String(recordId)&&!l.removedAt);
  return link?activities.find(a=>a.id===link.activityId)||null:null;
};
export function activityRecords(records,links,activityId){
  if(!Array.isArray(records)||!Array.isArray(links))throw Error("Activity records are not ready.");
  const ids=new Set(links.filter(l=>l.activityId===activityId&&!l.removedAt).map(l=>l.recordId));
  return records.filter(r=>ids.has(String(r.id))&&r.type==="expense"&&!r.deleted_at);
}
export function activitySummary(activity,records,links,asOfDate=localDateMY()){
  if(!activity)throw Error("Choose an Activity first.");
  requireCalendarDate(asOfDate);
  const entries=activityRecords(records,links,activity.id);
  const cat=new Map(),methods=new Map(),days=new Map(),notes=new Map();
  let totalSen=0;
  for(const row of entries){
    const sen=cents(row.amount);
    if(sen<=0)throw Error("Invalid Activity expense amount.");
    totalSen+=sen;
    if(!Number.isSafeInteger(totalSen))throw Error("Activity total exceeds safe MYR precision.");
    cat.set(row.category,(cat.get(row.category)||0)+sen);
    methods.set(row.method,(methods.get(row.method)||0)+sen);
    days.set(row.date,(days.get(row.date)||0)+sen);
    const note=String(row.note||"").trim();
    if(note)notes.set(note,(notes.get(note)||0)+1);
  }
  const end=activity.endedOn||asOfDate;
  const duration=Math.max(1,inclusiveCalendarDays(activity.startedOn,end));
  const ranked=map=>[...map].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))
    .map(([name,sen])=>({name,value:rm(sen)}));
  const expenses=entries.slice().sort((a,b)=>cents(b.amount)-cents(a.amount)||
    b.date.localeCompare(a.date));
  const budgetSen=activity.budget===null?null:cents(activity.budget);
  return {activity,records:entries,total:rm(totalSen),count:entries.length,
    categories:ranked(cat),methods:ranked(methods),
    daily:[...days].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
      .map(([date,sen])=>({date,expense:rm(sen)})),
    notes:[...notes].sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,count])=>({name,count})),
    largest:expenses.slice(0,5),duration,average:rm(Math.round(totalSen/duration)),
    budget:budgetSen===null?null:{limit:activity.budget,spent:rm(totalSen),
      remaining:rm(budgetSen-totalSen),percent:budgetSen?Math.round(totalSen/budgetSen*1000)/10:0}};
}
