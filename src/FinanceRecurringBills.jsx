import React,{useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {localDateMY,shiftCalendarDay} from "./financeCalendar.js";
import {billOccurrences,validateBills,withBillOccurrence} from "./financeStage2.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const fmt=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const blank=()=>({title:"",amount:"",category:"饮食",method:"TNG",anchorDate:localDateMY(),
  cycle:"monthly",leadDays:3,active:true,occurrences:[]});
export default function FinanceRecurringBills({
  bills=[],records=[],categories=[],methods=[],onSave,onPrefillExpense,disabled=false,
  open=false,onClose=()=>{},selectedBillId=null,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const t=(cn,en)=>zh?cn:en;
  const [editing,setEditing]=useState(null),[draft,setDraft]=useState(blank);
  const [base,setBase]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [linkDue,setLinkDue]=useState(null),[chosenExpense,setChosenExpense]=useState("");
  const today=localDateMY();
  const events=useMemo(()=>billOccurrences(bills,today,records,70,40),[bills,today,records]);
  const pending=events.filter(e=>e.visible).sort((a,b)=>a.due.localeCompare(b.due));
  const selected=events.filter(e=>!selectedBillId||e.billId===selectedBillId);
  const candidates=useMemo(()=>{
    if(!linkDue)return [];
    const from=shiftCalendarDay(linkDue.due,-35),to=shiftCalendarDay(linkDue.due,35);
    return records.filter(r=>r.type==="expense"&&!r.deleted_at&&r.method===linkDue.method&&r.date>=from&&r.date<=to)
      .sort((a,b)=>Math.abs(Number(a.amount)-linkDue.amount)-Math.abs(Number(b.amount)-linkDue.amount))
      .slice(0,80);
  },[records,linkDue]);
  const start=(bill=null)=>{
    setError("");setLinkDue(null);
    setBase(JSON.stringify(bills));
    setDraft(bill?{...bill,amount:String(bill.amount)}:blank());
    setEditing(bill?.id||"new");
  };
  async function saveList(next,baseline){
    if(busy||disabled)return false;
    setBusy(true);setError("");
    try{
      if(JSON.stringify(bills)!==baseline)throw Error(t("另一台设备已更新账单，请刷新后再试。","Bills changed on another device. Refresh before retrying."));
      const valid=validateBills(next);
      if(!await onSave(valid,baseline))throw Error(t("未确认云端保存。请刷新账单后再操作。","Cloud save was not confirmed. Refresh and review."));
      return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function submit(e){
    e.preventDefault();
    const id=editing==="new"?crypto.randomUUID():editing;
    const next=editing==="new"?[...bills,{...draft,id}]:bills.map(b=>b.id===id?{...draft,id}:b);
    try{if(await saveList(next,base))setEditing(null);}catch(e){setError(e.message);}
  }
  async function remove(bill){
    if(!window.confirm(t("只删除这条账单计划？不会删除任何 Expense。","Delete only this bill plan? No Expense is deleted.")))return;
    if(await saveList(bills.filter(b=>b.id!==bill.id),JSON.stringify(bills)))setEditing(null);
  }
  async function act(event,change){
    const next=withBillOccurrence(bills,event.billId,event.due,change);
    if(await saveList(next,JSON.stringify(bills))){setLinkDue(null);setChosenExpense("");}
  }
  async function markPaid(){
    const expense=candidates.find(r=>String(r.id)===chosenExpense);
    if(!expense){setError(t("必须选择已经存在的支出记录，不能凭空确认付款。","Select a real saved Expense before confirming payment."));return;}
    if(!window.confirm(t("确认将该账单关联这笔已保存的支出？不会再次新增 Expense。","Link this already-saved Expense to the bill? No duplicate transaction will be created.")))return;
    await act(linkDue,{status:"paid",recordId:String(expense.id)});
  }
  return <>
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-bold">{t("固定账单与提醒","Recurring Bills & Reminders")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("只提醒及追踪；付款必须由现有真实支出记录确认，不会自动扣款。","Track due dates only. A saved Expense is required to mark paid; no automatic charge.")}</p></div>
      <button type="button" onClick={()=>start()} disabled={disabled||busy||bills.length>=40}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {t("＋ 新增账单","+ New Bill")}
      </button>
    </header>
    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
      {t("待处理提醒","Alerts requiring attention")}：<b>{pending.length}</b>　·　
      {t("有效计划","Active plans")}：<b>{bills.filter(b=>b.active).length}</b>
    </div>
    {error&&<p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-3 space-y-3">
      {selected.map(e=><article key={e.id} className={"rounded-xl border p-3 "+(e.visible?"border-amber-200 bg-amber-50/40":"border-slate-200 bg-white")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><b className="break-words" data-i18n-ignore>{e.title}</b>
            <p className="mt-1 text-xs text-slate-500">{e.due} · {e.category} · {e.method}</p>
            <p className="mt-1 text-sm font-semibold">{fmt(e.amount)}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
            {e.status==="paid"?t("已关联支出","Paid / linked"):e.status==="skipped"?t("本期已跳过","Skipped"):
              e.status==="snoozed"?t("已稍后提醒","Snoozed"):e.status==="unlinked"?t("原付款记录已失效","Linked expense missing"):
              e.phase==="overdue"?t("已逾期","Overdue"):e.phase==="today"?t("今天到期","Due today"):t("即将到期","Upcoming")}
          </span>
        </div>
        {e.status!=="paid"&&e.status!=="skipped"&&<div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={()=>{setLinkDue(e);setChosenExpense("");setError("");}}
            className="min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">
            {t("确认已付 / 关联支出","Mark paid / Link Expense")}
          </button>
          <button type="button" disabled={busy} onClick={()=>onPrefillExpense({type:"expense",amount:String(e.amount),
            category:e.category,method:e.method,note:e.title,date:today})}
            className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold">
            {t("填入支出表单","Fill Expense form")}
          </button>
          <button type="button" disabled={busy} onClick={()=>act(e,{status:"snoozed",remindOn:shiftCalendarDay(today,1)})}
            className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold">{t("明天再提醒","Remind tomorrow")}</button>
          <button type="button" disabled={busy} onClick={()=>act(e,{status:"skipped"})}
            className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600">{t("跳过本期","Skip this occurrence")}</button>
        </div>}
        {e.status==="paid"&&<p className="mt-2 text-xs text-emerald-700">{t("已关联 Expense ID：","Linked Expense ID: ")}{e.linkedRecordId}</p>}
      </article>)}
      {!selected.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t("当前范围内没有到期账单。","No bill occurrences in this date range.")}</p>}
    </div>
    <h3 className="mb-2 mt-5 font-bold">{t("所有账单计划","Bill plans")}</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      {bills.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
        <div className="min-w-0"><b data-i18n-ignore>{b.title}</b><p className="text-xs text-slate-500">{fmt(b.amount)} · {b.cycle} · {b.anchorDate}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={()=>start(b)} className="rounded-lg border px-3 py-2 text-xs font-bold">{t("编辑","Edit")}</button>
          <button type="button" onClick={()=>remove(b)} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700">{t("删除","Delete")}</button>
        </div>
      </div>)}
    </div>
    <FinanceOverlay open={!!editing} onClose={()=>{if(!busy)setEditing(null);}}
      title={t(editing==="new"?"新增固定账单":"编辑固定账单",editing==="new"?"Add Recurring Bill":"Edit Recurring Bill")}
      widthClass="max-w-xl">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">{t("账单名称","Bill name")}
          <input required maxLength={90} className={field} value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label>
        <label className="text-sm">{t("预计金额（RM）","Estimated amount (RM)")}
          <input required inputMode="decimal" className={field} value={draft.amount} onChange={e=>setDraft(v=>({...v,amount:e.target.value}))}/></label>
        <label className="text-sm">{t("首次到期日","First due date")}
          <input required type="date" className={field} value={draft.anchorDate} onChange={e=>setDraft(v=>({...v,anchorDate:e.target.value}))}/></label>
        <label className="text-sm">{t("重复周期","Cycle")}
          <select className={field} value={draft.cycle} onChange={e=>setDraft(v=>({...v,cycle:e.target.value}))}>
            {["weekly","monthly","quarterly","yearly"].map(c=><option key={c} value={c}>{{
              weekly:t("每周","Weekly"),monthly:t("每月","Monthly"),
              quarterly:t("每三个月","Quarterly"),yearly:t("每年","Yearly")}[c]}</option>)}
          </select></label>
        <label className="text-sm">{t("提前提醒天数（0–30）","Days before due (0–30)")}
          <input className={field} type="number" min={0} max={30} value={draft.leadDays} onChange={e=>setDraft(v=>({...v,leadDays:Number(e.target.value)}))}/></label>
        <label className="text-sm">{t("分类","Category")}
          <select className={field} value={draft.category} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">{t("付款方式","Method")}
          <select className={field} value={draft.method} onChange={e=>setDraft(v=>({...v,method:e.target.value}))}>{methods.map(m=><option key={m}>{m}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={draft.active} onChange={e=>setDraft(v=>({...v,active:e.target.checked}))}/>
          {t("启用提醒","Enable reminders")}</label>
        <div className="sm:col-span-2">
          {error&&<p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
          <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy?t("保存中…","Saving…"):t("保存账单计划","Save bill plan")}
          </button>
        </div>
      </form>
    </FinanceOverlay>
    <FinanceOverlay open={!!linkDue} onClose={()=>{if(!busy)setLinkDue(null);}}
      title={t("确认账单付款","Confirm bill payment")} widthClass="max-w-lg">
      {linkDue&&<div>
        <p className="text-sm">{t("请选择已经保存的支出记录。选择后仅关联这笔交易，不会新增、修改或扣除第二笔钱。","Choose a saved Expense. Linking never inserts or charges another payment.")}</p>
        <p className="mt-2 font-semibold" data-i18n-ignore>{linkDue.title} · {fmt(linkDue.amount)}</p>
        <label className="mt-3 block text-sm">{t("已有 Expense","Existing Expense")}
          <select value={chosenExpense} className={field} onChange={e=>setChosenExpense(e.target.value)}>
            <option value="">{t("选择一笔已存在的支出","Select an existing Expense")}</option>
            {candidates.map(r=><option key={r.id} value={String(r.id)}>
              {r.date} · {fmt(r.amount)} · {r.category} · {r.note||"—"} · {String(r.id).slice(0,8)}
            </option>)}
          </select>
        </label>
        {!candidates.length&&<p className="mt-2 text-sm text-amber-700">{t("没有对应付款记录。请先填入并手动保存一笔 Expense，然后回来关联。","No matching method/date Expense. Fill and save a real Expense first, then return to link it.")}</p>}
        <button disabled={!chosenExpense||busy} onClick={markPaid} className="mt-3 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {t("确认已付（只关联）","Confirm paid (link only)")}</button>
        {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>}
    </FinanceOverlay>
  </>;
}
