import test from "node:test";
import assert from "node:assert/strict";
import {createFinanceActivity,updateFinanceActivity,linkFinanceExpense,unlinkFinanceExpense,currentActiveActivity} from "../src/financeActivityService.js";

const owner="11111111-1111-4111-8111-111111111111";
const actId="33333333-3333-4333-8333-333333333333";
const linkId="44444444-4444-4444-8444-444444444444";
const recordId="102";
const activityRow={
 id:actId,user_id:owner,title:"Test Trip",budget:500,status:"active",
 started_on:"2026-11-16",ended_on:null,version:1,
 created_at:"2026-11-16T00:00:00Z",updated_at:"2026-11-16T00:00:00Z"
};
function activityDB(){
 let activity=null,changes=0,creates=0;
 return{
  get activity(){return activity},get changes(){return changes},get creates(){return creates},
  from(table){
   assert.equal(table,"finance_activities");
   return{
    insert(payload){
     return {select(){return{async single(){
      creates++;activity={...activityRow,...payload};return{data:{...activity},error:null};
     }}}};
    },
    select(){
     const filter={};
     const chain={
      eq(k,v){filter[k]=v;return chain},
      async maybeSingle(){return{data:activity&&filter.id===activity.id&&filter.user_id===owner?{...activity}:null,error:null}}
     };
     return chain;
    },
    update(payload){
     const filter={};
     const chain={
      eq(k,v){filter[k]=v;return chain},
      select(){return{async maybeSingle(){
       if(!activity||filter.id!==activity.id||filter.user_id!==owner||filter.version!==activity.version)
        return{data:null,error:null};
       activity={...activity,...payload};changes++;return{data:{...activity},error:null};
      }}}
     };
     return chain;
    }
   };
  }
 };
}
function linkDB(){
 let existing=null,inserts=0,updates=0,ackLoss=false;
 return{
  get existing(){return existing},get inserts(){return inserts},get updates(){return updates},
  loseAckOnce(){ackLoss=true},
  from(table){
   assert.equal(table,"finance_activity_links");
   return{
    select(){
     const filters={};
     const chain={eq(k,v){filters[k]=v;return chain},async maybeSingle(){
      return{data:existing&&existing.user_id===filters.user_id&&String(existing.record_id)===String(filters.record_id)
       ?{...existing}:null,error:null};
     }};
     return chain;
    },
    insert(payload){
     return{select(){return{async single(){
      inserts++;
      if(existing)return{data:null,error:{code:"23505",message:"duplicate link"}};
      existing={...payload,id:linkId,version:1,removed_at:null,
        created_at:"2026-11-16T00:00:00Z",updated_at:"2026-11-16T00:00:00Z"};
      if(ackLoss){ackLoss=false;throw Error("lost HTTPS response")}
      return{data:{...existing},error:null};
     }}}};
    },
    update(payload){
     const filters={};
     const chain={
      eq(k,v){filters[k]=v;return chain},
      select(){return{async maybeSingle(){
       if(!existing||filters.user_id!==existing.user_id||filters.id!==existing.id||
          filters.version!==existing.version)return{data:null,error:null};
       existing={...existing,...payload};updates++;return{data:{...existing},error:null};
      }}}
     };
     return chain;
    }
   };
  }
 };
}
test("Stage3 service starts real owner-scoped Activity, checks latest status, then pauses/resumes/finishes with CAS",async()=>{
 const db=activityDB();
 const created=await createFinanceActivity(db,owner,{title:" Test Trip ",budget:"500.00"},"2026-11-16");
 assert.equal(db.creates,1);
 assert.equal(created.userId,owner);
 assert.equal(created.title,"Test Trip");
 assert.equal(created.status,"active");
 assert.equal((await currentActiveActivity(db,owner,actId)).id,actId);
 const paused=await updateFinanceActivity(db,owner,created,{status:"paused"});
 assert.equal(paused.status,"paused");assert.equal(paused.version,2);
 assert.equal(await currentActiveActivity(db,owner,actId),null);
 await assert.rejects(updateFinanceActivity(db,owner,created,{status:"finished",date:"2026-11-16"}),/changed on another device/);
 const resumed=await updateFinanceActivity(db,owner,paused,{status:"active"});
 assert.equal(resumed.status,"active");assert.equal(resumed.version,3);
 const finished=await updateFinanceActivity(db,owner,resumed,{status:"finished",date:"2026-11-16"});
 assert.equal(finished.endedOn,"2026-11-16");assert.equal(finished.version,4);
 assert.equal(db.changes,3);
 await assert.rejects(updateFinanceActivity(db,owner,finished,{status:"active"}),/Invalid Activity state transition/);
});
test("Stage3 service expense association remains unique across repeated confirmations",async()=>{
 const db=linkDB();
 const first=await linkFinanceExpense(db,owner,recordId,actId);
 const second=await linkFinanceExpense(db,owner,recordId,actId);
 assert.equal(first.id,second.id);
 assert.equal(first.recordId,recordId);
 assert.equal(db.inserts,1);
 const removed=await unlinkFinanceExpense(db,owner,first);
 assert.ok(removed.removedAt);
 assert.equal(removed.version,2);
 const restored=await linkFinanceExpense(db,owner,recordId,actId);
 assert.equal(restored.version,3);
 assert.equal(restored.removedAt,null);
 assert.equal(db.updates,2);
 await assert.rejects(unlinkFinanceExpense(db,owner,first),/changed on another device/);
});
test("Stage3 service recovers ambiguous insert HTTP response without a duplicate link",async()=>{
 const db=linkDB();db.loseAckOnce();
 const confirmed=await linkFinanceExpense(db,owner,recordId,actId);
 assert.equal(confirmed.activityId,actId);
 assert.equal(db.inserts,1);
 const repeated=await linkFinanceExpense(db,owner,recordId,actId);
 assert.equal(repeated.id,confirmed.id);
 assert.equal(db.inserts,1);
});
test("Stage3 service prevents silent reassignment of an existing Expense to another trip",async()=>{
 const db=linkDB();await linkFinanceExpense(db,owner,recordId,actId);
 const different="55555555-5555-4555-8555-555555555555";
 await assert.rejects(linkFinanceExpense(db,owner,recordId,different),/already belongs/);
 assert.equal(db.existing.activity_id,actId);
});
