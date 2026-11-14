import React,{useEffect,useMemo,useState} from "react";
import FinanceMobileRecords from "./FinanceMobileRecords.jsx";
import {money,cents,rm} from "./financeStage1Analytics.js";

export default function FinanceAdvancedResults({rows=[],EditableCell,onUpdate,onDelete,categoryOptionsFor,methodOptionsFor}){
  const [visible,setVisible]=useState(100),[confirmId,setConfirmId]=useState(null);
  useEffect(()=>{setVisible(100);setConfirmId(null);},[rows]);
  const summary=useMemo(()=>{
    let income=0,expense=0;
    for(const r of rows){if(r.type==="income")income+=cents(r.amount);else expense+=cents(r.amount);}
    return {income:rm(income),expense:rm(expense),net:rm(income-expense)};
  },[rows]);
  const shown=rows.slice(0,visible);
  const editable=(r,field,value)=> <EditableCell value={value} field={field} recordType={r.type}
    onSave={next=>onUpdate(r.id,field,next)} categoryOptionsFor={categoryOptionsFor} methodOptionsFor={methodOptionsFor}/>;
  return <section className="mt-4 min-w-0" aria-label="Advanced search results">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
      <b className="text-sm">{rows.length} matching records (global sort)</b>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-800">+{money(summary.income)}</span>
        <span className="rounded-lg bg-rose-50 px-2 py-1.5 text-rose-800">−{money(summary.expense)}</span>
        <span className="rounded-lg bg-white px-2 py-1.5">{money(summary.net)}</span>
      </div>
    </div>
    {!rows.length&&<p className="mt-3 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No records match these conditions.</p>}
    <div className="mt-3 hidden overflow-x-auto md:block">
      {!!shown.length&&<table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead><tr className="border-b text-xs text-slate-500">
          {["Date","Type","Category","Method","Amount","Note","Actions"].map(h=><th key={h} className="p-2">{h}</th>)}
        </tr></thead>
        <tbody>{shown.map(r=><tr key={r.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
          <td className="p-2">{editable(r,"date",r.date)}</td>
          <td className="p-2">{r.type}</td>
          <td className="p-2">{editable(r,"category",r.category)}</td>
          <td className="p-2">{editable(r,"method",r.method)}</td>
          <td className="p-2 font-semibold">{editable(r,"amount",r.amount)}</td>
          <td className="p-2">{editable(r,"note",r.note||"")}</td>
          <td className="p-2">{confirmId===r.id?
            <span className="flex gap-1">
              <button type="button" onClick={()=>{setConfirmId(null);onDelete(r.id);}} className="rounded-lg bg-red-700 px-2 py-2 text-xs text-white">Confirm</button>
              <button type="button" onClick={()=>setConfirmId(null)} className="rounded-lg border px-2 py-2 text-xs">Cancel</button>
            </span>:
            <button type="button" onClick={()=>setConfirmId(r.id)} className="rounded-lg px-2 py-2 text-xs text-red-700">Delete</button>}</td>
        </tr>)}</tbody>
      </table>}
    </div>
    <div className="md:hidden"><FinanceMobileRecords records={shown}
      onUpdate={onUpdate} onDelete={onDelete}
      categoryOptionsFor={categoryOptionsFor} methodOptionsFor={methodOptionsFor}/></div>
    {visible<rows.length&&<button type="button" onClick={()=>setVisible(n=>n+100)}
      className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">Show more ({shown.length}/{rows.length})</button>}
    <p className="mt-3 text-xs text-slate-500">Advanced search affects this records list only. Other Dashboard charts and totals retain their current Filter settings.</p>
  </section>;
}
