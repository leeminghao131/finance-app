import { localizedFinanceAlert, localizedFinanceConfirm } from "./FinanceLanguageLayer.jsx";
import React, { useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { localDateMY, shiftCalendarDay, requireCalendarDate } from "./financeCalendar.js";
import { calculateCashForecast } from "./financeInsights.js";
import { parseEditedAmount } from "./financeData.js";
import FinanceOverlay from "./FinanceOverlay.jsx";

const money = n => new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(Number(n||0));

export default function FinanceForecastPanel({records,selectedMonth,asOfDate,plannedIncomes,openingBalanceTotal=0,onSavePlans}) {
  const [horizon,setHorizon] = useState("monthEnd");
  const [trailingDays,setTrailingDays] = useState(30);
  const [editForm,setEditForm] = useState({date:shiftCalendarDay(localDateMY(),1),amount:"",note:""});
  const [busy,setBusy] = useState(false);
  const [incomePlannerOpen,setIncomePlannerOpen] = useState(false);
  const incomePlannerTriggerRef = useRef(null);

  const outcome = useMemo(()=>{
    try {return {data:calculateCashForecast(records,{asOfDate,selectedMonth,horizon,trailingDays,plannedIncomes,openingBalanceTotal})};}
    catch(e){return {error:e.message};}
  },[records,asOfDate,selectedMonth,horizon,trailingDays,plannedIncomes,openingBalanceTotal]);
  const data = outcome.data;
  const visiblePlans = plannedIncomes.slice().sort((a,b)=>a.date.localeCompare(b.date));

  async function addPlan(event){
    event.preventDefault();
    let amount;
    try {
      requireCalendarDate(editForm.date);
      if(editForm.date<=asOfDate)throw new Error("Expected income date must be in the future.");
      amount=parseEditedAmount(editForm.amount);
    }catch(e){localizedFinanceAlert(e.message);return;}
    const newPlan = {
      id: crypto.randomUUID(), date:editForm.date, amount, note:String(editForm.note||"").trim(),
    };
    setBusy(true);
    try {
      const ok=await onSavePlans([...plannedIncomes,newPlan]);
      if(ok)setEditForm({date:shiftCalendarDay(asOfDate,1),amount:"",note:""});
    } finally{setBusy(false);}
  }
  async function removePlan(id){
    if(!localizedFinanceConfirm("Remove this expected income? No actual financial records will be deleted."))return;
    setBusy(true);
    try {await onSavePlans(plannedIncomes.filter(p=>p.id!==id));}
    finally {setBusy(false);}
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-xl font-bold">Cash Flow Forecast / 现金流预测</h2>
        <p className="mt-1 text-xs text-slate-500">Forecast uses cumulative ledger balance across months. Real income is never mixed with planned income.</p>
      </div>
      <div className="mt-4 grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-600">Range
          <select value={horizon} onChange={e=>setHorizon(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="monthEnd">Month-end ({selectedMonth})</option>
            <option value="30days">Next 30 days</option>
            <option value="90days">Next 90 days</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Daily expenses average
          <select value={trailingDays} onChange={e=>setTrailingDays(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>
        </label>
          </div>

          {outcome.error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{outcome.error}</p> :
        <>
          <p className="mt-3 text-sm font-semibold text-slate-700">{data.title} · {data.targetDate}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{data.historical?"Actual historic ledger balance":"Current ledger-estimated balance"}</p>
              <p className="mt-1 font-bold">{money(data.currentBalance)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Average daily expense</p>
              <p className="mt-1 font-bold">{money(data.averageDailyExpense)}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-green-700">Expected future income (not real)</p>
                <button type="button" aria-label="Manage Expected Income" title="Expected Income / 预计收入"
                  aria-haspopup="dialog" aria-expanded={incomePlannerOpen}
                  data-modal-trigger="expected-income"
                  ref={incomePlannerTriggerRef}
                  onClick={() => setIncomePlannerOpen(true)}
                  className="mh-modal-trigger flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-green-200 bg-white text-xl font-bold text-green-800 shadow-sm hover:bg-green-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700">
                  ＋
                </button>
              </div>
              <p className="mt-1 font-bold text-green-800">{money(data.expectedIncome)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-700">Projected remaining expenses</p>
              <p className="mt-1 font-bold text-red-800">{money(data.expectedExpense)}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-900 p-4 text-white">
              <p className="text-sm text-slate-200">{data.historical?"Actual month-end":"Predicted balance"} · {data.daysLeft} days projected</p>
              <p className="mt-1 text-2xl font-bold">{money(data.predictedBalance)}</p>
            </div>
          </div>
            </>
          }
        </div>
        {!outcome.error && (
          <div className="min-w-0">
            <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline} margin={{top:8,right:12,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="day" minTickGap={20} fontSize={10}/>
                <YAxis fontSize={10} width={52} tickFormatter={(n)=>String(Math.round(n))}/>
                <Tooltip formatter={v=>money(v)}/>
                <Legend/>
                <Line isAnimationActive={false} name="Actual ledger" type="monotone" dataKey="actual" stroke="#334155" strokeWidth={2} dot={false} connectNulls={false}/>
                <Line isAnimationActive={false} name="Forecast" type="monotone" dataKey="forecast" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
            <p className="mt-2 text-xs text-slate-500">{data.note} · Forecasts are estimates, not guarantees.</p>
          </div>
        )}
      </div>

      <FinanceOverlay open={incomePlannerOpen} title="Expected Income / 预计收入"
         triggerRef={incomePlannerTriggerRef}
        onClose={() => setIncomePlannerOpen(false)} widthClass="max-w-xl">
      <div className="space-y-3">
        <p className="mt-1 text-xs text-slate-500">Manual planning only. This does not create an actual Income record.</p>
        <form onSubmit={addPlan} className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">Expected date
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="date" required
              min={shiftCalendarDay(asOfDate,1)} value={editForm.date}
              onChange={e=>setEditForm(p=>({...p,date:e.target.value}))}/>
          </label>
          <label className="text-xs text-slate-600">Amount RM
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              type="text" inputMode="decimal" placeholder="2500.00" value={editForm.amount}
              onChange={e=>setEditForm(p=>({...p,amount:e.target.value}))} required/>
          </label>
          <label className="col-span-2 text-xs text-slate-600">Description
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={editForm.note} onChange={e=>setEditForm(p=>({...p,note:e.target.value}))}
              placeholder="Expected salary, allowance..."/>
          </label>
          <button type="submit" disabled={busy} className="col-span-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Add expected income
          </button>
        </form>
        <div className="mt-3 space-y-2">
          {visiblePlans.map(row=>(
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <div><p className="text-sm font-bold text-slate-900">{row.note ? <span data-i18n-ignore>{row.note}</span> : "Expected income"} · {money(row.amount)}</p>
                <p className="text-xs text-slate-500">{row.date} · Not actual income</p></div>
              <button type="button" disabled={busy} onClick={()=>removePlan(row.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Remove plan</button>
            </div>
          ))}
          {visiblePlans.length===0&&<p className="text-sm text-slate-500">No planned incomes yet.</p>}
        </div>
      </div>

      </FinanceOverlay>
    </div>
  );
}
