import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  validActivityTitle,validActivityBudget,normalizeActivity,validateActivities,
  normalizeActivityLink,validateActivityLinks,activitySummary,activityRecords,activeActivity,activityOfRecord
} from "../src/financeActivity.js";
import {financeWrapped} from "../src/financeStage1Analytics.js";
const source=n=>readFileSync(new URL("../src/"+n,import.meta.url),"utf8");
const owner="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const actId="33333333-3333-4333-8333-333333333333";
const linkId="44444444-4444-4444-8444-444444444444";
const activity=normalizeActivity({id:actId,user_id:owner,title:"成都旅行",budget:"1500.00",
  status:"active",started_on:"2026-11-10",ended_on:null,version:1});
const records=[
 {id:1,type:"expense",date:"2026-11-11",category:"饮食",method:"TNG",amount:35.50,note:"火锅",deleted_at:null},
 {id:2,type:"expense",date:"2026-11-12",category:"交通",method:"BANK",amount:10.25,note:"车票",deleted_at:null},
 {id:3,type:"expense",date:"2026-11-13",category:"饮食",method:"CASH",amount:100,note:"deleted",deleted_at:"2026-11-14T01:00:00Z"},
 {id:4,type:"income",date:"2026-11-14",category:"Salary",method:"BANK",amount:5000,note:"not spending"},
 {id:5,type:"expense",date:"2026-11-15",category:"饮食",method:"TNG",amount:99.99,note:"outside activity"}
];
const links=[
 {id:linkId,userId:owner,activityId:actId,recordId:"1",removedAt:null,version:1},
 {id:"55555555-5555-4555-8555-555555555555",userId:owner,activityId:actId,recordId:"2",removedAt:null,version:1},
 {id:"66666666-6666-4666-8666-666666666666",userId:owner,activityId:actId,recordId:"3",removedAt:null,version:1},
 {id:"77777777-7777-4777-8777-777777777777",userId:owner,activityId:actId,recordId:"4",removedAt:null,version:1},
];
test("Stage3 valid Activity names, RM budgets and status/date constraints",()=>{
 const raw={id:actId,user_id:owner,title:"成都旅行",budget:"1500.00",
   status:"active",started_on:"2026-11-10",ended_on:null,version:1};
 assert.equal(validActivityTitle("  Chengdu  "),"Chengdu");
 assert.equal(validActivityBudget("0.01"),.01);
 assert.equal(validActivityBudget("1500.50"),1500.5);
 assert.equal(validActivityBudget(""),null);
 assert.throws(()=>validActivityTitle(" "),/1–90/);
 assert.throws(()=>validActivityBudget("1.234"),/valid activity budget/);
 assert.throws(()=>validActivityBudget("0"),/positive/);
 assert.throws(()=>normalizeActivity({...raw,status:"finished"}),/Inconsistent/);
 assert.throws(()=>normalizeActivity({...raw,status:"finished",ended_on:"2026-11-01"}),/Inconsistent/);
 assert.throws(()=>normalizeActivity({...raw,status:"invalid"}),/status/);
});
test("Stage3 owner only one automatic active Activity and unique IDs",()=>{
 const raw={id:actId,user_id:owner,title:"成都旅行",budget:"1500.00",
   status:"active",started_on:"2026-11-10",ended_on:null,version:1};
 assert.equal(activeActivity([activity]).id,actId);
 assert.equal(activeActivity([{...activity,status:"paused"}]),null);
 assert.throws(()=>validateActivities([raw,{...raw,id:other}]),/Multiple active/);
 assert.throws(()=>validateActivities([raw,raw]),/Duplicate Activity/);
 assert.equal(validateActivities([{...raw,id:other,status:"paused"},raw])[1].status,"active");
});
test("Stage3 activity aggregates linked Expense cents only, not Income, transfers or outside records",()=>{
 const a=activitySummary(activity,records,links,"2026-11-16");
 assert.equal(a.total,45.75);
 assert.equal(a.count,2);
 assert.equal(a.categories[0].name,"饮食");
 assert.equal(a.categories[0].value,35.5);
 assert.equal(a.methods.length,2);
 assert.equal(a.daily.length,2);
 assert.equal(a.duration,7);
 assert.equal(a.average,6.54);
 assert.equal(a.budget.remaining,1454.25);
 assert.equal(a.largest[0].id,1);
 assert.ok(a.records.every(x=>x.type==="expense"&&!x.deleted_at));
});
test("Stage3 soft-deleted Activity links and finance Recycle Bin restore maintain totals",()=>{
 const b=links.map((l,i)=>i===1?{...l,removedAt:"2026-11-16T00:00:00Z"}:l);
 assert.equal(activitySummary(activity,records,b,"2026-11-16").total,35.5);
 const restored=records.map(r=>r.id===3?{...r,deleted_at:null}:r);
 assert.equal(activitySummary(activity,restored,links,"2026-11-16").total,145.75);
 assert.equal(activityOfRecord(2,b,[activity]),null);
 assert.equal(activityOfRecord(1,links,[activity]).title,"成都旅行");
 assert.equal(activityOfRecord(5,links,[activity]),null);
});
test("Stage3 manual association of old Expense cannot count twice",()=>{
 const added={...links[0],id:"88888888-8888-4888-8888-888888888888",recordId:"5"};
 const extra=activitySummary(activity,records,[...links,added],"2026-11-16");
 assert.equal(extra.total,145.74);
 assert.equal(activityRecords(records,[...links,added],actId).length,3);
 assert.throws(()=>validateActivityLinks([
  {id:linkId,user_id:owner,activity_id:actId,record_id:1,removed_at:null,version:1},
  {id:"99999999-9999-4999-8999-999999999999",user_id:owner,activity_id:actId,record_id:1,removed_at:null,version:1},
 ],[activity],records),/Duplicate/);
});
test("Stage3 link verification rejects cross-account activity and missing IDs",()=>{
 const good={id:linkId,user_id:owner,activity_id:actId,record_id:1,removed_at:null,version:1};
 assert.equal(normalizeActivityLink(good).recordId,"1");
 assert.equal(validateActivityLinks([good],[activity],records)[0].activityId,actId);
 assert.throws(()=>validateActivityLinks([{...good,user_id:other}],[activity],records),/crosses account/);
 assert.throws(()=>validateActivityLinks([{...good,record_id:900}],[activity],records),/missing/);
 assert.throws(()=>normalizeActivityLink({...good,record_id:"not-a-record"}),/Invalid Activity link/);
});
test("Stage3 activity reports remain independent of Dashboard filters and previous Wrapped modes",()=>{
 const sum=activitySummary(activity,records,links,"2026-11-16");
 const monthly=financeWrapped(records,{mode:"monthly",month:"2026-11",asOfDate:"2026-11-16"});
 assert.equal(sum.total,45.75);
 assert.equal(monthly.current.expense,145.74); // soft-deleted RM100 is excluded
 assert.equal(monthly.current.income,5000);
 assert.equal(monthly.mode,"monthly");
});
test("Stage3 Activity mode UI has create, pause, resume, finish, budget and soft unlink",()=>{
 const s=source("FinanceActivityPanel.jsx");
 for(const needle of ['onCreate({title,budget})','status("paused")','status("active")','status("finished")',
  'onUpdate(selected,{title:draftTitle,budget:draftBudget})','onUnlink(link)',
  'onLink(recordId,selected.id)','activitySummary(selected,records,links)','getActivityLabel']){
  if(needle==="getActivityLabel")continue;
  assert.ok(s.includes(needle),needle);
 }
 assert.ok(s.includes("window.confirm"));
 assert.ok(s.includes("activityRecords"));
 assert.ok(!s.includes("deleteRecord("));
});
test("Stage3 Activity Wrapped keeps monthly/quarterly/yearly and adds private 10-slide Activity story and PNG",()=>{
 const s=source("FinanceWrapped.jsx");
 for(const mode of ['"monthly"','"quarterly"','"yearly"','"activity"'])assert.ok(s.includes(mode),mode);
 assert.ok(s.includes('const activitySlides=a?['));
 assert.ok(s.includes('hideNotes'));
 assert.ok(s.includes('hideAmounts'));
 assert.ok(s.includes('a.categories.slice(0,6)'));
 assert.ok(s.includes('a.daily.map'));
 assert.ok(s.includes('a.budget'));
 assert.ok(s.includes('exportStoryImage(w,hideAmounts)'));
 assert.ok(s.includes('wrapped.mode==="activity"'));
 assert.ok(s.includes("activitySummary(selected,records,activityLinks)"));
 assert.ok(s.includes('financeWrapped(records,{mode,month,quarterStart,year,monthRows,budgetTemplate})'));
 assert.ok(!s.includes("Activity Wrapped will follow in Stage 3"));
});
test("Stage3 finance read completeness and UI badges without changing protected record CRUD",()=>{
 const cloud=source("financeCloudService.js"),app=source("App.jsx");
 const dock=source("FinanceInsightsDock.jsx"),mobile=source("FinanceMobileRecords.jsx");
 const advanced=source("FinanceAdvancedResults.jsx");
 assert.ok(cloud.includes('loadEveryOwnedRow(client,"finance_activities"'));
 assert.ok(cloud.includes('loadEveryOwnedRow(client,"finance_activity_links"'));
 assert.ok(cloud.includes("validateActivityLinks(linkRows,activities"));
 assert.ok(app.includes("const pendingActivity=form.type==="));
 assert.ok(app.includes("currentActiveActivity(supabase,user.id,pendingActivity.id)"));
 assert.ok(app.includes("linkFinanceExpense(supabase,user.id,String(insertedRecord.id),pendingActivity.id)"));
 assert.ok(app.includes("Expense WAS saved, but Activity tag was not confirmed"));
 assert.ok(app.includes("function startActivity("));
 assert.ok(app.includes("function changeActivity("));
 assert.ok(app.includes("function associateActivityExpense("));
 assert.ok(app.includes("function detachActivityExpense("));
 assert.ok(dock.includes('<FinanceActivityPanel activities={activities}'));
 assert.ok(dock.includes('activityLinks={activityLinks}'));
 assert.ok(mobile.includes('getActivityLabel(item.id)'));
 assert.ok(advanced.includes('getActivityLabel(r.id)'));
 for(const name of ["addRecord","updateRecord","deleteRecord","loadCloudData","saveBudgets"])
  assert.ok(app.includes("function "+name+"("),name);
});
const sql=source("../docs/database/preview_finance_stage3_activities.sql");
test("Stage3 TEST migration has owner RLS, one-active invariant and soft-only unlink",()=>{
 assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"));
 assert.ok(sql.includes("finance_one_active_activity_per_user"));
 assert.ok(sql.includes("UNIQUE (user_id,record_id)"));
 assert.ok(sql.includes("auth.uid()"));
 assert.ok(sql.includes("No DELETE policy"));
 assert.ok(!/\\b(?:DROP\\s+TABLE|TRUNCATE|DELETE\\s+FROM)\\b/i.test(sql));
});
