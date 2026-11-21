import React,{useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {localDateMY,shiftCalendarDay,calendarMonthDays} from "./financeCalendar.js";
import {billOccurrences,validateBills,withBillOccurrence} from "./financeStage2.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {canonicalFinanceMethod} from "./financeMethodKeys.js";
import {builtInFinanceCategory} from "./financeLanguage.js";

const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const fmt=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const blank=()=>({title:"",amount:"",category:"饮食",method:"TNG",anchorDate:localDateMY(),
  cycle:"monthly",leadDays:0,active:true,occurrences:[]});
export default function FinanceRecurringBills({
  bills=[],records=[],categories=[],methods=[],onSave,onConfirmPayment,disabled=false,
  selectedBillId=null,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const t=(cn,en)=>zh?cn:en;
  const categoryLabel=value=>["饮食","教育","住房","日用","交通","娱乐","运动","医疗","美容"].includes(value)
    ? builtInFinanceCategory(value,language) : value;
  const methodLabel=value=>value==="CASH"?t("现金","Cash"):
    value==="BANK"?t("银行账户","Bank"):
    value==="GRAB PAY"?"GrabPay":value;
  const billError=message=>{
    const source=String(message||"");
    if(source.includes("Category or Method is no longer available"))
      return t("账单原本保存的是中文付款名称，或分类/付款方式已经被删除。现在会自动兼容内置的中文付款名称；如果是已删除的自定义选项，请编辑账单计划。",
        "The bill Category or Method is no longer available. Built-in translated Method labels are supported; edit any deleted custom option.");
    if(source.includes("Bill payment not confirmed")||source.includes("database did not acknowledge"))
      return t("付款状态尚未确认，请先刷新交易记录，确认是否已经保存，再安全重试。",
        "Bill payment not confirmed. Refresh transaction history before retrying.");
    if(source.includes("Recycle Bin"))return t("原来的账单支出已在回收站，请先查看并恢复，不会重复新增。",
      "Original bill Expense is in Recycle Bin. Restore/review it; no duplicate Expense will be created.");
    return source;
  };
  const cycleLabel=cycle=>({
    weekly:t("每周","Weekly"),monthly:t("每月","Monthly"),
    quarterly:t("每三个月","Quarterly"),yearly:t("每年","Yearly"),
  })[cycle]||cycle;
  const [editing,setEditing]=useState(null),[draft,setDraft]=useState(blank);
  const [base,setBase]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [paymentMessage,setPaymentMessage]=useState("");
  const [activeTab,setActiveTab]=useState("pending");
  const paymentPendingRef=useRef(false);
  const today=localDateMY();
  const [calendarMonth,setCalendarMonth]=useState(today.slice(0,7));
  const [calendarDate,setCalendarDate]=useState(today);
  const events=useMemo(()=>billOccurrences(bills,today,records,70,40),[bills,today,records]);
  const pending=events.filter(e=>e.visible).sort((a,b)=>a.due.localeCompare(b.due));
  const calendarEvents=useMemo(()=>{
    const start=calendarMonth+"-01";
    return billOccurrences(bills,start,records,0,calendarMonthDays(calendarMonth)-1);
  },[bills,records,calendarMonth]);
  const firstWeekDay=new Date(calendarMonth+"-01T00:00:00Z").getUTCDay();
  const calendarCells=[...Array(firstWeekDay).fill(null),
    ...Array.from({length:calendarMonthDays(calendarMonth)},(_,i)=>
      calendarMonth+"-"+String(i+1).padStart(2,"0"))];
  const chosenDayBills=calendarEvents.filter(e=>e.due===calendarDate);
  const selected=events.filter(e=>!selectedBillId||e.billId===selectedBillId);
  // Showing future bills in the workspace does not advance their actual
  // notification lead date; alerts still use e.visible unchanged.
  const nextTwoWeeks=shiftCalendarDay(today,14);
  const dueItems=selected.filter(e=>e.status!=="paid"&&e.status!=="skipped"&&
    (e.visible||(e.due>=today&&e.due<=nextTwoWeeks)));
  const finishedItems=selected.filter(e=>e.status==="paid"||e.status==="skipped");
  const start=(bill=null)=>{
    setError("");setPaymentMessage("");
    setBase(JSON.stringify(bills));
    setDraft(bill?{...bill,amount:String(bill.amount),method:canonicalFinanceMethod(bill.method)}:blank());
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
    const next=editing==="new"?[...bills,{...draft,id,method:canonicalFinanceMethod(draft.method)}]:bills.map(b=>b.id===id?{...draft,id,method:canonicalFinanceMethod(draft.method)}:b);
    try{if(await saveList(next,base))setEditing(null);}catch(e){setError(e.message);}
  }
  async function remove(bill){
    if(!window.confirm(t("只删除这条账单计划？不会删除任何 Expense。","Delete only this bill plan? No Expense is deleted.")))return;
    if(await saveList(bills.filter(b=>b.id!==bill.id),JSON.stringify(bills)))setEditing(null);
  }
  async function act(event,change){
    const next=withBillOccurrence(bills,event.billId,event.due,change);
    await saveList(next,JSON.stringify(bills));
  }
  async function markPaid(event){
    if(paymentPendingRef.current||disabled||busy)return;
    paymentPendingRef.current=true;
    setBusy(true);setError("");setPaymentMessage("");
    try{
      const result=await onConfirmPayment({billId:event.billId,due:event.due});
      if(result?.completed){
        setPaymentMessage(t("已自动新增一笔支出并确认本期已付（重复操作不会再新增）。",
          "Expense saved and this bill marked paid. Repeated clicks cannot create another Expense."));
      }else if(result?.recordSaved){
        setError(t("支出已写入云端，但账单状态还未同步完成。请刷新后再按确认，系统只会关联原本这笔支出，不会再次扣款。",
          "Expense is saved, but bill status was not confirmed. Refresh and confirm again to link the SAME Expense safely."));
      }else throw Error(result?.error||t("付款未确认，请先核对交易记录，刷新后再重试。",
        "Payment not confirmed. Check records and refresh before retrying."));
    }catch(error){setError(billError(error.message||String(error)));}
    finally{setBusy(false);paymentPendingRef.current=false;}
  }
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={()=>start()} disabled={disabled||busy||bills.length>=40}
        className="min-h-10 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
        {t("＋ 新增账单","+ New Bill")}
      </button>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <span>{t("待处理提醒","Pending alerts")}：<b>{pending.length}</b></span>
      <span>{t("有效计划","Active plans")}：<b>{bills.filter(b=>b.active).length}</b></span>
    </div>
    {error&&<p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {paymentMessage&&<p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{paymentMessage}</p>}

    <div role="tablist" aria-label={t("固定账单页面","Recurring bill pages")}
      className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      <button type="button" role="tab" aria-selected={activeTab==="pending"}
        onClick={()=>setActiveTab("pending")}
        className={"min-h-10 rounded-lg px-3 py-2 text-sm font-bold transition-colors "+
          (activeTab==="pending"?"bg-white text-slate-900 shadow-sm":"text-slate-600 hover:bg-white/60")}>
        {t("待处理","To Pay")} ({dueItems.length})
      </button>
      <button type="button" role="tab" aria-selected={activeTab==="plans"}
        onClick={()=>setActiveTab("plans")}
        className={"min-h-10 rounded-lg px-3 py-2 text-sm font-bold transition-colors "+
          (activeTab==="plans"?"bg-white text-slate-900 shadow-sm":"text-slate-600 hover:bg-white/60")}>
        {t("账单计划","Bill Plans")} ({bills.length})
      </button>
    </div>
    {activeTab==="pending"&&<section role="tabpanel" className="mt-3 space-y-2">
    <details className="rounded-xl border border-slate-200 bg-white p-2.5">
      <summary className="cursor-pointer text-sm font-bold">{t("🗓️ 查看账单日历","🗓️ Bill Calendar")}</summary>
      <label className="mt-3 block text-xs text-slate-600">{t("查看月份","Select month")}
        <input type="month" value={calendarMonth} className={field} onChange={e=>{
          if(!e.target.value)return;
          setCalendarMonth(e.target.value);
          setCalendarDate(e.target.value+"-01");
        }}/>
      </label>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {(zh?["日","一","二","三","四","五","六"]:["Su","Mo","Tu","We","Th","Fr","Sa"])
          .map((name,i)=><b key={i} className="py-2">{name}</b>)}
        {calendarCells.map((date,i)=>date?
          <button type="button" key={date} onClick={()=>setCalendarDate(date)}
            aria-pressed={calendarDate===date}
            className={"min-h-12 rounded-lg px-1 py-1 text-xs "+(calendarDate===date?
              "bg-slate-900 font-bold text-white":calendarEvents.some(e=>e.due===date)?"bg-amber-100 text-amber-900":"bg-slate-50 text-slate-600")}>
            <span>{Number(date.slice(8))}</span>
            {calendarEvents.some(e=>e.due===date)&&<span className="block text-[10px]">● {calendarEvents.filter(e=>e.due===date).length}</span>}
          </button>:
          <div key={"blank-"+i} aria-hidden="true"/>)}
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
        <b>{calendarDate} · {chosenDayBills.length} {t("笔计划账单","scheduled bills")}</b>
        {chosenDayBills.map(e=><p key={e.id} className="mt-1 break-words" data-i18n-ignore>
          {e.title} · {fmt(e.amount)} · {methodLabel(e.method)}
        </p>)}
      </div>
    </details>

      <div className="max-h-[48dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {dueItems.map(e=><article key={e.id} className={"rounded-xl border px-3 py-2.5 "+
          (e.visible?"border-amber-200 bg-amber-50/40":"border-slate-200 bg-white")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="break-words text-sm" data-i18n-ignore>{e.title}</b>
                <b className="text-sm tabular-nums text-slate-900">{fmt(e.amount)}</b>
              </div>
              <p className="mt-0.5 break-words text-xs text-slate-500">{e.due} · {categoryLabel(e.category)} · {methodLabel(e.method)}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
              {e.status==="snoozed"?t("已稍后提醒","Snoozed"):
                e.status==="unlinked"?t("原付款记录已失效","Linked expense missing"):
                e.phase==="overdue"?t("已逾期","Overdue"):e.phase==="today"?t("今天到期","Due today"):t("即将到期","Upcoming")}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {e.status!=="unlinked"&&<button type="button" disabled={busy||disabled} onClick={()=>markPaid(e)}
              title={t("确认付款会新增一笔真实支出，请仅在已经支付后操作。","Confirming a payment adds one real Expense. Confirm only bills already paid.")}
              className="min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {busy?t("保存中…","Saving…"):t("✓ 确认已付并自动记账","✓ Confirm paid & add Expense")}
            </button>}
            {e.status==="unlinked"&&<p className="w-full text-xs font-semibold text-amber-800">
              {t("原本的 Expense 已失效，请先检查回收站；不会自动再新增。",
                "The linked Expense is missing/deleted. Check Recycle Bin; no duplicate will be created.")}
            </p>}
            <button type="button" disabled={busy||disabled}
              onClick={()=>act(e,{status:"snoozed",remindOn:shiftCalendarDay(today,1)})}
              className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold">
              {t("明天再提醒","Remind tomorrow")}
            </button>
            <button type="button" disabled={busy||disabled}
              onClick={()=>act(e,{status:"skipped"})}
              className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600">
              {t("跳过本期","Skip this occurrence")}
            </button>
          </div>
        </article>)}
        {!dueItems.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {t("没有逾期或未来14天内待处理的账单。","No overdue or upcoming bills within the next 14 days.")}
        </p>}
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-2.5">
        <summary className="cursor-pointer text-sm font-semibold">
          {t("已付 / 已跳过记录","Paid / Skipped")} ({finishedItems.length})
        </summary>
        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {finishedItems.map(e=><div key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <div className="min-w-0">
              <b data-i18n-ignore className="break-words">{e.title}</b>
              <p className="text-slate-500">{e.due} · {methodLabel(e.method)} · {fmt(e.amount)}</p>
              {e.status==="paid"&&<p className="break-all text-emerald-700">
                {t("真实支出记录 ID：","Expense record ID: ")}{e.linkedRecordId}
              </p>}
            </div>
            <span className="font-semibold">{e.status==="paid"?t("已付并记账","Paid / recorded"):t("本期已跳过","Skipped")}</span>
          </div>)}
          {!finishedItems.length&&<p className="text-xs text-slate-500">
            {t("暂无已完成项目。","No completed occurrences.")}
          </p>}
        </div>
      </details>
    </section>}
    {activeTab==="plans"&&<section role="tabpanel" className="mt-3">
      <div className="grid max-h-[64dvh] gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
        {bills.map(b=><div key={b.id}
          className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <b className="break-words text-sm" data-i18n-ignore>{b.title}</b>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{fmt(b.amount)}</p>
              <p className="mt-0.5 break-words text-xs text-slate-500">
                {cycleLabel(b.cycle)} · {b.anchorDate} · {b.leadDays} {t("天前提醒","days ahead")}
                {!b.active&&" · "+t("已停用","Inactive")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={busy||disabled} onClick={()=>start(b)}
                className="min-h-10 rounded-lg border bg-white px-3 py-2 text-xs font-bold">{t("编辑","Edit")}</button>
              <button type="button" disabled={busy||disabled} onClick={()=>remove(b)}
                className="min-h-10 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">{t("删除","Delete")}</button>
            </div>
          </div>
        </div>)}
        {!bills.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {t("还没有账单计划，点击上方新增账单。","No plans yet. Use New Bill above.")}
        </p>}
      </div>
    </section>}
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
          <select className={field} value={draft.category} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}>{categories.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label>
        <label className="text-sm">{t("付款方式","Method")}
          <select className={field} value={canonicalFinanceMethod(draft.method)} onChange={e=>setDraft(v=>({...v,method:canonicalFinanceMethod(e.target.value)}))}>{methods.map(m=><option key={m} value={m}>{methodLabel(m)}</option>)}</select></label>
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

  </>;
}
