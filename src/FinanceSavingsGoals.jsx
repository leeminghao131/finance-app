import React,{useRef,useState} from "react";
import {validateSavingsGoals,savingsGoalProgress} from "./financePlanning.js";
import {requireCalendarDate} from "./financeCalendar.js";

const money=n=>new Intl.NumberFormat("en-MY",{currency:"MYR",style:"currency"}).format(Number(n||0));
const blank=()=>({title:"",target:"",saved:"0.00",deadline:""});
export default function FinanceSavingsGoals({goals=[],onSave,disabled=false}) {
  const [editor,setEditor]=useState(null);
  const [draft,setDraft]=useState(blank);
  const [base,setBase]=useState("");
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const start=(goal=null)=>{
    if(disabled||busy)return;
    setBase(JSON.stringify(goals));
    setDraft(goal?{title:goal.title,target:String(goal.target),saved:String(goal.saved),deadline:goal.deadline||""}:blank());
    setEditor(goal?.id||"new");setError("");setMessage("");
  };
  const close=()=>{
    if(busy)return;
    if(editor&&(!window.confirm("Discard unsaved Savings Goal changes?")))return;
    setEditor(null);setError("");
  };
  const commit=async(next,baseline)=>{
    if(pending.current)return false;
    pending.current=true;setBusy(true);setError("");setMessage("");
    try {
      if(JSON.stringify(goals)!==baseline) throw new Error("Savings Goals changed on another device. Reopen the editor and try again.");
      const normalized=validateSavingsGoals(next);
      const ok=await onSave(normalized,baseline);
      if(!ok)throw new Error("Savings Goals not saved. Your data may have changed on another device; refresh and review before retrying.");
      setMessage("Savings Goals saved to cloud.");return true;
    }catch(e){setError(e.message);return false;}
    finally{pending.current=false;setBusy(false);}
  };
  async function submit(e){
    e.preventDefault();
    try {
      const title=draft.title.trim();
      if(draft.deadline)requireCalendarDate(draft.deadline);
      const id=editor==="new"?crypto.randomUUID():editor;
      const goal={id,title,target:draft.target,saved:draft.saved,deadline:draft.deadline};
      const next=editor==="new"?[...goals,goal]:goals.map(g=>g.id===id?goal:g);
      if(await commit(next,base))setEditor(null);
    }catch(e){setError(e.message);}
  }
  async function remove(goal){
    if(disabled||busy)return;
    if(!window.confirm("Delete Savings Goal '"+goal.title+"'? Only this goal plan is removed. No financial transactions or transfers will be deleted."))return;
    const baseline=JSON.stringify(goals);
    if(await commit(goals.filter(g=>g.id!==goal.id),baseline))setEditor(null);
  }
  const all=goals.slice().sort((a,b)=>a.title.localeCompare(b.title));
  return <section aria-label="Savings Goals" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Savings Goals</h2>
        <p className="mt-1 text-xs text-slate-500">Track saved amounts manually. Goals do not move money or create Income / Expense / Transfer records.</p>
      </div>
      <button type="button" disabled={disabled||busy||goals.length>=50} onClick={()=>start()}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        ＋ New Goal
      </button>
    </div>
    {message&&<p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!all.length&&!editor&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No Savings Goals yet. Add one to start tracking your progress.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {all.map(g=>{
        const p=savingsGoalProgress(g);
        return <article key={g.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="break-words text-sm font-bold text-slate-900" data-i18n-ignore>{g.title}</h3>
            <span className={"shrink-0 text-xs font-semibold "+(p.completed?"text-emerald-700":"text-slate-500")}>{p.completed?"Completed":"In progress"}</span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{money(g.saved)} <span className="text-sm font-normal text-slate-500">/ {money(g.target)}</span></p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-600" style={{width:Math.min(100,Math.max(0,p.percent))+"%"}}/>
          </div>
          <p className="mt-2 text-xs text-slate-600">{p.percent.toFixed(1)}% · {money(p.remaining)} remaining</p>
          {g.deadline&&<p className="mt-1 text-xs text-slate-500">Target date: {g.deadline}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={disabled||busy} onClick={()=>start(g)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">Edit / Update</button>
            <button type="button" disabled={disabled||busy} onClick={()=>remove(g)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Delete</button>
          </div>
        </article>;
      })}
    </div>
    {editor&&<form onSubmit={submit} className="mt-4 rounded-xl border border-slate-300 bg-white p-4" aria-label="Savings Goal Editor">
      <h3 className="font-semibold">{editor==="new"?"Create Savings Goal":"Edit Savings Goal"}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Goal name
          <input required maxLength={100} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Emergency fund"/>
        </label>
        <label className="text-sm">Target amount (RM)
          <input required type="text" inputMode="decimal" value={draft.target} onChange={e=>setDraft(p=>({...p,target:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="5000.00"/>
        </label>
        <label className="text-sm">Saved amount (RM)
          <input required type="text" inputMode="decimal" value={draft.saved} onChange={e=>setDraft(p=>({...p,saved:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="0.00"/>
        </label>
        <label className="text-sm">Target date (optional)
          <input type="date" value={draft.deadline} onChange={e=>setDraft(p=>({...p,deadline:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
        </label>
      </div>
      <p className="mt-3 text-xs text-amber-800">Saved amount is a manually tracked planning value, not a verified bank balance. Editing it never changes your real transactions.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={disabled||busy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?"Saving...":"Save Goal"}</button>
        <button type="button" disabled={busy} onClick={close} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>}
  </section>;
}
