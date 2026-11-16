import {normalizeActivity,normalizeActivityLink,validActivityTitle,validActivityBudget} from "./financeActivity.js";
import {requireCalendarDate,localDateMY} from "./financeCalendar.js";

const activityColumns="id,user_id,title,budget,status,started_on,ended_on,version,created_at,updated_at";
const linkColumns="id,user_id,activity_id,record_id,removed_at,version,created_at,updated_at";
const validId=v=>/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(String(v||""));
export async function createFinanceActivity(client,userId,{title,budget},date=localDateMY()){
  if(!client||!validId(userId))throw Error("Sign in to start an Activity.");
  const payload={user_id:userId,title:validActivityTitle(title),
    budget:validActivityBudget(budget),status:"active",started_on:requireCalendarDate(date)};
  const {data,error}=await client.from("finance_activities").insert(payload).select(activityColumns).single();
  if(error)throw error;
  return normalizeActivity(data);
}
export async function updateFinanceActivity(client,userId,activity,changes){
  if(!client||!validId(userId)||!activity||activity.userId!==userId)
    throw Error("Activity owner not verified.");
  const update={version:activity.version+1,updated_at:new Date().toISOString()};
  if(changes.status!==undefined){
    const next=String(changes.status);
    if(!["active","paused","finished"].includes(next)||activity.status==="finished"||
      next===activity.status||(activity.status==="active"&&next!=="paused"&&next!=="finished")||
      (activity.status==="paused"&&next!=="active"&&next!=="finished"))
      throw Error("Invalid Activity state transition.");
    update.status=next;
    update.ended_on=next==="finished"?requireCalendarDate(changes.date||localDateMY()):null;
  }
  if(changes.title!==undefined)update.title=validActivityTitle(changes.title);
  if(changes.budget!==undefined)update.budget=validActivityBudget(changes.budget);
  if(Object.keys(update).length===2)throw Error("Activity update is empty.");
  const {data,error}=await client.from("finance_activities").update(update)
    .eq("id",activity.id).eq("user_id",userId).eq("version",activity.version)
    .select(activityColumns).maybeSingle();
  if(error)throw error;
  if(!data)throw Error("Activity changed on another device; refresh before retrying.");
  return normalizeActivity(data);
}
async function readLink(client,userId,recordId){
  const {data,error}=await client.from("finance_activity_links").select(linkColumns)
    .eq("user_id",userId).eq("record_id",recordId).maybeSingle();
  if(error)throw error;
  return data?normalizeActivityLink(data):null;
}
/**
 * Never write finance 'records'; this owns ONLY association metadata.
 * Concurrent insert recovery always rereads the unique owner+record link.
 */
export async function linkFinanceExpense(client,userId,recordId,activityId,{replace=false}={}){
  if(!client||!validId(userId)||!validId(activityId)||!/^\d+$/.test(String(recordId)))
    throw Error("Invalid Activity association.");
  const id=String(recordId);
  const old=await readLink(client,userId,id);
  if(old){
    if(old.activityId===activityId&&!old.removedAt)return old;
    if(!old.removedAt&&!replace)throw Error("Expense already belongs to another Activity. Explicitly choose to move it.");
    const {data,error}=await client.from("finance_activity_links")
      .update({activity_id:activityId,removed_at:null,version:old.version+1,
        updated_at:new Date().toISOString()})
      .eq("id",old.id).eq("user_id",userId).eq("version",old.version)
      .select(linkColumns).maybeSingle();
    if(error)throw error;
    if(!data)throw Error("Activity association changed on another device. Reload first.");
    return normalizeActivityLink(data);
  }
  try{
    const {data,error}=await client.from("finance_activity_links")
      .insert({user_id:userId,record_id:id,activity_id:activityId})
      .select(linkColumns).single();
    if(error){
      if(error.code!=="23505")throw error;
    }else if(data)return normalizeActivityLink(data);
  }catch(error){
    const recovered=await readLink(client,userId,id);
    if(recovered&&recovered.activityId===activityId&&!recovered.removedAt)return recovered;
    throw error;
  }
  const recovered=await readLink(client,userId,id);
  if(recovered&&recovered.activityId===activityId&&!recovered.removedAt)return recovered;
  throw Error("Activity association conflict. Verify record ownership and refresh.");
}
export async function unlinkFinanceExpense(client,userId,link){
  if(!client||!validId(userId)||link?.userId!==userId)
    throw Error("Activity association owner not verified.");
  if(link.removedAt)return link;
  const {data,error}=await client.from("finance_activity_links")
    .update({removed_at:new Date().toISOString(),version:link.version+1,
      updated_at:new Date().toISOString()})
    .eq("user_id",userId).eq("id",link.id).eq("version",link.version)
    .select(linkColumns).maybeSingle();
  if(error)throw error;
  if(!data)throw Error("Activity link changed on another device; refresh before retrying.");
  return normalizeActivityLink(data);
}
export async function currentActiveActivity(client,userId,activityId){
  const {data,error}=await client.from("finance_activities").select(activityColumns)
    .eq("user_id",userId).eq("id",activityId).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  const found=normalizeActivity(data);
  return found.status==="active"?found:null;
}
