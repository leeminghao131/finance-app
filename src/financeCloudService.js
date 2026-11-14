import { loadEveryOwnedRow,splitRecordStatus } from "./financeData.js";
import { normalizeRecord,normalizeTransfer } from "./financeRecords.js";
import { validateFinanceSnapshotRows } from "./financeIntegrity.js";

// Fetch one coherent, count-checked cloud snapshot without mutating the source DB.
// All visible totals are replaced only after the caller receives this full result.
export async function fetchFinanceSnapshot(client,userId,onProgress) {
  if(!userId)throw new Error("Authentication is required to fetch finance data.");
  const recordRows=await loadEveryOwnedRow(
    client,"records",
    "id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at",
    userId,onProgress,
  );
  const transferRows=await loadEveryOwnedRow(
    client,"transfers",
    "id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at",
    userId,onProgress,
  );
  const {data:settingsRow,error:settingsError}=await client.from("user_settings")
    .select("category_budgets,custom_options,version,forecast_plans,opening_balances,savings_goals,saved_filters")
    .eq("user_id",userId).maybeSingle();
  if(settingsError)throw settingsError;
  const {data:savedMonths,error:monthError}=await client.from("monthly_budgets")
    .select("user_id,month,category_budgets,version,updated_at")
    .eq("user_id",userId).order("month",{ascending:false}).limit(1000);
  if(monthError)throw monthError;
  if((savedMonths||[]).length===1000)
    throw new Error("Monthly budget history reached the read cap; refusing incomplete data.");
  validateFinanceSnapshotRows(recordRows,transferRows,settingsRow);
  const byNewest=(a,b)=>String(b.date||"").localeCompare(String(a.date||""))
    || new Date(b.created_at||0)-new Date(a.created_at||0);
  const {active:records,deleted:deletedRecords}=splitRecordStatus(
    recordRows.slice().sort(byNewest).map(normalizeRecord));
  const {active:transfers,deleted:deletedTransfers}=splitRecordStatus(
    transferRows.slice().sort(byNewest).map(normalizeTransfer));
  return {records,deletedRecords,transfers,deletedTransfers,
    settingsRow:settingsRow||null,monthRows:savedMonths||[]};
}
