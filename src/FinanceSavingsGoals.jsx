import React,{useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {validateSavingsGoals,savingsGoalProgress,calculateAutomaticGoalSaved} from "./financePlanning.js";
import {requireCalendarDate} from "./financeCalendar.js";

const money=n=>new Intl.NumberFormat("en-MY",{currency:"MYR",style:"currency"}).format(Number(n||0));
const blank=()=>({title:"",target:"",saved:"0.00",savedMode:"manual",budgetMultiplier:"1",deadline:""});
export default function FinanceSavingsGoals({goals=[],onSave,disabled=false,savingsAvailability,budgetMonth,calculationError}) {
  const {language}=useFinanceLanguage(),zh=language==="zh";
  // Shared, read-only available savings. Existing persisted goal.saved values are retained.
  const available=savingsAvailability?.available ?? 0;
  const reservedBudget=savingsAvailability?.monthlyBudget ?? 0;
  const overallBalance=savingsAvailability?.totalBalance ?? 0;
  const shortfall=savingsAvailability?.shortfall ?? 0;
  const [editor,setEditor]=useState(null);
  const [draft,setDraft]=useState(blank);
  const [base,setBase]=useState("");
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const editorTriggerRef=useRef(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const start=(goal=null,origin=null)=>{
    if(origin)editorTriggerRef.current=origin;
    if(disabled||busy)return;
    setBase(JSON.stringify(goals));
    setDraft(goal?{title:goal.title,target:String(goal.target),saved:String(goal.saved),
      savedMode:goal.savedMode||"manual",budgetMultiplier:String(goal.budgetMultiplier??1),
      deadline:goal.deadline||""}:blank());
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
      const goal={id,title,target:draft.target,saved:draft.saved,deadline:draft.deadline,
        savedMode:draft.savedMode,budgetMultiplier:draft.budgetMultiplier};
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
  if(calculationError || !savingsAvailability){
    return <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-200" aria-label="Savings Goals">
      <h2 className="text-lg font-bold">Savings Goals</h2>
      <p role="alert" className="mt-2 text-sm text-red-700">
        Savings calculation unavailable: {calculationError || "The current verified balance or budget is unavailable."}
      </p>
    </section>;
  }
  const fullMonthBudget=savingsAvailability.monthlyBudgetTotal;
  const autoContext={totalBalance:overallBalance,monthlyBudgetTotal:fullMonthBudget};
  let autoPreview=null,autoPreviewError="";
  if(draft.savedMode==="auto"){
    try{autoPreview=calculateAutomaticGoalSaved(overallBalance,fullMonthBudget,draft.budgetMultiplier);}
    catch(e){autoPreviewError=e.message||"Invalid multiplier.";}
  }
  const all=goals.slice().sort((a,b)=>a.title.localeCompare(b.title));
  return <section aria-label="Savings Goals" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Savings Goals</h2>
        
      </div>
      <button type="button" disabled={disabled||busy||goals.length>=50} onClick={event=>start(null,event.currentTarget)}
        className="mh-modal-trigger min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        ＋ New Goal
      </button>
    </div>
    {message&&<p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
      <p className="font-semibold text-slate-700">{zh?"共享可用储蓄余额（只读）":"Available savings (shared, read-only)"}: <span className="text-slate-900">{money(available)}</span></p>
      <p className="mt-1 text-xs text-slate-600">{zh?"当前总余额":"Current Balance"} {money(overallBalance)} − {budgetMonth} {zh?"当月剩余预算":"Unspent monthly budget"} {money(reservedBudget)} = {money(savingsAvailability?.netAfterBudget ?? 0)}</p>
      {shortfall>0&&<p className="mt-1 text-xs font-semibold text-amber-800">{zh ? "预算超过余额：" : "Budget exceeds Balance by "}{money(shortfall)}. {zh ? "可用储蓄金额显示为 RM0.00。" : "Available savings shown as RM0.00."}</p>}
      
    </div>
    {!all.length&&!editor&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No Savings Goals yet. Add one to start tracking your progress.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {all.map(g=>{
        const p=savingsGoalProgress(g,autoContext);
        return <article key={g.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="break-words text-sm font-bold text-slate-900" data-i18n-ignore>{g.title}</h3>
            <span className={"shrink-0 text-xs font-semibold "+(p.completed?"text-emerald-700":"text-slate-500")}>{p.completed?"Completed":"In progress"}</span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{money(p.saved)} <span className="text-sm font-normal text-slate-500">/ {money(g.target)}</span></p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-600" style={{width:Math.min(100,Math.max(0,p.percent))+"%"}}/>
          </div>
          <p className="mt-2 text-xs text-slate-600">{p.percent.toFixed(1)}% · {money(p.remaining)} {zh ? "剩余" : "remaining"}</p>
          <p className="mt-1 text-xs text-slate-500">{p.mode==="auto"
            ? (zh?"自动 · 总余额 − 月度预算 × ":"Auto · Balance − monthly budget × ")+(g.budgetMultiplier??1)
            : (zh?"手动已存金额":"Manual saved amount")}</p>
          {g.deadline&&<p className="mt-1 text-xs text-slate-500">{zh ? "目标日期：" : "Target date: "}{g.deadline}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={disabled||busy} onClick={event=>start(g,event.currentTarget)}
              className="mh-modal-trigger min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">Edit / Update</button>
            <button type="button" disabled={disabled||busy} onClick={()=>remove(g)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Delete</button>
          </div>
        </article>;
      })}
    </div>
    <FinanceOverlay open={!!editor} title={editor==="new"?"Create Savings Goal":"Edit Savings Goal"}
      onClose={close} triggerRef={editorTriggerRef} widthClass="max-w-2xl">
    <form onSubmit={submit} className="rounded-xl border border-slate-300 bg-white p-4" aria-label="Savings Goal Editor">
      <h3 className="font-semibold">{editor==="new"?"Create Savings Goal":"Edit Savings Goal"}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Goal name
          <input required maxLength={100} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Emergency fund"/>
        </label>
        <label className="text-sm">Target amount (RM)
          <input required type="text" inputMode="decimal" value={draft.target} onChange={e=>setDraft(p=>({...p,target:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
        </label>
        <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold text-slate-700">{zh?"已存金额计算方式":"Saved amount calculation"}</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="savingsMode" value="manual" checked={draft.savedMode==="manual"}
                onChange={()=>setDraft(p=>({...p,savedMode:"manual",
                  budgetMultiplier:/^(?:0|[1-9]\\d{0,2})(?:\\.\\d{1,2})?$/.test(String(p.budgetMultiplier)) && Number(p.budgetMultiplier)<=120
                    ? p.budgetMultiplier : "1"}))}/> {zh?"手动输入":"Manual input"}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="savingsMode" value="auto" checked={draft.savedMode==="auto"}
                onChange={()=>setDraft(p=>({...p,savedMode:"auto"}))}/> {zh?"自动：总余额 − 月度预算 × X":"Auto: Balance − Monthly Budget × X"}
            </label>
          </div>
        </fieldset>
        {draft.savedMode==="manual"?
          <label className="text-sm">Saved towards this goal (RM)
            <input required type="text" inputMode="decimal" value={draft.saved}
              onChange={e=>setDraft(p=>({...p,saved:e.target.value}))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
          </label>
          :
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-sm">
            <label className="block font-medium text-slate-700">{zh?"月度预算倍数（X）":"Monthly Budget multiplier (X)"}
              <input type="number" min="0" max="120" step="0.01" required value={draft.budgetMultiplier}
                onChange={e=>setDraft(p=>({...p,budgetMultiplier:e.target.value}))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"/>
            </label>
            <p className="mt-2 text-xs text-slate-600">{zh?"当前总余额":"Current Balance"} {money(overallBalance)} − {zh?"当月完整预算":"Full monthly budget"} {money(fullMonthBudget)} × {draft.budgetMultiplier||"?"}</p>
            {autoPreviewError?<p role="alert" className="mt-1 text-xs font-semibold text-red-700">{autoPreviewError}</p>
              :<p className="mt-1 font-bold text-slate-900">{zh?"自动计算的已存金额：":"Auto saved estimate:"} {money(autoPreview)}</p>}
          </div>}

        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-600">{zh?"共享可用储蓄余额（不等于目标进度）":"Shared available savings (not goal progress)"}</p>
          <p className="mt-1 font-bold text-slate-900">{money(available)}</p>
        </div>
        <label className="text-sm">Target date (optional)
          <input type="date" value={draft.deadline} onChange={e=>setDraft(p=>({...p,deadline:e.target.value}))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"/>
        </label>
      </div>
      
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={disabled||busy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?"Saving...":"Save Goal"}</button>
        <button type="button" disabled={busy} onClick={close} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
    </FinanceOverlay>
  </section>;
}
