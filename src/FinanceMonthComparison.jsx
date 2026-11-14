import React,{useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {Bar,BarChart,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {localMonthMY} from "./financeCalendar.js";
import {compareFinanceMonths} from "./financePlanning.js";

const money = n => new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
function previousMonth(month){const [y,m]=month.split("-").map(Number);return m===1?(y-1)+"-12":y+"-"+String(m-1).padStart(2,"0");}
export default function FinanceMonthComparison({records=[]}) {
  const current=localMonthMY();
  const [firstMonth,setFirstMonth]=useState(()=>previousMonth(current));
  const [secondMonth,setSecondMonth]=useState(current);
  const [showCategories,setShowCategories]=useState(false);
  const categoryCompareTriggerRef=useRef(null);
  const comparison=useMemo(()=>{
    try{return {value:compareFinanceMonths(records,firstMonth,secondMonth)};}
    catch(e){return {error:e.message};}
  },[records,firstMonth,secondMonth]);
  const value=comparison.value;
  const chart=value?[
    {metric:"Income",first:value.first.income,second:value.second.income},
    {metric:"Expense",first:value.first.expense,second:value.second.expense},
    {metric:"Net",first:value.first.net,second:value.second.net},
  ]:[];
  return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5" aria-label="Monthly Financial Comparison">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Monthly Financial Comparison</h2>
        <p className="mt-1 text-xs text-slate-500">Compare any two calendar months. Independent of Dashboard Filters. Transfers and Opening Balance are not Income or Expense.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-700">First month
          <input aria-label="First comparison month" type="month" value={firstMonth} onChange={e=>setFirstMonth(e.target.value)}
            className="mt-1 block w-36 rounded-xl border border-slate-300 px-2 py-2"/>
        </label>
        <label className="text-xs font-semibold text-slate-700">Second month
          <input aria-label="Second comparison month" type="month" value={secondMonth} onChange={e=>setSecondMonth(e.target.value)}
            className="mt-1 block w-36 rounded-xl border border-slate-300 px-2 py-2"/>
        </label>
        <button type="button" onClick={()=>{setFirstMonth(secondMonth);setSecondMonth(firstMonth);}}
          className="self-end rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">⇄ Swap</button>
      </div>
    </div>
    {comparison.error?<p role="alert" className="mt-3 text-sm text-red-700">{comparison.error}</p>:<>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Income",value.first.income,value.second.income,value.changes.income],
          ["Expense",value.first.expense,value.second.expense,value.changes.expense],
          ["Net cash flow",value.first.net,value.second.net,value.changes.net],
        ].map(([name,a,b,change])=><div key={name} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-700">{name}</p>
          <p className="mt-2 text-xs text-slate-500">{firstMonth}: <b className="text-slate-800">{money(a)}</b></p>
          <p className="mt-1 text-xs text-slate-500">{secondMonth}: <b className="text-slate-800">{money(b)}</b></p>
          <p className={"mt-2 text-sm font-bold "+(change===0?"text-slate-600":(name==="Expense"?change<0:change>0)?"text-emerald-700":"text-amber-700")}>
            {change>0?"+":""}{money(change)} change
            {a!==0?" ("+((change/Math.abs(a))*100).toFixed(1)+"%)":""}
          </p>
        </div>)}
      </div>
      <div className="mt-4 h-56 min-w-0" aria-label="Comparison bar chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{top:6,right:8,left:2,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="metric" fontSize={11}/>
            <YAxis width={48} fontSize={10}/><Tooltip formatter={n=>money(n)}/>
            <Legend/><Bar isAnimationActive={false} dataKey="first" name={firstMonth} fill="#64748b"/>
            <Bar isAnimationActive={false} dataKey="second" name={secondMonth} fill="#0f766e"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <button type="button" ref={categoryCompareTriggerRef} onClick={()=>setShowCategories(true)}
        aria-haspopup="dialog" aria-expanded={showCategories}
        className="mh-modal-trigger mt-3 min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">
        Show category comparison ({value.categories.length})
      </button>
      <FinanceOverlay open={showCategories} title="Category Comparison / 分类对比"
        onClose={()=>setShowCategories(false)} triggerRef={categoryCompareTriggerRef} widthClass="max-w-4xl">
        <div className="max-h-[65dvh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Category</th><th className="p-2">{firstMonth}</th><th className="p-2">{secondMonth}</th><th className="p-2">Difference</th></tr></thead>
          <tbody>{value.categories.map(c=><tr key={c.category} className="border-t">
            <td className="p-2" data-i18n-ignore>{c.category}</td><td className="p-2">{money(c.first)}</td>
            <td className="p-2">{money(c.second)}</td><td className="p-2">{money(c.change)}</td>
          </tr>)}</tbody>
        </table>
        {!value.categories.length&&<p className="p-3 text-sm text-slate-500">No expenses in either month.</p>}
        </div>
      </FinanceOverlay>
      <p className="mt-3 text-xs text-slate-500">Records: {firstMonth} ({value.first.count}) · {secondMonth} ({value.second.count}). Positive expense change means more spending.</p>
    </>}
  </section>;
}
