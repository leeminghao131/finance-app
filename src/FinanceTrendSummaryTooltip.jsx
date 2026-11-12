import React from "react";

// Compact, display-only tooltip for dashboard previews.
// Detailed per-record tooltips stay separate for a future expanded chart overlay.
const currency = amount => "RM " + new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(amount));

export default function FinanceTrendSummaryTooltip({ active, payload, kind }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row?.dateKey) return null;

  // All values come from the already-calculated chart data.
  // Neither filtering nor amount/threshold calculations occur here.
  const value = kind === "balance"
    ? (row.balanceGreen ?? row.balanceRed)
    : row.expense;
  if (value == null || !Number.isFinite(Number(value))) return null;

  return (
    <div className="max-w-[min(80vw,240px)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-bold text-slate-800">{row.dateKey}</p>
      <p className={`mt-1 font-semibold ${kind === "balance" ? "text-slate-800" : "text-blue-700"}`}>
        {kind === "balance" ? "Balance" : "Expense"}: {currency(value)}
      </p>
    </div>
  );
}
