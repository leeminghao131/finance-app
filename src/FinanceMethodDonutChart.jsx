
import React, { useId, useMemo, useState } from "react";
import FinanceNativeDonut from "./FinanceNativeDonut.jsx";

const METHOD_COLOR = { "TNG": "#239D90", "BANK": "#61718B", "CASH": "#C96975", "GRAB PAY": "#C09C52" };
const OTHER_COLORS = ["#5C9BB3", "#9784BC", "#638D7D", "#AF8B84", "#8F9E59"];
const money = n => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function colorFor(name) {
  if (METHOD_COLOR[name]) return METHOD_COLOR[name];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return OTHER_COLORS[hash % OTHER_COLORS.length];
}

export default function FinanceMethodDonutChart({ data, emptyText = "No method data." }) {
  const id = useId().replace(/:/g, "");
  const [highlighted, setHighlighted] = useState("");
  const entries = useMemo(() => (Array.isArray(data) ? data : [])
    .filter(entry => Number.isFinite(Number(entry.value)) && Number(entry.value) > 0)
    .map(entry => ({ name: String(entry.name), value: Number(entry.value) }))
    .sort((a, b) => b.value - a.value), [data]);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (!entries.length || total <= 0) {
    return <div className="flex min-h-52 items-center justify-center rounded-2xl bg-white text-sm text-slate-500">{emptyText}</div>;
  }
  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <div className="relative h-[212px] w-[212px] shrink-0" aria-label="Payment method donut chart">
        <FinanceNativeDonut entries={entries} highlighted={highlighted} setHighlighted={setHighlighted} colorFor={colorFor} money={money} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
          <span className="text-xs font-semibold tracking-wide text-slate-500">Total Expense</span>
          <strong className="mt-1 break-words text-lg font-extrabold leading-tight tabular-nums text-slate-900">{money(total)}</strong>
        </div>
      </div>
      <div className="grid min-w-0 w-full flex-1 grid-cols-2 gap-2 sm:max-h-[226px] sm:grid-cols-1 sm:overflow-y-auto"
        aria-label="Payment method percentage and amount legend">
        {entries.map(entry => (
          <button key={entry.name} type="button"
            onMouseEnter={() => setHighlighted(entry.name)}
            onMouseLeave={() => setHighlighted("")}
            onFocus={() => setHighlighted(entry.name)}
            onBlur={() => setHighlighted("")}
            onClick={() => setHighlighted(entry.name)}
            aria-label={entry.name + " " + (100 * entry.value / total).toFixed(1) + "% " + money(entry.value)}
            className={"min-h-11 min-w-0 rounded-xl border px-3 py-2 text-left transition-colors " +
              (highlighted === entry.name ? "border-slate-400 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:bg-white")}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor(entry.name) }}/>
              <span className="min-w-0 flex-1 break-words text-xs font-bold text-slate-800" data-i18n-ignore>{entry.name}</span>
              <strong className="shrink-0 text-xs tabular-nums text-slate-800">
                {(100 * entry.value / total).toFixed(1)}%
              </strong>
            </div>
            <p className="mt-1 break-words pl-[18px] text-xs font-semibold tabular-nums text-slate-600">{money(entry.value)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
