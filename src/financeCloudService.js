import { loadEveryOwnedRow,splitRecordStatus } from "./financeData.js";
import { normalizeRecord,normalizeTransfer } from "./financeRecords.js";
import { validateFinanceSnapshotRows } from "./financeIntegrity.js";
import {validateActivities,validateActivityLinks} from "./financeActivity.js";
import {validateClaimSnapshot} from "./financeClaims.js";
import {verifyFinanceSnapshotRevisions} from "./financeSnapshotConsistency.js";

// Fetch one coherent, count-checked cloud snapshot without mutating the source DB.
// All visible totals are replaced only after the caller receives this full result.
async function readFinanceSnapshotOnce(client,userId,onProgress) {
  if(!userId)throw new Error("Authentication is required to fetch finance data.");
  // Independent, read-only, owner-filtered table scans can overlap.
  // Each loader still paginates and count-verifies ALL rows; no cache, RLS or
  // partial result can ever be presented as a complete cloud snapshot.
  const [recordRows,transferRows,activityRows,linkRows,claimRows,repaymentRows] = await Promise.all([
    loadEveryOwnedRow(client,"records",
      "id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at,fx_currency,fx_amount,fx_rate,fx_rate_date,fx_provider",
      userId,onProgress),
    loadEveryOwnedRow(client,"transfers",
      "id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at",
      userId,onProgress),
    loadEveryOwnedRow(client,"finance_activities",
      "id,user_id,title,budget,status,started_on,ended_on,version,created_at,updated_at",
      userId,onProgress),
    loadEveryOwnedRow(client,"finance_activity_links",
      "id,user_id,activity_id,record_id,removed_at,version,created_at,updated_at",
      userId,onProgress),
    loadEveryOwnedRow(client,"finance_claims",
      "id,user_id,client_request_id,title,claimant,amount,method,paid_on,note,submitted_on,cancelled_at,version,created_at,updated_at",
      userId,onProgress),
    loadEveryOwnedRow(client,"finance_claim_repayments",
      "id,user_id,claim_id,client_request_id,amount,method,received_on,note,voided_at,version,created_at,updated_at",
      userId,onProgress),
  ]);
  const {data:settingsRow,error:settingsError}=await client.from("user_settings")
    .select("category_budgets,custom_options,version,forecast_plans,opening_balances,savings_goals,saved_filters,recurring_bills,review_state,account_checks")
    .eq("user_id",userId).maybeSingle();
  if(settingsError)throw settingsError;
  const {data:savedMonths,error:monthError}=await client.from("monthly_budgets")
    .select("user_id,month,category_budgets,version,updated_at")
    .eq("user_id",userId).order("month",{ascending:false}).limit(1000);
  if(monthError)throw monthError;
  if((savedMonths||[]).length===1000)
    throw new Error("Monthly budget history reached the read cap; refusing incomplete data.");
  validateFinanceSnapshotRows(recordRows,transferRows,settingsRow);
  const revisionsStable=await verifyFinanceSnapshotRevisions(client,userId,{
    records:recordRows,transfers:transferRows,
    finance_activities:activityRows,finance_activity_links:linkRows,
    finance_claims:claimRows,finance_claim_repayments:repaymentRows,
  },settingsRow,savedMonths);
  if(!revisionsStable){
    const error=new Error("Finance tables or settings changed during synchronization; retrying full read.");
    error.financeSnapshotDrift=true;
    throw error;
  }
  const byNewest=(a,b)=>String(b.date||"").localeCompare(String(a.date||""))
    || new Date(b.created_at||0)-new Date(a.created_at||0);
  const {active:records,deleted:deletedRecords}=splitRecordStatus(
    recordRows.slice().sort(byNewest).map(normalizeRecord));
  const {active:transfers,deleted:deletedTransfers}=splitRecordStatus(
    transferRows.slice().sort(byNewest).map(normalizeTransfer));
  const {claims,repayments}=validateClaimSnapshot(claimRows,repaymentRows,userId);
  const activities=validateActivities(activityRows);
  const activityLinks=validateActivityLinks(linkRows,activities,[...records,...deletedRecords]);
  return {records,deletedRecords,transfers,deletedTransfers,
    settingsRow:settingsRow||null,monthRows:savedMonths||[],activities,activityLinks,claims,repayments};
}


// Retry a cross-table drift only by re-reading the ENTIRE snapshot. Other
// database, permissions, or network errors fail closed immediately.
// The caller updates visible totals ONLY after a complete verified result.
export async function fetchFinanceSnapshot(client,userId,onProgress) {
  for(let attempt=0;attempt<2;attempt++){
    try{return await readFinanceSnapshotOnce(client,userId,onProgress);}
    catch(error){
      if(!error?.financeSnapshotDrift)throw error;
      if(attempt===1)throw new Error(
        "Finance data changed across tables while syncing. Totals are withheld; retry when devices stop editing.");
    }
  }
  throw Error("Unable to confirm complete finance cloud snapshot.");
}
