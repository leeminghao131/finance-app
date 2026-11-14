import React,{useEffect,useMemo,useRef,useState} from "react";
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {simulateFinanceScenarios,money,cents} from "./financeStage1Analytics.js";
import {localDateMY} from "./financeCalendar.js";

const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
const blank=()=>({name:"My Scenario",months:12,incomeAdjustment:"300",expenseReduction:"200",extraExpense:"0"});
const safeRead=(userId)=>{
  if(!userId)return [];
  try{const raw=JSON.parse(localStorage.getItem("mh-stage1-scenarios:"+userId)||"[]");
    return Array.isArray(raw)?raw.filter(r=>r&&typeof r.id==="string").slice(0,3):[];}
  catch{return [];}
};
export default function FinanceScenarioSimulator({records=[],totalBalance=0,userId,disabled=false}){
  const [open,setOpen]=useState(false),[form,setForm]=useState(blank),[saved,setSaved]=useState([]);
  const [goal,setGoal]=useState("10000"),[error,setError]=useState("");
  const triggerRef=useRef(null);
  useEffect(()=>{setSaved(safeRead(userId));setForm(blank());setError("");},[userId]);
  const result=useMemo(()=>{
    try{return {value:simulateFinanceScenarios(records,{
      currentBalance:totalBalance,asOfDate:localDateMY(),months:Number(form.months),
      incomeAdjustment:form.incomeAdjustment,expenseReduction:form.expenseReduction,extraExpense:form.extraExpense,
    })};}catch(e){return {error:e.message};}
  },[records,totalBalance,form.months,form.incomeAdjustment,form.expenseReduction,form.extraExpense]);
  const update=(field,value)=>setForm(p=>({...p,[field]:value}));
  function persist(next){
    if(!userId)throw new Error("Sign in before saving simulation presets.");
    localStorage.setItem("mh-stage1-scenarios:"+userId,JSON.stringify(next));
    setSaved(next);
  }
  function savePreset(){
    try{
      if(result.error)throw new Error(result.error);
      const name=form.name.trim();
      if(!name||name.length>50)throw new Error("Preset name must be 1 to 50 characters.");
      if(saved.length>=3)throw new Error("Maximum of 3 saved scenarios on this device.");
      persist([...saved,{...form,name,id:crypto.randomUUID()}]);
      setError("");
    }catch(e){setError(e.message);}
  }
  function removePreset(id){
    try{if(!window.confirm("Remove this saved simulation preset? No finance records will change."))return;
      persist(saved.filter(r=>r.id!==id));setError("");}catch(e){setError(e.message);}
  }
  let needed=null;
  try{const target=cents(goal);if(target<0)throw Error("Target must be positive.");needed=money(Math.ceil(target/Number(form.months))/100);}
  catch{}
  const v=result.value;
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={()=>setOpen(true)}
      className="mh-modal-trigger rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">
      🪐 What-if Simulator / 时间机器
    </button>
    <FinanceOverlay open={open} onClose={()=>setOpen(false)} title="Financial Time Machine / 财务时间机器" triggerRef={triggerRef} widthClass="max-w-5xl">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Months
          <select className={field} value={form.months} onChange={e=>update("months",Number(e.target.value))}>
            {[3,6,12,24].map(n=><option key={n} value={n}>{n} months</option>)}
          </select>
        </label>
        <label className="text-sm">Extra income / month (RM)
          <input inputMode="decimal" className={field} value={form.incomeAdjustment} onChange={e=>update("incomeAdjustment",e.target.value)}/>
        </label>
        <label className="text-sm">Less expense / month (RM)
          <input inputMode="decimal" className={field} value={form.expenseReduction} onChange={e=>update("expenseReduction",e.target.value)}/>
        </label>
        <label className="text-sm">Extra spending / month (RM)
          <input inputMode="decimal" className={field} value={form.extraExpense} onChange={e=>update("extraExpense",e.target.value)}/>
        </label>
      </div>
      {result.error?<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{result.error}</p>:
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Starting ledger Balance</p><b>{money(v.startingBalance)}</b></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Monthly historical net (estimated)</p><b>{money(v.historicIncome-v.historicExpense)}</b></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Added difference at the end</p><b className="text-lg text-emerald-900">{money(v.finalDifference)}</b></div>
          </div>
          <div className="mt-4 h-64 min-w-0" aria-label="Simulation line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={v.baseline.map((r,i)=>({month:r.month,baseline:r.balance,scenario:v.scenario[i].balance}))}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" fontSize={11}/>
                <YAxis width={52} fontSize={11}/><Tooltip formatter={n=>money(n)}/><Legend/>
                <Line name="Current pattern" dataKey="baseline" stroke="#64748b" dot={false} isAnimationActive={false}/>
                <Line name="Your scenario" dataKey="scenario" stroke="#0d9488" strokeWidth={3} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-600">Historical sample: {v.sampleRecords} records in the past {v.historicalDays} days. {v.disclaimer}</p>
        </>
      }
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <h3 className="font-semibold">Reverse goal planning / 反向目标规划</h3>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-sm">Additional savings goal (RM)
            <input className={field} inputMode="decimal" value={goal} onChange={e=>setGoal(e.target.value)}/>
          </label>
          <p className="pb-2 text-sm">Needed extra each month: <b>{needed||"Enter a valid RM target"}</b></p>
        </div>
        <p className="mt-2 text-xs text-slate-500">This shows the extra change needed across the chosen duration, not guaranteed cash or a saved Savings Goal.</p>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="font-semibold">Scenario presets · saved on this device only</h3>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[160px] flex-1 text-sm">Scenario name
            <input className={field} maxLength={50} value={form.name} onChange={e=>update("name",e.target.value)}/>
          </label>
          <button type="button" disabled={!!result.error||saved.length>=3} onClick={savePreset}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Save scenario</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {saved.map(s=><div key={s.id} className="flex items-center rounded-xl border bg-slate-50">
            <button type="button" onClick={()=>{setForm({...s});setError("");}} className="px-3 py-2 text-xs font-bold" data-i18n-ignore>{s.name}</button>
            <button type="button" onClick={()=>removePreset(s.id)} aria-label={"Delete preset "+s.name}
              className="border-l px-2 py-2 text-red-700">×</button>
          </div>)}
          {!saved.length&&<p className="text-xs text-slate-500">No presets saved yet.</p>}
        </div>
      </div>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs font-semibold text-amber-800">SIMULATION ONLY. This page never writes Income, Expense, Transfers, Budget, or Expected Income.</p>
    </FinanceOverlay>
  </>;
}
