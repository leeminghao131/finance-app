import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import FinanceOverlay from "./FinanceOverlay.jsx";
import { useFinanceLanguage } from "./FinanceLanguageLayer.jsx";
import { builtInFinanceCategory } from "./financeLanguage.js";

const numeric = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rm = value => {
  const amount = Number(value || 0);
  return (amount < 0 ? "-" : "") + "RM " + numeric.format(Math.abs(amount));
};

// This is a read-only view. The parent owns all financial calculations and filters.
export default function FinanceExpandedTrendOverlay({
  open, kind, onKindChange, onClose, data, dailyData,
  records, category, alertLimit, filterLabel, triggerRef,
}) {
  const { language } = useFinanceLanguage();
  const [selectedDate, setSelectedDate] = useState("");
  const rows = Array.isArray(data) ? data : [];
  const dailyRows = Array.isArray(dailyData) ? dailyData : [];
  const sourceRecords = Array.isArray(records) ? records : [];

  useEffect(() => {
    if (open) setSelectedDate(rows[rows.length - 1]?.dateKey || "");
  }, [open, kind, data]);

  const selected = rows.find(row => row.dateKey === selectedDate) || rows[rows.length - 1] || null;
  const day = dailyRows.find(row => row.dateKey === selected?.dateKey);
  const expenseRows = useMemo(() => {
    if (!selected || kind !== "expense") return [];
    return sourceRecords.filter(row => row.type === "expense"
      && row.date === selected.dateKey
      && (category === "all" || row.category === category));
  }, [sourceRecords, selected?.dateKey, category, kind]);

  // Keep exactly the same threshold semantics as the existing small graph.
  const limit = Number(alertLimit || 1500);
  const limitLabel = "RM" + limit.toLocaleString("en-MY", { maximumFractionDigits: 2 });
  const balance = selected?.balanceGreen ?? selected?.balanceRed;
  const categoryLabel = category === "all" ? "All categories" : builtInFinanceCategory(category, language);

  function selectFromChart(state) {
    const payloadDate = state?.activePayload?.[0]?.payload?.dateKey;
    const index = state?.activeTooltipIndex;
    const selectedRow = rows.find(row => row.dateKey === payloadDate)
      || (typeof index === "number" ? rows[index] : null)
      || rows.find(row => row.day === state?.activeLabel);
    if (selectedRow) setSelectedDate(previous =>
      previous === selectedRow.dateKey ? previous : selectedRow.dateKey);
  }

  return (
    <FinanceOverlay open={open}
      title={kind === "expense" ? "Spending Trend / 消费趋势" : "Filtered Balance Trend / 筛选余额趋势"}
      onClose={onClose} widthClass="max-w-7xl" triggerRef={triggerRef}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Current range: {filterLabel}</p>
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Expanded chart">
            <button type="button" aria-pressed={kind === "expense"}
              onClick={() => onKindChange("expense")}
              className={kind === "expense"
                ? "min-h-11 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                : "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"}>
              Spending Trend
            </button>
            <button type="button" aria-pressed={kind === "balance"}
              onClick={() => onKindChange("balance")}
              className={kind === "balance"
                ? "min-h-11 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                : "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"}>
              Balance Trend
            </button>
          </div>
        </div>

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(260px,1fr)]">
          <div className="min-w-0 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">
                {kind === "expense" ? "Daily expense" : "Filtered balance"} · RM
              </p>
              <p className="text-xs text-slate-500">
                {kind === "expense" ? categoryLabel : "Balance Alert Limit: " + limitLabel}
              </p>
            </div>
            {rows.length ? (
              <>
                <div className="h-64 min-w-0 sm:h-80 lg:h-[420px]"
                  aria-label="Expanded daily financial trend chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows}
                      margin={{ top: 12, right: 14, bottom: 8, left: 2 }}
                      onMouseMove={selectFromChart}
                      onClick={selectFromChart}
                      onTouchStart={selectFromChart}
                      onTouchMove={selectFromChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" minTickGap={24} interval="preserveStartEnd" fontSize={11} />
                      <YAxis width={56} fontSize={11} />
                      <Tooltip content={() => null}
                        cursor={{ stroke: "#64748b", strokeDasharray: "4 4" }} />
                      <Legend verticalAlign="bottom" />
                      {kind === "expense" ? (
                        <Line type="monotone" isAnimationActive={false}
                          name="Expense" dataKey="expense" stroke="#2563eb"
                          strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                      ) : (
                        <>
                          <Line type="monotone" isAnimationActive={false} connectNulls
                            name={"Balance > " + limitLabel} dataKey="balanceGreen"
                            stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" isAnimationActive={false} connectNulls
                            name={"Balance ≤ " + limitLabel} dataKey="balanceRed"
                            stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Hover or tap a point to inspect its date. You can also select a date below.
                </p>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Selected date
                  <select value={selected?.dateKey || ""}
                    onChange={event => setSelectedDate(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base">
                    {rows.map(row => (
                      <option key={row.dateKey} value={row.dateKey}>{row.dateKey}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">No data for the current filter.</p>
            )}
          </div>

          <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Selected daily details">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected date</p>
            {selected ? (
              <div className="mt-2 space-y-3">
                <h3 className="font-mono text-lg font-bold text-slate-900">{selected.dateKey}</h3>
                {kind === "expense" ? (
                  <>
                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-xs font-semibold text-blue-700">Daily total expense</p>
                      <p className="mt-1 break-words text-xl font-bold tabular-nums text-blue-800">
                        {rm(selected.expense)}
                      </p>
                      <p className="mt-1 text-xs text-blue-700">
                        {expenseRows.length} expense record(s)
                      </p>
                    </div>
                    <div className="max-h-[min(40vh,350px)] space-y-2 overflow-y-auto">
                      {expenseRows.length ? expenseRows.map(record => (
                        <div key={record.id} className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 break-words font-bold text-slate-800">
                              {builtInFinanceCategory(record.category, language)}
                            </p>
                            <p className="max-w-[55%] break-words text-right font-bold tabular-nums text-blue-700">{rm(record.amount)}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            <span data-i18n-ignore>{record.method || "TNG"}</span>
                            {" · "}
                            {record.note ? <span data-i18n-ignore>{record.note}</span> : "No note"}
                          </p>
                        </div>
                      )) : <p className="text-sm text-slate-500">No expense records on this date.</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={balance <= limit ? "rounded-xl bg-red-50 p-3" : "rounded-xl bg-green-50 p-3"}>
                      <p className="text-xs font-semibold text-slate-700">Cumulative filtered balance</p>
                      <p className={balance <= limit
                        ? "mt-1 break-words text-xl font-bold tabular-nums text-red-700"
                        : "mt-1 break-words text-xl font-bold tabular-nums text-green-700"}>
                        {rm(balance)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {balance <= limit ? "At or below alert limit" : "Above alert limit"}
                        {" · "}{limitLabel}
                      </p>
                    </div>
                    <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Daily income</span>
                        <strong className="tabular-nums text-green-700">{rm(day?.income)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Daily expense</span>
                        <strong className="tabular-nums text-red-700">{rm(day?.expense)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                        <span className="text-slate-600">Daily net change</span>
                        <strong className="tabular-nums text-slate-800">{rm(selected.dailyBalance)}</strong>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      This is the cumulative balance within the current record filter,
                      not a verified bank balance. Planned income and transfers are not counted as transactions.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No date selected.</p>
            )}
          </aside>
        </div>
      </div>
    </FinanceOverlay>
  );
}
