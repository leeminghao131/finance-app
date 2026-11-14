import React,{useEffect,useMemo,useRef,useState} from "react";
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {simulateFinanceScenarios,money,cents} from "./financeStage1Analytics.js";
import {localDateMY} from "./financeCalendar.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base";
const blank=(language="en")=>({name:language==="zh"?"我的方案":"My Scenario",months:12,incomeAdjustment:"300",expenseReduction:"200",extraExpense:"0"});
const safeRead=userId=>{
  if(!userId)return [];
  try{
    const raw=JSON.parse(localStorage.getItem("mh-stage1-scenarios:"+userId)||"[]");
    return Array.isArray(raw)?raw.filter(r=>r&&typeof r.id==="string").slice(0,3):[];
  }catch{return [];}
};

export default function FinanceScenarioSimulator({records=[],totalBalance=0,userId,disabled=false,dockButton=false}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const t=(cn,en)=>zh?cn:en;
  const [open,setOpen]=useState(false),[form,setForm]=useState(()=>blank(language)),[saved,setSaved]=useState([]);
  const [goal,setGoal]=useState("10000"),[error,setError]=useState("");
  const triggerRef=useRef(null);
  useEffect(()=>{setSaved(safeRead(userId));setForm(blank(language));setError("");},[userId]);

  // Stage 1 calculation and account-specific device presets are intentionally unchanged.
  const result=useMemo(()=>{
    try{return {value:simulateFinanceScenarios(records,{
      currentBalance:totalBalance,asOfDate:localDateMY(),months:Number(form.months),
      incomeAdjustment:form.incomeAdjustment,expenseReduction:form.expenseReduction,extraExpense:form.extraExpense,
    })};}catch(e){return {error:e.message};}
  },[records,totalBalance,form.months,form.incomeAdjustment,form.expenseReduction,form.extraExpense]);
  const update=(key,value)=>setForm(p=>({...p,[key]:value}));
  function persist(next){
    if(!userId)throw new Error(t("请先登录再保存模拟方案。","Sign in before saving simulation presets."));
    localStorage.setItem("mh-stage1-scenarios:"+userId,JSON.stringify(next));
    setSaved(next);
  }
  function savePreset(){
    try{
      if(result.error)throw new Error(result.error);
      const name=form.name.trim();
      if(!name||name.length>50)throw new Error(t("方案名称须为 1–50 个字符。","Preset name must be 1 to 50 characters."));
      if(saved.length>=3)throw new Error(t("当前设备最多保存三个方案。","Maximum of 3 saved scenarios on this device."));
      persist([...saved,{...form,name,id:crypto.randomUUID()}]);
      setError("");
    }catch(e){setError(e.message);}
  }
  function removePreset(id){
    try{
      if(!window.confirm(t("删除这个模拟方案？不会改变真实财务记录。","Remove this saved simulation? No financial records will change.")))return;
      persist(saved.filter(r=>r.id!==id));setError("");
    }catch(e){setError(e.message);}
  }
  let needed=null;
  try{
    const target=cents(goal);
    if(target<0)throw Error("Target must be nonnegative.");
    needed=money(Math.ceil(target/Number(form.months))/100);
  }catch{}
  const v=result.value;
  const comparisons=useMemo(()=>saved.map((preset,index)=>{
    try{
      const value=simulateFinanceScenarios(records,{
        currentBalance:totalBalance,asOfDate:localDateMY(),months:Number(preset.months),
        incomeAdjustment:preset.incomeAdjustment,expenseReduction:preset.expenseReduction,extraExpense:preset.extraExpense,
      });
      return {index,name:preset.name,months:Number(preset.months),value,form:preset};
    }catch{return null;}
  }).filter(Boolean),[saved,records,totalBalance]);
  const comparisonData=v?.baseline.map((row,i)=>{
    const entry={month:row.month,baseline:row.balance,scenario:v.scenario[i].balance};
    for(const p of comparisons)if(p.months===Number(form.months))entry["saved"+p.index]=p.value.scenario[i].balance;
    return entry;
  });
  const duration=Number(form.months);
  const baselineEnd=v?.baseline[v.baseline.length-1]?.balance;
  const scenarioEnd=v?.scenario[v.scenario.length-1]?.balance;
  const difference=v?.finalDifference;
  const inputCell=(key,label,slider=false)=>(
    <label key={key} className="block min-w-0 text-sm font-medium text-slate-700">{label}
      <input inputMode="decimal" className={field} value={form[key]} onChange={e=>update(key,e.target.value)}
        aria-label={label}/>
      {slider&&<input type="range" aria-label={label+t("滑块"," slider")} min="0" max="2000" step="50"
        value={Math.min(2000,Math.max(0,Number(form[key])||0))}
        onChange={e=>update(key,e.target.value)} className="mt-2 w-full accent-teal-600"/>}
    </label>);
  const summary=(label,value,accent="")=>(
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <p className="text-xs leading-relaxed text-slate-500">{label}</p>
      <p className={"mt-1 break-words text-base font-bold tabular-nums "+accent}>{money(value)}</p>
    </div>);
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={()=>setOpen(true)}
      className={dockButton
        ?"mh-insights-dock__button"
        :"mh-modal-trigger rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"}>
      <span className={dockButton?"mh-insights-dock__label":""}>{t("财务模拟器","Finance Simulator")}</span>
      <span className={dockButton?"mh-insights-dock__icon":""} aria-hidden="true">📈</span>
    </button>
    <FinanceOverlay open={open} onClose={()=>setOpen(false)} title={t("财务模拟器","Finance Simulator")}
      triggerRef={triggerRef} widthClass="max-w-5xl">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">
          {t("如果每个月多赚一点、少花一点，未来余额会怎样？",
            "What happens to your balance if you earn more or spend less each month?")}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("先选模拟时间，再调整每个月的变化；下方会直接显示两种结果。",
            "Choose a time period, adjust monthly changes, then compare the two results below.")}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">{t("第一步 · 模拟多久","Step 1 · Choose a duration")}</h3>
          <span className="text-xs text-slate-500">{t("所有数字都是每个月的变化","All changes are per month")}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("模拟月数","Simulation months")}>
          {[3,6,12,24].map(n=><button type="button" key={n} aria-pressed={duration===n}
            onClick={()=>update("months",n)}
            className={"min-h-10 rounded-xl px-4 py-2 text-sm font-semibold transition-colors "+
              (duration===n?"bg-slate-900 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200")}>
            {n} {t("个月","months")}
          </button>)}
        </div>
        <h3 className="mb-3 mt-4 text-sm font-bold text-slate-900">{t("第二步 · 假设每月变化","Step 2 · Adjust your monthly plan")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {inputCell("incomeAdjustment",t("每月多赚（RM）","Earn more / month (RM)"),true)}
          {inputCell("expenseReduction",t("每月少花（RM）","Spend less / month (RM)"),true)}
          {inputCell("extraExpense",t("每月额外多花（RM）","Spend extra / month (RM)"))}
        </div>
      </div>

      {result.error?<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{result.error}</p>
      :<>
        <section aria-label={t("模拟结果","Simulation results")} className="mt-4">
          <h3 className="mb-2 text-sm font-bold text-slate-900">{t("第三步 · 看看两种结果","Step 3 · Compare the outcomes")}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {summary(t("现在的总余额","Balance today"),v.startingBalance)}
            {summary(t("照目前习惯，"+duration+" 个月后","Keeping your pattern, after "+duration+" months"),baselineEnd)}
            {summary(t("按新计划，"+duration+" 个月后","With your plan, after "+duration+" months"),scenarioEnd,"text-teal-800")}
          </div>
          <div className={"mt-3 rounded-xl p-3 "+(difference>=0?"bg-emerald-50":"bg-rose-50")}>
            <p className="text-xs text-slate-600">{t("两种情况相差","Difference between the two plans")}</p>
            <p className={"mt-0.5 text-xl font-bold tabular-nums "+(difference>=0?"text-emerald-800":"text-rose-800")}>
              {difference>0?"+":""}{money(difference)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("这是相对于保持原本习惯，额外增加或减少的预计余额。",
                "This is the estimated extra gain or loss versus keeping your current pattern.")}
            </p>
          </div>
        </section>

        <section className="mt-4 min-w-0 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-bold text-slate-900">{t("余额变化对比","Estimated balance over time")}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t("灰线＝照目前习惯；绿线＝按新计划；横轴是月数，纵轴是 RM。",
              "Gray = current pattern; green = your plan. Horizontal: months; vertical: RM.")}
          </p>
          <div className="mt-3 h-64 min-w-0" aria-label={t("余额模拟折线图","Simulated balance line chart")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="month" fontSize={11}/>
                <YAxis width={52} fontSize={11}/>
                <Tooltip formatter={n=>money(n)}/>
                <Legend/>
                <Line name={t("照目前习惯","Current pattern")} dataKey="baseline" stroke="#64748b" dot={false} isAnimationActive={false}/>
                <Line name={t("按新计划","Your plan")} dataKey="scenario" stroke="#0d9488" strokeWidth={3} dot={false} isAnimationActive={false}/>
                {comparisons.filter(p=>p.months===duration).map((p,i)=><Line key={p.index} name={p.name}
                  dataKey={"saved"+p.index} stroke={["#c08457","#8b5cf6","#38bdf8"][i%3]}
                  strokeDasharray="4 3" dot={false} isAnimationActive={false}/>)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">{t("这些数字是怎么算出来的？","How are these numbers calculated?")}</summary>
            <p className="mt-2 leading-relaxed">
              {t("系统用最近 90 天已经记录的收支估算每月净变化（每 30 天视为一个月），再加上你调整的收入和支出。它不会考虑未记账的消费、未来账单、利息或通胀，也不能保证未来结果。",
                "It uses saved income and expenses from the past 90 days, normalized to 30-day months, then adds your monthly adjustments. Missing spending, future bills, interest and inflation are not included; the result is not guaranteed.")}
            </p>
            <p className="mt-2">{t("这段期间有效收支记录：","Recorded income/expense entries in this period: ")}{v.sampleRecords}</p>
          </details>
        </section>
      </>}

      <section className="mt-4 rounded-xl bg-slate-50 p-3 sm:p-4">
        <h3 className="text-sm font-bold">{t("如果你想额外多存一笔钱","If you want to save extra money")}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {t("相对于维持现在的习惯，你希望在 "+duration+" 个月后多留下多少？",
            "How much extra would you like to have after "+duration+" months, compared with your current pattern?")}
        </p>
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{t("目标额外储蓄（RM）","Extra savings target (RM)")}
            <input className={field} inputMode="decimal" value={goal} onChange={e=>setGoal(e.target.value)}/>
          </label>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{t("平均每个月还需要多留出","Extra needed per month")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-teal-800">{needed||t("请输入正确的金额","Enter a valid RM amount")}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t("这里是相对于原本习惯需要额外积累的金额，不是已经存进银行的钱。",
            "This is the additional amount needed compared with your old pattern, not verified bank savings.")}
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 p-3 sm:p-4">
        <h3 className="text-sm font-bold">{t("保存这个模拟方案","Save a simulation plan")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("最多三个，仅保存在这台设备，不会写入真实收支。",
          "Up to three plans, stored on this device only. No real financial records are changed.")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[150px] flex-1 text-sm">{t("方案名称","Plan name")}
            <input className={field} maxLength={50} value={form.name} onChange={e=>update("name",e.target.value)}/>
          </label>
          <button type="button" disabled={!!result.error||saved.length>=3} onClick={savePreset}
            className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {t("保存方案","Save plan")}
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {comparisons.map(p=><div key={p.index} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-2">
              <button type="button" data-i18n-ignore onClick={()=>{setForm({...p.form});setError("");}}
                className="min-w-0 truncate text-left text-sm font-bold text-slate-800">{p.name}</button>
              <button type="button" onClick={()=>removePreset(p.form.id)}
                aria-label={t("删除方案 ","Delete plan ")+p.name}
                className="rounded-lg px-3 py-1.5 text-red-700 hover:bg-red-50">×</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.months} {t("个月","months")} ·
              {t(" 每月多赚 "," + income ")}{money(Number(p.form.incomeAdjustment))} ·
              {t(" 每月少花 "," − expense ")}{money(Number(p.form.expenseReduction))}
            </p>
            <p className="mt-1 text-xs font-semibold text-teal-800">
              {t("相对变化：","Difference: ")}{p.value.finalDifference>0?"+":""}{money(p.value.finalDifference)}
            </p>
          </div>)}
          {!saved.length&&<p className="text-sm text-slate-500">{t("还没有保存方案。","No plans saved yet.")}</p>}
        </div>
      </section>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs font-semibold text-amber-800">
        {t("仅供模拟，不会新增或修改真实收入、支出、转账、预算或预计收入。",
          "SIMULATION ONLY. No real Income, Expense, Transfers, Budget or Expected Income will be saved.")}
      </p>
    </FinanceOverlay>
  </>;
}
