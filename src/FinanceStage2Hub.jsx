import React,{useEffect,useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import FinanceRecurringBills from "./FinanceRecurringBills.jsx";
import FinanceReviewInbox from "./FinanceReviewInbox.jsx";
import FinanceAccountReconciliation from "./FinanceAccountReconciliation.jsx";
import {billOccurrences,findReviewCandidates} from "./financeStage2.js";
import {localDateMY} from "./financeCalendar.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

/** Animated in-app alerts only, no push permissions/paid provider/browser notifications. */
export default function FinanceStage2Hub({
  bills=[],reviewState={threshold:500,decisions:[]},checks=[],
  records=[],transfers=[],balances=[],categories=[],methods=[],
  onSaveBills,onConfirmBillPayment,onSaveReview,onUpdateRecord,onOpenAccountCheck,
  onSaveChecks,onExecuteTransfers,onPrefillRecord,
  optionsFor,disabled=false,toolRequest=null,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [mode,setMode]=useState(""),[selectedBillId,setSelectedBillId]=useState(null);
  const [selectedRecordId,setSelectedRecordId]=useState(null),[menu,setMenu]=useState(false);
  const [selectedAccountMethod,setSelectedAccountMethod]=useState(null);
  const triggerRef=useRef(null);
  const handledRequestRef=useRef(null);
  const today=localDateMY();
  const billsDue=useMemo(()=>billOccurrences(bills,today,records,70,35).filter(x=>x.visible),[bills,records,today]);
  const candidates=useMemo(()=>findReviewCandidates(records,reviewState,today).filter(x=>!x.confirmed),
    [records,reviewState,today]);
  const alerts=[
    ...billsDue.map(x=>({type:"bill",id:x.id,ref:x.billId,title:x.title,extra:x.due})),
    ...candidates.map(x=>({type:"review",id:x.id,ref:x.id,title:x.record.category,extra:x.record.date})),
  ];
  // Only overdue bills and unconfirmed anomalous transactions trigger notifications.
  // Method discrepancies are handled on demand via the left-side Balance Check drawer.
  const firstOfType=["bill","review"]
    .map(type=>alerts.find(item=>item.type===type)).filter(Boolean);
  const prioritized=[...firstOfType,
    ...alerts.filter(item=>!firstOfType.includes(item))];
  const alertCount=alerts.length;
  const open=(type,ref=null,source=null)=>{
    if(disabled)return;
    if(source)triggerRef.current=source;
    setMode(type);
    setSelectedBillId(type==="bill"?ref:null);
    setSelectedRecordId(type==="review"?ref:null);
    setMenu(false);
  };
  // Dock launchers reuse the SAME popup and handlers as the existing
  // actionable notifications; never mount a second copy of review/bill data.
  useEffect(()=>{
    if(!toolRequest || handledRequestRef.current===toolRequest)return;
    handledRequestRef.current=toolRequest;
    if(disabled || !["bill","review","accounts"].includes(toolRequest.type))return;
    triggerRef.current=toolRequest.source||null;
    setMode(toolRequest.type);
    setSelectedBillId(null);
    setSelectedRecordId(null);
    setSelectedAccountMethod(toolRequest.type==="accounts"?(toolRequest.method||null):null);
    setMenu(false);
  },[toolRequest,disabled]);
  const close=()=>{
    setMode("");setSelectedBillId(null);setSelectedRecordId(null);
    setSelectedAccountMethod(null);
  };
  const prefillAndClose=record=>{
    // Reconciliation still only fills the UNSAVED Income/Expense form.
    // Close the popup first so its focus/scroll lock cannot block the form.
    const ok=onPrefillRecord?.(record);
    if(ok)close();
    return ok;
  };
  const title=mode==="bill"?t("固定账单提醒","Recurring Bills")
    :mode==="accounts"?t("余额对账","Balance Reconciliation")
    :t("异常记录复查","Review Transactions");
  return <>
    <div className="mh-stage2-notifications" aria-label={t("财务动态通知","Financial notifications")}>
      <button type="button" disabled={disabled} aria-expanded={menu} aria-label={t("查看财务提醒","Open finance reminders")}
        onClick={()=>setMenu(x=>!x)} className="mh-stage2-notifications__bell">
        🔔 <span>{t("提醒","Alerts")}</span>
        {alertCount>0&&<span className="mh-stage2-notifications__count">{alertCount>99?"99+":alertCount}</span>}
      </button>
      {menu&&<div className="mh-stage2-notifications__menu"
        aria-label={t("逐条待处理通知","Individual pending notifications")}>
        <p className="px-2 py-1 text-xs font-semibold text-slate-500">
          {t("待处理提醒","Pending reminders")} · {alertCount}
        </p>
        <div className="mh-stage2-notifications__alert-list">
          {prioritized.map(item=><button key={item.type+":"+item.id}
            type="button" onClick={e=>open(item.type,item.ref,e.currentTarget)}>
            <span aria-hidden="true">{item.type==="bill"?"🗓️":"🔎"}</span>
            <span className="min-w-0 flex-1">
              <b className="block">{item.type==="bill"?t("账单到期提醒","Bill due"):
                t("交易待确认","Review transaction")}</b>
              <span className="block break-words text-xs text-slate-500" data-i18n-ignore>
                {item.title} · {item.extra}
              </span>
            </span>
          </button>)}
          {!prioritized.length&&<p className="px-3 py-3 text-sm text-slate-500">
            {t("目前没有待处理提醒。功能入口已移至左侧抽屉。",
               "No pending reminders. Tools are available in the left drawer.")}
          </p>}
        </div>
      </div>}
      {!menu&&prioritized.slice(0,3).map(item=><button type="button" key={item.type+":"+item.id}
        onClick={e=>open(item.type,item.ref,e.currentTarget)}
        className="mh-stage2-notifications__toast" title={t("点开查看并处理","Open to review and act")}>
        <span aria-hidden="true">{item.type==="bill"?"🗓️":"🔎"}</span>
        <span className="min-w-0">
          <b>{item.type==="bill"?t("账单到期提醒","Bill due"):
              t("交易待确认","Review transaction")}</b>
          <span className="block truncate text-xs" data-i18n-ignore>{item.title} · {item.extra}</span>
        </span>
        <span aria-hidden="true">›</span>
      </button>)}
      {!menu&&alerts.length>3&&<button type="button"
        onClick={()=>setMenu(true)}
        className="mh-stage2-notifications__more">
        {t("另外还有 ","Another ")}{alerts.length-3}{t(" 条待处理提醒"," alerts")}
      </button>}
    </div>
    <FinanceOverlay open={!!mode} title={title} onClose={close} triggerRef={triggerRef}
      widthClass={mode==="review"?"max-w-2xl":"max-w-4xl"}>
      {mode==="bill"&&<FinanceRecurringBills bills={bills} records={records} categories={categories} methods={methods}
        onSave={onSaveBills} onConfirmPayment={onConfirmBillPayment}
        disabled={disabled} selectedBillId={selectedBillId}/>}
      {mode==="review"&&<FinanceReviewInbox records={records} reviewState={reviewState}
        onSave={onSaveReview} optionsFor={optionsFor} onUpdateRecord={onUpdateRecord}
        selectedId={selectedRecordId} disabled={disabled}/>}
      {mode==="accounts"&&<FinanceAccountReconciliation
        records={records} transfers={transfers} balances={balances} checks={checks}
        onSave={onSaveChecks} onExecuteTransfers={onExecuteTransfers}
        onPrefillRecord={prefillAndClose}
        selectedMethod={selectedAccountMethod} disabled={disabled}/>}

    </FinanceOverlay>
  </>;
}
