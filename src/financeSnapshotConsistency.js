import {loadEveryOwnedRow} from "./financeData.js";

// Read-only, cross-table revision verification.
// This does NOT claim a PostgreSQL transaction-level atomic snapshot. Creating
// such a snapshot would require a reviewed server-side RPC/migration, which is
// deliberately outside this TEST-only, no-database-change stage.
const TABLES=["records","transfers","finance_activities","finance_activity_links",
  "finance_claims","finance_claim_repayments"];

export function financeRevisionSignature(rows) {
  if(!Array.isArray(rows))throw Error("Missing finance revision rows.");
  const ids=new Set();
  const tokens=rows.map(row=>{
    const id=String(row?.id||""),version=Number(row?.version);
    if(!id||ids.has(id)||!Number.isSafeInteger(version)||version<1)
      throw Error("Invalid or duplicate versioned cloud revision.");
    ids.add(id);
    return [id,version];
  }).sort((a,b)=>a[0].localeCompare(b[0]));
  return JSON.stringify(tokens);
}

export async function verifyFinanceSnapshotRevisions(
  client,userId,original,settingsRow,monthRows) {
  if(!userId)throw Error("Account identity required for cross-table snapshot check.");
  const results=await Promise.all(TABLES.map(table=>
    loadEveryOwnedRow(client,table,"id,version",userId)));
  // Check every active/deleted ID and row version after ALL initial tables and
  // settings were read. A changed/deleted/inserted row invalidates the snapshot.
  for(let i=0;i<TABLES.length;i++){
    if(financeRevisionSignature(original[TABLES[i]])!==
       financeRevisionSignature(results[i]))return false;
  }
  const {data:latestSettings,error:settingsError}=await client.from("user_settings")
    .select("category_budgets,custom_options,version,forecast_plans,opening_balances,savings_goals,saved_filters,recurring_bills,review_state,account_checks")
    .eq("user_id",userId).maybeSingle();
  if(settingsError)throw settingsError;
  if(JSON.stringify(latestSettings||null)!==JSON.stringify(settingsRow||null))return false;
  const {data:latestMonths,error:monthError}=await client.from("monthly_budgets")
    .select("user_id,month,category_budgets,version,updated_at")
    .eq("user_id",userId).order("month",{ascending:false}).limit(1000);
  if(monthError)throw monthError;
  if((latestMonths||[]).length===1000)
    throw Error("Monthly budget history reached the read cap; totals cannot be verified.");
  return JSON.stringify(latestMonths||[])===JSON.stringify(monthRows||[]);
}
