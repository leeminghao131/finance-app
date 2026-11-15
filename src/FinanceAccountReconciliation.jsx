import React,{useEffect,useMemo,useState} from "react";
import {localDateMY} from "./financeCalendar.js";
import {reconcileMethod,validateAccountChecks} from "./financeStage2.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const money=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const norm=value=>{
  const raw=String(value||"").trim(),upper=raw.toUpperCase();
  if(["BANK IN","ONLINE BANK IN","DEBIT CARD"].includes(upper))return "BANK";
  return raw;
};
export default function FinanceAccountReconciliation({
  balances=[],records=[],transfers=[],checks=[],onSave,onPrefillRecord,
  disabled=false,selectedMethod=null,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [method,setMethod]=useState(selectedMethod||"BANK"),[actual,setActual]=useState("");
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    if(selectedMethod){
      setMethod(selectedMethod);
      setActual("");setError("");setMessage("");
    }
  },[selectedMethod]);
  const selected=balances.find(x=>x.method===method)||balances[0];
  const expected=Number(selected?.balance||0);
  const amount=actual.trim()===""?null:Number(actual);
  const validActual=actual.trim()!==""&&/^-?\d+(?:\.\d{1,2})?$/.test(actual.trim())
    &&Number.isFinite(amount)&&Number.isSafeInteger(Math.round(amount*100));
  const difference=validActual?Math.round((amount-expected)*100)/100:null;
  const recent=useMemo(()=>{
    if(!selected)return [];
    const rows=[
      ...records.filter(r=>!r.deleted_at&&norm(r.method)===selected.method)
        .map(r=>({id:"record-"+r.id,date:r.date,kind:r.type,
          amount:r.type==="income"?Number(r.amount):-Number(r.amount),note:r.note||r.category})),
      ...transfers.filter(r=>!r.deleted_at&&(norm(r.fromMethod)===selected.method||norm(r.toMethod)===selected.method))
        .map(r=>({id:"transfer-"+r.id,date:r.date,kind:"transfer",
          amount:(norm(r.toMethod)===selected.method?1:-1)*Number(r.amount),note:r.note||"Transfer"})),
    ];
    return rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  },[selected,records,transfers]);
  const relevant=checks.filter(c=>!selected||c.method===selected.method)
    .slice().sort((a,b)=>b.date.localeCompare(a.date));
  async function saveCheck(){
    if(disabled||busy||!selected)return;
    setError("");setMessage("");setBusy(true);
    try{
      if(!validActual)throw Error(t("请输入真实账户余额，保留最多两位小数。","Enter actual account balance with at most two decimals."));
      const baseline=JSON.stringify(checks);
      const next=validateAccountChecks([...checks,reconcileMethod(selected.method,actual,expected,localDateMY(),crypto.randomUUID(),note)]);
      if(!await onSave(next,baseline))throw Error(t("保存失败或其他设备已更新，请刷新后再试。","Saving failed or another device updated settings. Refresh first."));
      setMessage(t("对账记录已保存。真实财务交易及初始余额保持不变。","Reconciliation saved. No transaction or opening balance changed."));
      setActual("");setNote("");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const fill=(type)=>{
    if(difference===null||difference===0)return;
    if(!window.confirm(t("这只会填入一张待保存的记账表单。请核对原因后自行决定是否保存；不会自动改余额。",
      "This only fills an unsaved transaction form. Verify the cause before deciding to save. No automatic correction.")))return;
    onPrefillRecord({
      type,amount:String(Math.abs(difference)),method:selected.method,
      note:t("账户对账差额（请确认原因）","Reconciliation difference (verify reason)"),date:localDateMY(),
    });
  };
  return <>
    <div><h2 className="text-lg font-bold">{t("账户余额对账","Account Balance Reconciliation")}</h2>
      <p className="mt-1 text-xs text-slate-500">{t("人工输入账户上实际看到的余额，与账本余额比较；绝不会自动改初始余额、转账或记录。",
        "Enter the real Method balance and compare it with your ledger. This never auto-changes opening balances, Transfers or records.")}</p></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {balances.map(b=><button key={b.method} type="button"
        onClick={()=>{setMethod(b.method);setActual("");setError("");setMessage("");}}
        className={"rounded-xl border p-3 text-left transition-colors "+
        (selected?.method===b.method?"border-slate-900 bg-slate-900 text-white":"border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400")}>
        <b data-i18n-ignore>{b.method}</b><p className="mt-2 text-sm font-bold tabular-nums">{money(b.balance)}</p>
      </button>)}
    </div>
    {selected&&<section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="text-sm font-bold" data-i18n-ignore>{selected.method}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t("账本计算余额","Ledger-calculated balance")}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(expected)}</p>
        </div>
        <label className="text-sm">{t("实际账户余额（RM）","Actual Method balance (RM)")}
          <input className={field} value={actual} inputMode="decimal" placeholder="0.00"
            onChange={e=>setActual(e.target.value)}/>
        </label>
      </div>
      {actual.trim()!==""&&<p role="status" className={"mt-3 rounded-xl p-3 text-sm font-semibold "+
        (!validActual?"bg-red-50 text-red-700":Math.abs(difference)>0.005?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-700")}>
        {!validActual?t("金额格式不正确","Invalid amount"):
          t("差额（实际 − 账本）：","Difference (actual − ledger): ")+money(difference)}
      </p>}
      <label className="mt-3 block text-sm">{t("核对备注（可选）","Reconciliation note (optional)")}
        <input className={field} maxLength={240} value={note} onChange={e=>setNote(e.target.value)}
          placeholder={t("例如：核对银行 App 当前余额","For example, checked balance in banking app")}/>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={saveCheck} disabled={!validActual||busy||disabled}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {t("保存本次核对","Save this check")}</button>
        {validActual&&Math.abs(difference)>0.005&&<>
          <button type="button" onClick={()=>fill("expense")}
            className="rounded-xl border border-slate-300 px-3 py-3 text-sm">{t("补记支出表单","Fill Expense form")}</button>
          <button type="button" onClick={()=>fill("income")}
            className="rounded-xl border border-slate-300 px-3 py-3 text-sm">{t("补记收入表单","Fill Income form")}</button>
        </>}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t("余额差额不一定属于收入或支出，也可能是遗漏转账、账户费用或尚未记录的项目。请先核对原因。",
          "A difference may be a missing Transfer, bank fee or other issue, not necessarily an Income or Expense. Investigate before entering records.")}
      </p>
      {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {message&&<p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
    </section>}
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 p-3">
        <h3 className="font-bold">{t("最近交易与转账","Recent transactions and Transfers")}</h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {recent.map(row=><div key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <div className="min-w-0"><b>{row.date} · {row.kind}</b><p className="break-words text-slate-500" data-i18n-ignore>{row.note}</p></div>
            <b className={(row.amount>=0?"text-emerald-700":"text-red-700")+" shrink-0 tabular-nums"}>{row.amount>=0?"+":""}{money(row.amount)}</b>
          </div>)}
          {!recent.length&&<p className="text-sm text-slate-500">{t("没有相关记录。","No related transactions.")}</p>}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 p-3">
        <h3 className="font-bold">{t("历史对账记录","Reconciliation history")}</h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {relevant.slice(0,30).map(c=><div key={c.id} className="rounded-lg bg-slate-50 p-2 text-xs">
            <div className="flex justify-between gap-2"><b>{c.date}</b><b>{t("差额 ","Difference ")}{money(c.difference)}</b></div>
            <p className="mt-1 text-slate-600">{t("账本 ","Ledger ")}{money(c.ledger)} · {t("实际 ","Actual ")}{money(c.actual)}</p>
            {c.note&&<p data-i18n-ignore className="mt-1 text-slate-500">{c.note}</p>}
          </div>)}
          {!relevant.length&&<p className="text-sm text-slate-500">{t("尚无对账历史。","No reconciliation history yet.")}</p>}
        </div>
      </section>
    </div>
  </>;
}
