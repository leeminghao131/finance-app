import React, { useEffect, useMemo, useRef, useState } from "react";
import { localMonthMY } from "./financeCalendar.js";
import { summarizeMonthlyBudget, normalizeBudgetsInput } from "./financeInsights.js";
const money = n => new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(Number(n||0));

export default function FinanceBudgetPanel({
  records, budgetMonth, setBudgetMonth, monthRows, budgetTemplate, categories,
  onSaveMonthly, onSaveTemplate, onDirtyChange, embedded = false,
}) {
  const savedRow = monthRows.find(row=>row.month===budgetMonth);
  const savedVersion = savedRow?.version ?? null;
  const [draft,setDraft] = useState({});
  const [editingVersion,setEditingVersion] = useState(null);
  const [dirty,setDirty] = useState(false);
  const [busy,setBusy] = useState(false);
  const displayedMonthRef = useRef(null);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(()=>{
    // Always reset when changing month. For a remote change in the same month,
    // refresh only a clean editor; never erase unsaved drafts or its old version.
    const changedMonth = displayedMonthRef.current !== budgetMonth;
    if (changedMonth || !dirty) {
      const original = savedRow?.category_budgets
        || (budgetMonth >= localMonthMY() ? budgetTemplate : {});
      setDraft({...original});
      setEditingVersion(savedVersion);
      setDirty(false);
    }
    displayedMonthRef.current = budgetMonth;
  },[budgetMonth,savedVersion,budgetTemplate]);

  const activeBudgets = savedRow?.category_budgets
    || (budgetMonth >= localMonthMY() ? budgetTemplate : {});
  const summary = useMemo(
    ()=>summarizeMonthlyBudget(records,activeBudgets,budgetMonth,categories),
    [records,activeBudgets,budgetMonth,categories],
  );
  const historicalMissing = !savedRow && budgetMonth < localMonthMY();
  const status = savedRow ? "Saved snapshot · version " + savedRow.version
    : historicalMissing ? "No historical budget saved — not reconstructed automatically."
      : "Unsaved proposed month · showing default template until saved.";

  function change(category,value) {
    setDraft(current=>({...current,[category]:value}));
    setDirty(true);
  }
  async function saveMonth() {
    setBusy(true);
    try {
      const valid = normalizeBudgetsInput(draft);
      const ok = await onSaveMonthly(budgetMonth, valid, editingVersion);
      if (ok) { setEditingVersion((n)=>n===null?1:n+1);setDirty(false); }
    } catch (e) { alert(e.message); }
    finally {setBusy(false);}
  }
  async function saveTemplate() {
    setBusy(true);
    try { 
      const valid = normalizeBudgetsInput(draft);
      const ok = await onSaveTemplate(valid);
      if (ok) alert("Default budget template saved to the cloud.");
    } catch(e) { alert(e.message); }
    finally {setBusy(false);}
  }

  return (
    <div className={embedded ? "min-w-0 bg-white p-1" : "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Monthly Budget / 分类预算</h2>
          <p className="mt-1 text-sm text-slate-500">Uses calendar months only — unaffected by the Transaction Filter.</p>
        </div>
        <label className="text-xs font-bold text-slate-600">Budget Month
          <input type="month" className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={budgetMonth} onChange={e=>{
              if (!e.target.value || e.target.value===budgetMonth) return;
              if (dirty && !window.confirm("Discard unsaved budget edits for this month?")) return;
              setBudgetMonth(e.target.value);
            }}/>
        </label>
      </div>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{status}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Budget</p><p className="mt-1 font-bold">{savedRow||!historicalMissing?money(summary.totalBudget):"Not saved"}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Budgeted spending</p><p className="mt-1 font-bold">{money(summary.trackedExpense)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Without budget</p><p className="mt-1 font-bold">{money(summary.unbudgetedExpense)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Remaining</p>
          <p className="mt-1 font-bold">{summary.usage===null?"Not set":money(summary.remaining)}</p></div>
      </div>
      {summary.usage!==null && <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={summary.usage>=100?"h-full bg-red-600":summary.usage>=75?"h-full bg-amber-500":"h-full bg-green-600"}
            style={{width:String(Math.min(summary.usage,100))+"%"}}/>
        </div>
        <p className="mt-1 text-xs text-slate-600">Used {summary.usage.toFixed(1)}% — 75% warning, 100% over budget</p>
      </div>}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {summary.rows.map(row=>(
          <div key={row.category} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-900">{row.category}</p>
              <p className="text-xs font-semibold text-slate-700">{row.hasBudget ? row.usage.toFixed(0)+"%" : "Not set"}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Spent {money(row.spent)} · {row.hasBudget?"Budget "+money(row.budget):"No budget set"}</p>
            {row.hasBudget && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={row.usage>=100?"h-full bg-red-600":row.usage>=75?"h-full bg-amber-500":"h-full bg-green-600"}
                style={{width:String(Math.min(row.usage,100))+"%"}}/>
            </div>}
            <label className="mt-3 block text-xs text-slate-600">Budget for {budgetMonth} (RM)
              <input type="text" inputMode="decimal" value={draft[row.category]??""}
                placeholder="Not set" onChange={e=>change(row.category,e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"/>
            </label>
            {row.hasBudget && <p className="mt-1 text-xs text-slate-500">Remaining {money(row.remaining)}</p>}
          </div>
        ))}
      </div>
      {dirty && <p className="mt-3 text-xs font-semibold text-amber-700">Unsaved monthly edits — summary above shows last saved values until you save.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={saveMonth}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          Save budget for {budgetMonth}
        </button>
        <button type="button" disabled={busy} onClick={saveTemplate}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
          Set as default template
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Each saved month stays independent. The default template applies only to months without a saved snapshot. Historical months without a snapshot are labeled as such.
      </p>
    </div>
  );
}
