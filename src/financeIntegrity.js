import { parseEditedAmount } from "./financeData.js";
import { requireCalendarDate } from "./financeCalendar.js";
import { openingTotal } from "./financeOpeningBalance.js";

// Read-only validation at the trust boundary: never silently coerce invalid
// PostgreSQL values into RM0 or a misleading Income/Expense balance.
export function validateFinanceSnapshotRows(recordRows, transferRows, settingsRow = null) {
  if (!Array.isArray(recordRows) || !Array.isArray(transferRows)) {
    throw new Error("Finance snapshot contains a malformed transaction list.");
  }
  let incomeSen = 0;
  let expenseSen = 0;
  for (const row of recordRows) {
    if (row.id == null || !["income", "expense"].includes(row.type)) {
      throw new Error("Finance record has an invalid ID or transaction type; totals withheld.");
    }
    requireCalendarDate(row.date);
    if (typeof row.category !== "string" || !row.category.trim() ||
        typeof row.method !== "string" || !row.method.trim()) {
      throw new Error("Finance record is missing a category or payment method; totals withheld.");
    }
    const value = Math.round(parseEditedAmount(row.amount) * 100);
    if (row.deleted_at) continue;
    if (row.type === "income") incomeSen += value;
    else expenseSen += value;
    if (!Number.isSafeInteger(incomeSen) || !Number.isSafeInteger(expenseSen)) {
      throw new Error("Finance ledger amounts exceed safe cent precision; totals withheld.");
    }
  }
  for (const row of transferRows) {
    if (row.id == null || typeof row.from_method !== "string" ||
        typeof row.to_method !== "string" || !row.from_method.trim() ||
        !row.to_method.trim() || row.from_method === row.to_method) {
      throw new Error("Finance transfer has invalid account details; totals withheld.");
    }
    requireCalendarDate(row.date);
    parseEditedAmount(row.amount);
  }
  if (settingsRow?.opening_balances != null) {
    if (typeof settingsRow.opening_balances !== "object" ||
        Array.isArray(settingsRow.opening_balances)) {
      throw new Error("Opening balances are malformed; totals withheld.");
    }
    openingTotal(settingsRow.opening_balances);
  }
  return true;
}
