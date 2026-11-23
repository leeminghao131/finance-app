import {canonicalFinanceMethod} from "./financeMethodKeys.js";
import {requireCalendarDate} from "./financeCalendar.js";

// Read-only reconciliation details. Claim advances and reimbursements affect
// method CASH, never personal Income or Expense; Transfers remain zero-sum.
export function reconciliationRecentActivity(
  records,transfers,claimMovements,method,asOfDate,limit=12
) {
  requireCalendarDate(asOfDate);
  if(!Array.isArray(records)||!Array.isArray(transfers)||!Array.isArray(claimMovements))
    throw Error("Complete reconciliation activity is not available.");
  const selected=canonicalFinanceMethod(method);
  if(!selected)return [];
  const norm=value=>canonicalFinanceMethod(value);
  const rows=[
    ...records.filter(r=>!r.deleted_at&&r.date<=asOfDate&&norm(r.method)===selected)
      .map(r=>({id:"record-"+r.id,date:r.date,kind:r.type,
        amount:r.type==="income"?Number(r.amount):-Number(r.amount),
        note:r.note||r.category})),
    ...transfers.filter(r=>!r.deleted_at&&r.date<=asOfDate&&
      (norm(r.fromMethod)===selected||norm(r.toMethod)===selected))
      .map(r=>({id:"transfer-"+r.id,date:r.date,kind:"transfer",
        amount:(norm(r.toMethod)===selected?1:-1)*Number(r.amount),
        note:r.note||"Transfer"})),
    ...claimMovements.filter(event=>event.date<=asOfDate&&norm(event.method)===selected)
      .map(event=>({id:event.id,date:event.date,
        kind:event.kind==="advance"?"claim-advance":"claim-reimbursement",
        amount:event.sen/100,note:event.kind==="advance"?
          "Claim advance (company expense, not personal Expense)":
          "Claim reimbursement (not personal Income)"})),
  ];
  return rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,limit);
}
