import React,{useMemo,useRef,useState} from "react";
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
  onSaveBills,onSaveReview,onSaveChecks,onPrefillExpense,onPrefillRecord,onUpdateRecord,
  optionsFor,disabled=false,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [mode,setMode]=useState(""),[selectedBillId,setSelectedBillId]=useState(null);
  const [selectedRecordId,setSelectedRecordId]=useState(null),[menu,setMenu]=useState(false);
  const triggerRef=useRef(null);
  const today=localDateMY();
  const billsDue=useMemo(()=>billOccurrences(bills,today,records,70,35).filter(x=>x.visible),[bills,records,today]);
  const candidates=useMemo(()=>findReviewCandidates(records,reviewState,today).filter(x=>!x.confirmed),
    [records,reviewState,today]);
  const reconciliationAlerts=useMemo(()=>{
    const latest=new Map();
    for(const row of checks.slice().sort((a,b)=>b.date.localeCompare(a.date))){
      if(!latest.has(row.method))latest.set(row.method,row);
    }
    return [...latest.values()].filter(row=>Math.abs(row.difference)>0.005);
  },[checks]);
  const alerts=[
    ...billsDue.map(x=>({type:"bill",id:x.id,ref:x.billId,title:x.title,extra:x.due})),
    ...candidates.map(x=>({type:"review",id:x.id,ref:x.id,title:x.record.category,extra:x.record.date})),
    ...reconciliationAlerts.map(x=>({type:"accounts",id:x.id,ref:x.method,title:x.method,extra:today})),
  ];
  // Show one of each alert type first so numerous bills cannot hide review notifications.
  const firstOfType=["bill","review","accounts"]
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
  const close=()=>{setMode("");setSelectedBillId(null);setSelectedRecordId(null);};
  const prefillAndClose=next=>{
    // Only close when the protected, UNSAVED form was actually filled.
    // Closing releases modal focus/scroll lock before App scrolls to the form.
    const ok=onPrefillRecord(next);
    if(ok)close();
    return ok;
  };
  const title=mode==="bill"?t("固定账单提醒","Recurring Bills")
    :mode==="review"?t("异常记录复查","Review Transactions")
    :t("账户余额对账","Reconcile Accounts");
  return <>
    <div className="mh-stage2-notifications" aria-label={t("财务动态通知","Financial notifications")}>
      <button type="button" disabled={disabled} aria-expanded={menu} aria-label={t("查看财务提醒","Open finance reminders")}
        onClick={()=>setMenu(x=>!x)} className="mh-stage2-notifications__bell">
        🔔 <span>{t("提醒","Alerts")}</span>
        {alertCount>0&&<span className="mh-stage2-notifications__count">{alertCount>99?"99+":alertCount}</span>}
      </button>
      {menu&&<div className="mh-stage2-notifications__menu">
        <button onClick={e=>open("bill",null,e.currentTarget)} type="button">🗓️ {t("固定账单","Recurring Bills")} ({billsDue.length})</button>
        <button onClick={e=>open("review",null,e.currentTarget)} type="button">🔍 {t("异常复查","Review Inbox")} ({candidates.length})</button>
        <button onClick={e=>open("accounts",null,e.currentTarget)} type="button">🏦 {t("账户对账","Balance Check")} ({reconciliationAlerts.length})</button>
      </div>}
      {!menu&&prioritized.slice(0,3).map(item=><button type="button" key={item.type+":"+item.id}
        onClick={e=>open(item.type,item.ref,e.currentTarget)}
        className="mh-stage2-notifications__toast" title={t("点开查看并处理","Open to review and act")}>
        <span aria-hidden="true">{item.type==="bill"?"🗓️":item.type==="review"?"🔎":"🏦"}</span>
        <span className="min-w-0">
          <b>{item.type==="bill"?t("账单到期提醒","Bill due"):
              item.type==="review"?t("交易待确认","Review transaction"):t("账户有差额","Balance difference")}</b>
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
      widthClass={mode==="review"?"max-w-2xl":mode==="bill"?"max-w-4xl":"max-w-5xl"}>
      {mode==="bill"&&<FinanceRecurringBills bills={bills} records={records} categories={categories} methods={methods}
        onSave={onSaveBills} onPrefillExpense={prefillAndClose}
        disabled={disabled} selectedBillId={selectedBillId}/>}
      {mode==="review"&&<FinanceReviewInbox records={records} reviewState={reviewState}
        onSave={onSaveReview} optionsFor={optionsFor} onUpdateRecord={onUpdateRecord}
        selectedId={selectedRecordId} disabled={disabled}/>}
      {mode==="accounts"&&<FinanceAccountReconciliation balances={balances}
        records={records} transfers={transfers} checks={checks}
        onSave={onSaveChecks} onPrefillRecord={prefillAndClose} disabled={disabled}/>}
    </FinanceOverlay>
  </>;
}
