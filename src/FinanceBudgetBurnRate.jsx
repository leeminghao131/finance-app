import React,{useMemo,useState} from "react";
import {localDateMY} from "./financeCalendar.js";
import {forecastBudgetBurnRate,money} from "./financeStage1Analytics.js";

/** Budget prediction is a read-only view of the saved calendar-month snapshot. */
export default function FinanceBudgetBurnRate({records,budgets,month,categories}){
  const [rate,setRate]=useState("month");
  const result=useMemo(()=>{
    try{return {data:forecastBudgetBurnRate(records,budgets,month,localDateMY(),categories)};}
    catch(e){return {error:e.message};}
  },[records,budgets,month,categories]);
  if(result.error)return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Prediction unavailable: {result.error}</p>;
  const data=result.data;
  const visible=data.rows.filter(r=>r.hasBudget||r.spent>0).sort((a,b)=>b.spent-a.spent||a.category.localeCompare(b.category));
  return <section className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200" aria-label="Budget Burn Rate Forecast">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-bold text-slate-900">Budget Burn Rate Forecast</h3>
        <p className="mt-1 text-xs text-slate-600">{month} · {data.historical?"Past month":data.future?"Future month":data.elapsed+" / "+data.totalDays+" days elapsed"} · {data.note}</p>
      </div>
      <div className="flex gap-1">
        <button type="button" aria-pressed={rate==="month"} onClick={()=>setRate("month")}
          className={"rounded-lg px-3 py-2 text-xs font-bold "+(rate==="month"?"bg-slate-900 text-white":"bg-white text-slate-700 ring-1 ring-slate-200")}>Month average</button>
        <button type="button" aria-pressed={rate==="recent"} onClick={()=>setRate("recent")}
          className={"rounded-lg px-3 py-2 text-xs font-bold "+(rate==="recent"?"bg-slate-900 text-white":"bg-white text-slate-700 ring-1 ring-slate-200")}>Last 7 days</button>
      </div>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {visible.map(r=>{
        const projected=rate==="month"?r.projectedMonth:r.projectedRecent;
        const excess=projected!==null&&r.hasBudget?Math.max(0,Math.round((projected-r.budget)*100)/100):null;
        return <div key={r.category} className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-2">
            <b className="break-words text-sm" data-i18n-ignore>{r.category}</b>
            <span className={"shrink-0 text-xs font-semibold "+(excess>0?"text-red-700":"text-slate-500")}>{r.hasBudget?money(r.budget)+" budget":"No budget set"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className={"h-2 rounded-full "+(r.usage>=100?"bg-red-600":r.usage>=75?"bg-amber-500":"bg-teal-600")}
              style={{width:Math.min(100,r.usage??0)+"%"}}/>
          </div>
          <p className="mt-2 text-xs text-slate-600">Spent {money(r.spent)} · {r.hasBudget?"Remaining "+money(r.remaining):"Not budgeted"}</p>
          {data.future?<p className="mt-1 text-xs text-slate-500">Prediction unavailable until this month begins.</p>:
          data.historical?<p className="mt-1 text-xs text-slate-500">Past month · actual spending, not predicted.</p>:<>
            <p className="mt-2 text-sm font-bold text-slate-900">Projected month-end: {money(projected)}</p>
            {r.hasBudget&&<p className={"text-xs "+(excess>0?"font-semibold text-red-700":"text-emerald-700")}>
              {excess>0?"Possible overspend "+money(excess):"Within budget at this rate"}
            </p>}
            {r.safeDaily!==null&&<p className="mt-1 text-xs text-slate-600">Safe average per remaining day: {money(r.safeDaily)}</p>}
            {r.insufficient&&<p className="mt-1 text-xs text-amber-700">Very early in month — estimate may vary significantly.</p>}
          </>}
        </div>;
      })}
    </div>
    {!visible.length&&<p className="mt-3 text-sm text-slate-500">No configured category budgets or recorded spending this month.</p>}
    <p className="mt-3 text-xs text-slate-500">Read-only estimates. They never alter budget snapshots, Expected Income, transactions, or Transfers.</p>
  </section>;
}
