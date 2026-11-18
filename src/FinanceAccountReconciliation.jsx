import React,{useEffect,useMemo,useState} from "react";
import {localDateMY} from "./financeCalendar.js";
import {reconcileMethod,validateAccountChecks} from "./financeStage2.js";
import {planReconciliationTransfers} from "./financeReconciliationTransfers.js";
import {canonicalFinanceMethod} from "./financeMethodKeys.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const money=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const field="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export default function FinanceAccountReconciliation({
  balances=[],records=[],transfers=[],checks=[],onSave,onPrefillRecord,onExecuteTransfers,
  disabled=false,selectedMethod=null,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [actualByMethod,setActualByMethod]=useState({}),[note,setNote]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [focusMethod,setFocusMethod]=useState(selectedMethod||"BANK");
  useEffect(()=>{if(selectedMethod)setFocusMethod(canonicalFinanceMethod(selectedMethod));},[selectedMethod]);
  const normalizedBalances=useMemo(()=>balances.map(b=>({...b,method:canonicalFinanceMethod(b.method)})),[balances]);
  // A user must enter every method; missing inputs NEVER mean zero.
  const completed=normalizedBalances.length>0&&normalizedBalances.every(b=>Object.hasOwn(actualByMethod,b.method)&&actualByMethod[b.method].trim()!=="");
  const result=useMemo(()=>{
    if(!completed)return {plan:null,error:""};
    try{return {plan:planReconciliationTransfers(normalizedBalances,actualByMethod),error:""};}
    catch(e){return {plan:null,error:e.message};}
  },[completed,normalizedBalances,actualByMethod]);
  const plan=result.plan;
  const normalizedMethod=m=>canonicalFinanceMethod(m);
  const recent=useMemo(()=>{
    const selected=focusMethod||normalizedBalances[0]?.method;
    if(!selected)return [];
    const rows=[
      ...records.filter(r=>!r.deleted_at&&normalizedMethod(r.method)===selected)
        .map(r=>({id:"record-"+r.id,date:r.date,kind:r.type,
          amount:r.type==="income"?Number(r.amount):-Number(r.amount),note:r.note||r.category})),
      ...transfers.filter(r=>!r.deleted_at&&
          (normalizedMethod(r.fromMethod)===selected||normalizedMethod(r.toMethod)===selected))
        .map(r=>({id:"transfer-"+r.id,date:r.date,kind:"transfer",
          amount:(normalizedMethod(r.toMethod)===selected?1:-1)*Number(r.amount),note:r.note||"Transfer"})),
    ];
    return rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  },[focusMethod,normalizedBalances,records,transfers]);
  const relevant=checks.filter(c=>normalizedMethod(c.method)===focusMethod)
    .slice().sort((a,b)=>b.date.localeCompare(a.date));

  const update=(method,value)=>{
    setActualByMethod(old=>({...old,[method]:value}));
    setError("");setMessage("");
  };
  async function saveAllChecks(){
    if(disabled||busy||!plan)return;
    setBusy(true);setError("");setMessage("");
    try{
      const baseline=JSON.stringify(checks);
      const entries=plan.rows.map(r=>reconcileMethod(r.method,r.actual,r.ledger,localDateMY(),
        crypto.randomUUID(),note));
      const verified=validateAccountChecks([...checks,...entries]);
      if(!await onSave(verified,baseline))throw Error(t("保存失败，可能有其他设备更新了对账历史。请刷新再试。",
        "Saving failed. Another device may have updated reconciliation history. Refresh first."));
      setMessage(t("所有账户的本次核对快照已保存，不会自动改变账户余额。",
        "Reconciliation snapshots saved for all Methods. No balance was changed."));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function executePlan(){
    if(disabled||busy||!plan||!plan.transfers.length)return;
    const lines=plan.transfers.map(x=>x.fromMethod+" → "+x.toMethod+"  "+money(x.amount)).join("\n");
    const warning=t("确认只补记实际发生过、但账本漏记的转账？\n"+
      "系统将依次把以下转账保存到 Transfer History：\n\n",
      "Only confirm transfers that REALLY happened but were missing in your ledger.\n"+
      "The following will be added to Transfer History sequentially:\n\n");
    const tail=t("\n\n不会自动增加 Income/Expense。多笔转账不是同一个数据库事务；如中途失败，会停止并显示已完成的笔数。",
      "\n\nNo Income/Expense will be inserted. Multiple Transfers are not one database transaction; a partial failure stops further transfers.");
    if(!window.confirm(warning+lines+tail))return;
    setBusy(true);setError("");setMessage("");
    try{
      const answer=await onExecuteTransfers(plan);
      if(!answer?.completed){
        throw Error(answer?.error||t("部分转账未确认。请核对 Transfer History，刷新后重新分析剩余差额。",
          "Some transfers were not confirmed. Review Transfer History, refresh and recheck the remaining differences."));
      }
      setMessage(t("已记录 "+answer.count+" 笔转账。总资产不会因 Transfer 改变；请查看剩余差额。",
        "Saved "+answer.count+" Transfers. Total assets stay unchanged by Transfers. Review any remaining discrepancies."));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const fillResidual=(x)=>{
    if(disabled||busy)return;
    if(!window.confirm(t("剩余差额不一定是收入或支出。请核对银行流水及 Opening Balance。仅填入未保存的记账表单，由你决定是否保存。",
      "A residual is not necessarily Income or Expense. Check bank activity and Opening Balance. Only an UNSAVED form will be filled.")))return;
    onPrefillRecord({
      type:x.type,amount:String(x.amount),method:x.method,
      note:"balance",
      date:localDateMY(),
    });
  };
  return <>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold">{t("账户余额统一核对","Reconcile All Account Balances")}</h2>
      <p className="text-xs text-slate-500">
        {t("填写全部实际余额 · 确认后才补记 Transfer",
          "Enter all actual balances · Confirm to record Transfers")}
      </p>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {normalizedBalances.map(b=>{
        const complete=Object.hasOwn(actualByMethod,b.method)&&actualByMethod[b.method].trim()!=="";
        const diff=plan?.rows.find(row=>row.method===b.method)?.difference;
        return <div key={b.method} className={"min-w-0 rounded-xl border px-3 py-2 "+
          (focusMethod===b.method?"border-teal-300 bg-teal-50/40":"border-slate-200 bg-slate-50/50")}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <button type="button" onClick={()=>setFocusMethod(b.method)}
              aria-label={t("查看账户活动：","View account activity: ")+b.method}
              className="min-h-8 text-left text-sm font-extrabold text-slate-900" data-i18n-ignore>{b.method}</button>
            <span className="min-w-0 break-words text-right text-xs text-slate-600">
              {t("账本","Ledger")}：<b className="tabular-nums">{money(b.balance)}</b>
            </span>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            {t("实际余额（RM）","Actual balance (RM)")}
            <input value={actualByMethod[b.method]??""} onChange={e=>update(b.method,e.target.value)}
              className={"mt-1 "+field} type="text" inputMode="decimal"
              aria-label={b.method+" "+t("实际余额","actual balance")}/>
          </label>
          {complete&&plan&&<p className={"mt-1 text-xs font-semibold "+
            (diff===0?"text-emerald-700":"text-amber-800")}>
            {t("差额","Difference")}：{diff>0?"+":""}{money(diff)}
          </p>}
        </div>;
      })}
    </div>
    {!completed&&<p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {t("请填完全部 "+normalizedBalances.length+" 个 Method，空格不会自动视为 RM0。",
        "Enter all "+normalizedBalances.length+" Methods. Blank is never treated as RM0.")}
    </p>}
    {result.error&&<p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{result.error}</p>}
    {plan&&<section className="mt-3 rounded-xl border border-slate-200 p-3">
      <h3 className="font-bold">{t("自动匹配建议","Automatic Matching Proposal")}</h3>
      <p className="mt-1 text-xs text-slate-600">
        {t("正差额＝该账户实际比账本多，需要补记流入；负差额＝实际比账本少，需要补记流出。只有真实发生过的转账才能确认。",
          "Positive difference needs an incoming ledger Transfer; negative difference needs an outgoing one. Confirm only transfers that actually happened.")}
      </p>
      {plan.transfers.length>0?<div className="mt-3 space-y-2">
        {plan.transfers.map((row,i)=><div key={i}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal-50 p-3">
          <b className="text-sm text-teal-900" data-i18n-ignore>{row.fromMethod} → {row.toMethod}</b>
          <b className="text-sm tabular-nums text-teal-800">{money(row.amount)}</b>
        </div>)}
      </div>:<p className="mt-3 text-sm text-slate-500">{t("目前没有需要补记的账户间转账。",
        "No missing transfers to match.")}</p>}
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
        <b>{t("实际总资产 − 账本总资产","Actual total − ledger total")}</b>
        <p className="mt-1 text-lg font-bold tabular-nums">{plan.difference>0?"+":""}{money(plan.difference)}</p>
        <p className="mt-1 text-xs text-slate-600">{t("内部 Transfer 不改变这笔总差额。",
          "Transfers between Methods cannot change this overall discrepancy.")}</p>
      </div>
      <div className="mt-3 space-y-2">
        {plan.remainders.map(x=><div key={x.method}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold" data-i18n-ignore>{x.method} · {money(x.amount)}</p>
            <p className="text-xs text-amber-900">{x.type==="income"
              ?t("仍有多余余额：核对收入、初始余额或遗漏记录。","Surplus: check Income, opening balances or missing entries.")
              :t("仍有不足余额：核对支出、初始余额或遗漏记录。","Shortfall: check Expenses, opening balances or missing entries.")}</p>
          </div>
          <button type="button" disabled={disabled||busy} onClick={()=>fillResidual(x)}
            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold">
            {x.type==="income"?t("填入收入","Fill Income"):t("填入支出","Fill Expense")}
          </button>
        </div>)}
      </div>
      {plan.transfers.length>0&&<button type="button" onClick={executePlan}
        disabled={busy||disabled} className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy?t("执行中…","Processing…"):t("✓ 核对并执行建议转账","✓ Confirm & Record Suggested Transfers")}
      </button>}
      <p className="mt-2 text-xs text-amber-800">
        {t("如并没有发生这些转账，就不要执行；系统不能仅靠余额差额证明实际转账。",
          "Do not execute if these transfers never happened. Balance differences alone cannot prove that they did.")}
      </p>
    </section>}
    <div className="mt-3 flex flex-col items-stretch gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-xs">{t("本次核对备注（可选）","Reconciliation note (optional)")}
        <input className={"mt-1 "+field} maxLength={240} value={note}
          onChange={e=>setNote(e.target.value)}/>
      </label>
      <button type="button" onClick={saveAllChecks} disabled={busy||disabled||!plan}
        className="min-h-10 shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {t("保存全部余额核对记录","Save All Reconciliation Snapshots")}
      </button>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    <div className="mt-3 grid gap-2">
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-bold">
          {t("近期活动","Recent Activity")} · <span data-i18n-ignore>{focusMethod}</span>
        </summary>
        <div className="mt-2 max-h-44 space-y-2 overflow-auto">
          {recent.map(row=><div key={row.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <div className="min-w-0"><b>{row.date} · {row.kind}</b>
              <p className="break-words text-slate-500" data-i18n-ignore>{row.note}</p></div>
            <b className={(row.amount>=0?"text-emerald-700":"text-red-700")+" tabular-nums"}>
              {row.amount>0?"+":""}{money(row.amount)}</b>
          </div>)}
          {!recent.length&&<p className="text-xs text-slate-500">{t("没有相关记录。","No related records.")}</p>}
        </div>
      </details>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-bold">
          {t("历史对账","Reconciliation History")} · <span data-i18n-ignore>{focusMethod}</span>
        </summary>
        <div className="mt-2 max-h-44 space-y-2 overflow-auto">
          {relevant.slice(0,20).map(c=><div key={c.id} className="rounded-lg bg-slate-50 p-2 text-xs">
            <b>{c.date} · {t("差额","Difference")} {money(c.difference)}</b>
            <p className="mt-1 text-slate-600">{t("账本","Ledger")} {money(c.ledger)} · {t("实际","Actual")} {money(c.actual)}</p>
            {c.note&&<p data-i18n-ignore className="mt-1 text-slate-500">{c.note}</p>}
          </div>)}
          {!relevant.length&&<p className="text-xs text-slate-500">{t("尚无对账历史。","No reconciliation history yet.")}</p>}
        </div>
      </details>
    </div>
  </>;
}
