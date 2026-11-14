import React,{useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {emptyAdvancedFilter,validateAdvancedFilter,validateSavedFilters} from "./financeStage1Analytics.js";

const field="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
export default function FinanceAdvancedFilters({active,onApply,savedFilters=[],onSave,categoryOptions=[],methodOptions=[],disabled=false}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(emptyAdvancedFilter);
  const [saveName,setSaveName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const triggerRef=useRef(null);
  const current=()=>validateAdvancedFilter(draft);
  const apply=()=>{try{onApply(current());setOpen(false);setError("");}catch(e){setError(e.message);}};
  const choose=filter=>{try{const valid=validateAdvancedFilter(filter);setDraft(valid);onApply(valid);setOpen(false);setError("");}catch(e){setError(e.message);}};
  async function save(){
    if(busy||disabled)return;
    setBusy(true);setError("");
    try{
      const name=saveName.trim();if(!name)throw new Error("Enter a name for the saved filter.");
      const value=current(),id=crypto.randomUUID();
      const baseline=JSON.stringify(savedFilters);
      const next=validateSavedFilters([...savedFilters,{id,name,filters:value}]);
      if(!(await onSave(next,baseline)))throw new Error("Saving failed or settings changed on another device. Refresh and review.");
      setSaveName("");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function remove(id){
    if(busy||disabled)return;
    if(!window.confirm("Delete this saved search? No financial records will be affected."))return;
    setBusy(true);setError("");
    try{
      const baseline=JSON.stringify(savedFilters),next=validateSavedFilters(savedFilters.filter(f=>f.id!==id));
      if(!(await onSave(next,baseline)))throw new Error("Could not delete saved search. Refresh and retry.");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const toggle=(kind,item)=>setDraft(p=>({...p,[kind]:p[kind].includes(item)?p[kind].filter(x=>x!==item):[...p[kind],item]}));
  return <div className="mt-3 min-w-0 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
    <div className="flex flex-wrap items-center gap-2">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={()=>{setDraft(active||emptyAdvancedFilter());setError("");setOpen(true);}}
        className="mh-modal-trigger rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        ⚙ Advanced Search / 高级筛选
      </button>
      {active&&<button type="button" onClick={()=>onApply(null)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold">Clear advanced search</button>}
      <span className="text-xs text-slate-600">{active?"Advanced results shown independently of Dashboard Filters.":"Normal Dashboard Filter applies to Records."}</span>
    </div>
    {!!savedFilters.length&&<div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-600">Saved searches:</span>
      {savedFilters.map(f=><div key={f.id} className="flex max-w-full items-center rounded-xl border border-slate-200 bg-white">
        <button type="button" data-i18n-ignore title={f.name} onClick={()=>choose(f.filters)}
          className="max-w-[160px] truncate px-3 py-2 text-xs font-semibold">{f.name}</button>
        <button type="button" onClick={()=>remove(f.id)} disabled={disabled||busy}
          aria-label={"Delete saved search "+f.name} title="Delete saved search" className="min-h-9 border-l border-slate-200 px-2 text-red-700 disabled:opacity-50">×</button>
      </div>)}
    </div>}
    {error&&!open&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    <FinanceOverlay open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Advanced Transaction Search" triggerRef={triggerRef} widthClass="max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">From date <input type="date" className={field} value={draft.from} onChange={e=>setDraft(p=>({...p,from:e.target.value}))}/></label>
        <label className="text-sm">To date <input type="date" className={field} value={draft.to} onChange={e=>setDraft(p=>({...p,to:e.target.value}))}/></label>
        <label className="text-sm">Record type
          <select className={field} value={draft.type} onChange={e=>setDraft(p=>({...p,type:e.target.value}))}>
            <option value="all">All records</option><option value="expense">Expense</option><option value="income">Income</option>
          </select>
        </label>
        <label className="text-sm">Sort by
          <select className={field} value={draft.sort} onChange={e=>setDraft(p=>({...p,sort:e.target.value}))}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            <option value="amountHigh">Amount high → low</option><option value="amountLow">Amount low → high</option>
          </select>
        </label>
        <label className="text-sm">Minimum RM <input inputMode="decimal" className={field} value={draft.min} placeholder="Optional"
          onChange={e=>setDraft(p=>({...p,min:e.target.value}))}/></label>
        <label className="text-sm">Maximum RM <input inputMode="decimal" className={field} value={draft.max} placeholder="Optional"
          onChange={e=>setDraft(p=>({...p,max:e.target.value}))}/></label>
        <label className="text-sm sm:col-span-2">Note or keyword <input className={field} value={draft.keyword} maxLength={160}
          onChange={e=>setDraft(p=>({...p,keyword:e.target.value}))} placeholder="Search saved transaction text"/></label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[[ "categories","Category",categoryOptions],["methods","Payment Method",methodOptions]].map(([kind,label,options])=><fieldset key={kind} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-bold">{label} · multi-select</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {options.map(option=><label key={option} className="flex min-h-9 items-center gap-2 break-words text-sm">
              <input type="checkbox" checked={draft[kind].includes(option)} onChange={()=>toggle(kind,option)}/>
              <span data-i18n-ignore>{option}</span>
            </label>)}
          </div>
          <p className="mt-2 text-xs text-slate-500">No selections = all {label.toLowerCase()} values.</p>
        </fieldset>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={apply} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Apply advanced search</button>
        <button type="button" onClick={()=>setDraft(emptyAdvancedFilter())} className="rounded-xl border px-4 py-3 text-sm">Reset fields</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
        <label className="min-w-[150px] flex-1 text-sm">Saved search name
          <input maxLength={60} className={field} value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="My TNG expenses"/>
        </label>
        <button type="button" onClick={save} disabled={busy||disabled||savedFilters.length>=20}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">
          {busy?"Saving...":"Save to cloud"}
        </button>
      </div>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">Saved search stores filter criteria only, never duplicates or edits financial records. Review flags become available after the separate Review Inbox feature is implemented.</p>
    </FinanceOverlay>
  </div>;
}
