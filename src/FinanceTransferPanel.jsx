import { localizedFinanceAlert, localizedFinanceConfirm, useFinanceLanguage } from "./FinanceLanguageLayer.jsx";
import FinanceOverlay from "./FinanceOverlay.jsx";
import FinanceTransferCorners from "./FinanceTransferCorners.jsx";
import React, { useMemo, useRef, useState } from "react";
import { requireCalendarDate } from "./financeCalendar.js";

const money = (value) => new Intl.NumberFormat("en-MY", {style:"currency",currency:"MYR"}).format(Number(value || 0));
const inputStyle = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none";
const buttonStyle = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100";

export default function FinanceTransferPanel({
  transferForm, setTransferForm, methodOptions, transfers, deletedTransfers,
  onTransfer, onUpdateTransfer, onDeleteTransfer, onRestoreTransfer, undoTransfer,
  disabled=false,
}) {
  const {language}=useFinanceLanguage();
  const t=(cn,en)=>language==="zh"?cn:en;
  const [showAll, setShowAll] = useState(true);
  const [historyOpen,setHistoryOpen] = useState(false);
  const historyTriggerRef=useRef(null);
  const [showTrash, setShowTrash] = useState(false);
  const [month, setMonth] = useState("all");
  const [from, setFrom] = useState("all");
  const [to, setTo] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(25);
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const matched = useMemo(() => transfers.filter((row) => {
    if (month !== "all" && !row.date.startsWith(month)) return false;
    if (from !== "all" && row.fromMethod !== from) return false;
    if (to !== "all" && row.toMethod !== to) return false;
    return [row.fromMethod,row.toMethod,row.note,row.date,row.amount]
      .join(" ").toLowerCase().includes(keyword.toLowerCase().trim());
  }),[transfers,month,from,to,keyword]);

  function startEditing(item) {
    setShowAll(true);
    setEditing({
      id:item.id, fromMethod:item.fromMethod, toMethod:item.toMethod,
      amount:Number(item.amount).toFixed(2), date:item.date, note:item.note || "",
    });
  }
  async function saveEdit() {
    if (!editing) return;
    try { requireCalendarDate(editing.date); } catch(e) { localizedFinanceAlert(e.message); return; }
    setPending(true);
    try {
      const ok = await onUpdateTransfer(editing.id,editing);
      if (ok) setEditing(null);
    } finally { setPending(false); }
  }
  async function deleteItem(id) {
    setPending(true);
    try { const ok=await onDeleteTransfer(id); if(ok) setConfirmDelete(null); }
    finally { setPending(false); }
  }

  return (
    <div id="mh-money-transfer-card" className="mh-transfer-console">
      <div className="mh-transfer-console__header">
        <div>
          <h2 className="mh-transfer-console__title">{t("资金转账","Money Transfer")}</h2>
        </div>
        <button ref={historyTriggerRef} type="button" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={historyOpen}
          onClick={()=>{setShowAll(true);setHistoryOpen(true);}}
          className="mh-transfer-console__history mh-modal-trigger">
          <span aria-hidden="true">▤</span> {t("转账历史","Transfer History")} <span className="mh-transfer-console__history-count">{transfers.length}</span>
        </button>
      </div>

      <form onSubmit={onTransfer} className="mh-transfer-console__form">
        <FinanceTransferCorners methods={methodOptions}
          fromMethod={transferForm.fromMethod} toMethod={transferForm.toMethod}
          amount={transferForm.amount} disabled={disabled}
          onFrom={method=>setTransferForm(old=>({...old,fromMethod:method}))}
          onTo={method=>setTransferForm(old=>({...old,toMethod:method}))}
          onAmountChange={value=>{
            const digits=String(value||"").replace(/\D/g,"");
            const amount=(Number(digits||0)/100).toFixed(2);
            setTransferForm(old=>({...old,amount}));
          }}/>
        <details className="mh-transfer-console__fallback">
          <summary>{t("使用下拉列表选择账户","Choose methods using dropdowns")}</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs">{t("转出账户","From Method")}
              <select className={inputStyle} value={transferForm.fromMethod} disabled={disabled}
                onChange={e=>setTransferForm(old=>({...old,fromMethod:e.target.value}))}>
                {methodOptions.map(method=><option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="text-xs">{t("转入账户","To Method")}
              <select className={inputStyle} value={transferForm.toMethod} disabled={disabled}
                onChange={e=>setTransferForm(old=>({...old,toMethod:e.target.value}))}>
                {!transferForm.toMethod&&<option value="">{t("请选择","Select…")}</option>}
                {methodOptions.map(method=><option key={method} value={method}>{method}</option>)}
              </select>
            </label>
          </div>
        </details>
        <div className="mh-transfer-console__fields">
          <label>{t("转账日期","Date")}
            <input type="date" required disabled={disabled} className={inputStyle}
              value={transferForm.date}
              onChange={e=>setTransferForm(old=>({...old,date:e.target.value}))}/>
          </label>
          <label>{t("备注","Note")}
            <input disabled={disabled} className={inputStyle} value={transferForm.note}
              onChange={e=>setTransferForm(old=>({...old,note:e.target.value}))}/>
          </label>
        </div>
        <button type="submit"
          disabled={disabled||!transferForm.fromMethod||!transferForm.toMethod||
            transferForm.fromMethod===transferForm.toMethod||Number(transferForm.amount)<=0}
          className="mh-transfer-console__submit">
          <span aria-hidden="true">✦</span> {t("确认资金转账","Confirm Transfer")} <span aria-hidden="true">⇢</span>
        </button>
      </form>

      {undoTransfer && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          <span>Transfer moved to Recycle Bin · {money(undoTransfer.amount)}</span>
          <button type="button" className="rounded-xl bg-blue-700 px-3 py-2 font-bold text-white"
            onClick={()=>onRestoreTransfer(undoTransfer.id)}>Undo</button>
        </div>
      )}

      <FinanceOverlay open={historyOpen} triggerRef={historyTriggerRef}
        title={t("转账历史","Transfer History")} widthClass="max-w-4xl"
        onClose={()=>{if(!pending){setHistoryOpen(false);setEditing(null);setConfirmDelete(null);}}}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{t("转账历史","Transfer History")}</h3>
          <p className="text-xs text-slate-500">{transfers.length} {t("笔转账","transfers")}</p>
        </div>
        <button type="button" className={buttonStyle} onClick={()=>setShowAll((v)=>!v)}>
          {showAll?"Show Latest 5":"View All Transfers"}
        </button>
      </div>

      {showAll && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <label className="text-xs text-slate-600">Month
            <input className={inputStyle} type="month" value={month==="all"?"":month}
              onChange={(e)=>{setMonth(e.target.value || "all");setLimit(25);}}/>
          </label>
          <label className="text-xs text-slate-600">From
            <select className={inputStyle} value={from}
              onChange={(e)=>{setFrom(e.target.value);setLimit(25);}}>
              <option value="all">All</option>
              {methodOptions.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">To
            <select className={inputStyle} value={to}
              onChange={(e)=>{setTo(e.target.value);setLimit(25);}}>
              <option value="all">All</option>
              {methodOptions.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Search
            <input className={inputStyle} value={keyword}
              onChange={(e)=>{setKeyword(e.target.value);setLimit(25);}} placeholder="Note, amount..."/>
          </label>
        </div>
      )}

      {editing && (
        <div className="mt-4 rounded-xl bg-blue-50 p-4 ring-1 ring-blue-200">
          <h3 className="font-bold text-blue-900">Edit Transfer (RM is entered normally)</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs">From
              <select className={inputStyle} value={editing.fromMethod} onChange={e=>setEditing(o=>({...o,fromMethod:e.target.value}))}>
                {[...new Set([...methodOptions,editing.fromMethod])].map(m=><option value={m} key={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs">To
              <select className={inputStyle} value={editing.toMethod} onChange={e=>setEditing(o=>({...o,toMethod:e.target.value}))}>
                {[...new Set([...methodOptions,editing.toMethod])].map(m=><option value={m} key={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs">Amount RM
              <input className={inputStyle} type="text" inputMode="decimal" value={editing.amount} onChange={e=>setEditing(o=>({...o,amount:e.target.value}))}/>
            </label>
            <label className="text-xs">Date
              <input className={inputStyle} type="date" value={editing.date} onChange={e=>setEditing(o=>({...o,date:e.target.value}))}/>
            </label>
          </div>
          <label className="mt-3 block text-xs">Note
            <input className={inputStyle} value={editing.note} onChange={e=>setEditing(o=>({...o,note:e.target.value}))}/>
          </label>
          
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={saveEdit}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save transfer</button>
            <button type="button" onClick={()=>setEditing(null)} className={buttonStyle}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto">
        {(showAll?matched.slice(0,limit):transfers.slice(0,5)).map((row)=>(
          <div key={row.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{row.fromMethod} → {row.toMethod}</p>
                <p className="text-xs text-slate-500">{row.date} · {row.note ? <span data-i18n-ignore>{row.note}</span> : "No note"}</p>
              </div>
              <p className="font-bold text-blue-700">{money(row.amount)}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className={buttonStyle} onClick={()=>startEditing(row)}>Edit</button>
              {confirmDelete===row.id?(
                <>
                  <button type="button" disabled={pending} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white"
                    onClick={()=>deleteItem(row.id)}>Confirm</button>
                  <button type="button" className={buttonStyle} onClick={()=>setConfirmDelete(null)}>Cancel</button>
                </>
              ):(
                <button type="button" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
                  onClick={()=>setConfirmDelete(row.id)}>Delete</button>
              )}
            </div>
          </div>
        ))}
        {(showAll?matched:transfers).length===0&&
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No matching transfers.</p>}
      </div>
      {showAll && matched.length > limit && (
        <button type="button" className={buttonStyle} onClick={()=>setLimit(n=>n+25)}>Show more ({matched.length-limit} remaining)</button>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div>
          <h3 className="font-bold">Transfer Recycle Bin</h3>
          <p className="text-xs text-slate-500">{deletedTransfers.length} recoverable transfers</p>
        </div>
        <button type="button" className={buttonStyle} onClick={()=>setShowTrash(v=>!v)}>
          {showTrash?"Hide":"Open"} Transfer Recycle Bin
        </button>
      </div>
      {showTrash && (
        <div className="mt-3 space-y-2">
          {deletedTransfers.length===0?<p className="text-sm text-slate-500">Transfer Recycle Bin is empty.</p>:
            deletedTransfers.map(row=>(
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <div><p className="text-sm font-bold">{row.fromMethod} → {row.toMethod} · {money(row.amount)}</p>
                  <p className="text-xs text-slate-500">{row.date} · {row.note || "No note"}</p></div>
                <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                  onClick={()=>onRestoreTransfer(row.id)}>Restore</button>
              </div>
            ))}
        </div>
      )}
      </FinanceOverlay>
    </div>
  );
}
