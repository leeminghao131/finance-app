import React,{useEffect,useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage,localizedFinanceConfirm} from "./FinanceLanguageLayer.jsx";
import {localDateMY} from "./financeCalendar.js";
import {claimSummary} from "./financeClaims.js";

const money=value=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(Number(value||0));
const initialDraft=()=>({title:"",claimant:"Company",amount:"",method:"BANK",paid_on:localDateMY(),note:""});
const initialRepay=()=>({amount:"",method:"BANK",received_on:localDateMY(),note:""});
const makeRequest=()=>crypto.randomUUID();

export default function FinanceClaimTracker({
  claims=[],repayments=[],methods=[],userId=null,disabled=false,
  onCreate,onSubmitClaim,onCancelClaim,onRepay,onVoidRepayment,
  openRequest=null,onOpenRequestHandled=()=>{},
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [open,setOpen]=useState(false),[filter,setFilter]=useState("outstanding");
  const [showNew,setShowNew]=useState(false),[draft,setDraft]=useState(initialDraft);
  const [repayFor,setRepayFor]=useState(null),[repayDraft,setRepayDraft]=useState(initialRepay);
  const [focusedClaimId,setFocusedClaimId]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[info,setInfo]=useState("");
  const triggerRef=useRef(null),createReq=useRef(null),repayReq=useRef(null);
  const lastRequestRef=useRef(null),topRef=useRef(null);
  const summary=useMemo(()=>claimSummary(claims,repayments),[claims,repayments]);
  const sorted=filter==="outstanding"?summary.open:filter==="completed"
    ?summary.rows.filter(c=>c.status==="completed"):summary.rows;
  useEffect(()=>{
    setOpen(false);setError("");setInfo("");setShowNew(false);
    setRepayFor(null);setFocusedClaimId(null);createReq.current=null;repayReq.current=null;
    setDraft(initialDraft());setRepayDraft(initialRepay());
  },[userId]);
  useEffect(()=>{
    if(!openRequest||lastRequestRef.current===openRequest)return;
    lastRequestRef.current=openRequest;
    if(disabled)return;
    if(openRequest.source)triggerRef.current=openRequest.source;
    setOpen(true);setFilter("outstanding");setShowNew(false);
    setRepayFor(null);setFocusedClaimId(openRequest.claimId||null);
    setError("");onOpenRequestHandled();
  },[openRequest,disabled,onOpenRequestHandled]);
  const updateDraft=(key,value)=>{
    createReq.current=null;setDraft(p=>({...p,[key]:value}));setError("");setInfo("");
  };
  const updateRepay=(key,value)=>{
    repayReq.current=null;setRepayDraft(p=>({...p,[key]:value}));setError("");setInfo("");
  };
  const run=async(action,success)=>{
    setBusy(true);setError("");setInfo("");
    try{await action();setInfo(success);}
    catch(e){setError(e?.message||"Unable to save. Refresh before retrying.");}
    finally{setBusy(false);}
  };
  const saveNew=async e=>{
    e.preventDefault();
    if(!createReq.current)createReq.current=makeRequest();
    const requestId=createReq.current;
    await run(async()=>{
      await onCreate(draft,requestId);
      createReq.current=null;setDraft(initialDraft());setShowNew(false);
      setFilter("outstanding");
    },t("已确认保存垫付记录。","Advance confirmed in cloud."));
  };
  const selectRepay=claim=>{
    setError("");setInfo("");
    setRepayFor(claim.id);repayReq.current=null;
    setRepayDraft({amount:claim.outstanding.toFixed(2),
      method:methods.includes(claim.method)?claim.method:(methods[0]||claim.method),
      received_on:localDateMY(),note:""});
  };
  const saveRepay=async(e,claim)=>{
    e.preventDefault();
    if(!repayReq.current)repayReq.current=makeRequest();
    const requestId=repayReq.current;
    await run(async()=>{
      await onRepay(claim,repayDraft,requestId);
      repayReq.current=null;setRepayFor(null);setRepayDraft(initialRepay());
    },t("收到的报销已确认保存。","Reimbursement confirmed in cloud."));
  };
  const removeClaim=async claim=>{
    if(!localizedFinanceConfirm(t("取消这笔尚未报销的垫付款？记录会保留为已取消，余额恢复。","Cancel this unreimbursed advance? History stays intact and cash balance is restored.")))return;
    await run(()=>onCancelClaim(claim),t("垫付已取消，历史保留。","Claim cancelled; history retained."));
  };
  const voidPayment=async row=>{
    if(!localizedFinanceConfirm(t("撤销这笔报销到账记录？待报销金额会恢复。","Void this reimbursement? Outstanding amount will increase again.")))return;
    await run(()=>onVoidRepayment(row),t("报销记录已安全撤销。","Repayment voided; original history retained."));
  };
  const statusLabel=claim=>claim.status==="cancelled"?t("已取消 · 保留历史","Cancelled · History kept"):
    claim.status==="completed"?t("已全部收回","Fully Reimbursed"):
    claim.status==="submitted"?t("等待公司报销","Awaiting Reimbursement"):t("尚未提交 Claim","Not Submitted");
  const fieldClass="mh-claim-input";
  return <>
    <button ref={triggerRef} type="button" disabled={disabled}
      aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>{setOpen(true);setError("");setInfo("");setRepayFor(null);}}
      className="mh-insights-dock__button mh-claim-dock-launcher">
      <span className="mh-insights-dock__label">{t("垫付报销","Claim Tracker")}</span>
      <span className="mh-insights-dock__icon" aria-hidden="true">🧾</span>
      {summary.open.length>0&&<span className="mh-claim-dock-count">{summary.open.length}</span>}
    </button>
    <FinanceOverlay open={open} onClose={()=>{if(!busy){setOpen(false);setRepayFor(null);}}}
      title={t("垫付报销 · Claim Tracker","Claim Tracker · Reimbursements")}
      triggerRef={triggerRef} widthClass="max-w-4xl">
      <section className="mh-claim-console" aria-label={t("垫付报销管理","Claim tracking")}>
        <div className="mh-claim-orbit" aria-hidden="true"><span>✦</span></div>
        <div className="mh-claim-summary">
          <div><small>{t("等待收回","OUTSTANDING")}</small><strong>{money(summary.outstanding)}</strong>
            <span>{summary.open.length} {t("笔待报销","pending claims")}</span></div>
          <div><small>{t("累计已收回","REIMBURSED")}</small><strong>{money(summary.reimbursed)}</strong>
            <span>{t("已到账，不计个人收入","Cash received · not Income")}</span></div>
        </div>
        <p className="mh-claim-explainer">{t(
          "垫付款会减少实际现金余额，但不会算进个人支出；公司报销到账会恢复现金余额，但不会算进个人收入。",
          "Advances reduce actual cash, not personal Expense. Reimbursements restore cash, not personal Income."
        )}</p>
        <div className="mh-claim-toolbar">
          <div role="group" aria-label={t("筛选垫付状态","Claim filter")} className="mh-claim-tabs">
            {[["outstanding",t("待报销","Pending")],["completed",t("已完成","Completed")],["all",t("全部","All")]]
              .map(([value,label])=><button key={value} type="button" aria-pressed={filter===value}
                className={filter===value?"is-selected":""} onClick={()=>setFilter(value)}>{label}</button>)}
          </div>
          <button type="button" disabled={disabled||busy} className="mh-claim-create"
            onClick={()=>{setShowNew(s=>!s);setError("");setInfo("");setRepayFor(null);
              setDraft(p=>({...p,method:methods.includes(p.method)?p.method:(methods[0]||"BANK")}));}}>
            <span aria-hidden="true">✦</span> {showNew?t("关闭新增","Close Form"):t("＋ 新增垫付","＋ New Advance")}
          </button>
        </div>
        {showNew&&<form className="mh-claim-form" onSubmit={saveNew}>
          <h3>{t("记录你已经替别人支付的钱","Record money you already paid for someone else")}</h3>
          <div className="mh-claim-fields">
            <label>{t("用途／名称","Description")}
              <input required maxLength={160} className={fieldClass} value={draft.title}
                placeholder={t("例如：公司同事午餐","e.g. Team lunch")}
                onChange={e=>updateDraft("title",e.target.value)}/></label>
            <label>{t("谁需要报销给你","Claim from")}
              <input required maxLength={160} className={fieldClass} value={draft.claimant}
                onChange={e=>updateDraft("claimant",e.target.value)}/></label>
            <label>{t("垫付金额（RM 正常输入）","Amount (RM typing)")}
              <input required type="text" inputMode="decimal" className={fieldClass}
                placeholder="100.00" value={draft.amount}
                onChange={e=>updateDraft("amount",e.target.value)}/></label>
            <label>{t("实际付款方式","Paid using")}
              <select required className={fieldClass} value={draft.method}
                onChange={e=>updateDraft("method",e.target.value)}>
                {methods.map(method=><option key={method} value={method}>{method}</option>)}
              </select></label>
            <label>{t("实际付款日期","Paid on")}
              <input required type="date" max={localDateMY()} className={fieldClass}
                value={draft.paid_on} onChange={e=>updateDraft("paid_on",e.target.value)}/></label>
            <label>{t("备注（可选）","Note (optional)")}
              <input maxLength={1000} className={fieldClass} value={draft.note}
                onChange={e=>updateDraft("note",e.target.value)}/></label>
          </div>
          <button type="submit" disabled={disabled||busy} className="mh-claim-save">
            {busy?t("保存中…","Saving…"):t("确认垫付 · 从现金余额扣除","Confirm Advance · Reduce Cash")}
          </button>
        </form>}
        {error&&<p role="alert" className="mh-claim-error">{error}</p>}
        {info&&<p role="status" className="mh-claim-success">{info}</p>}
        <div className="mh-claim-list" ref={topRef}>
          {sorted.map(claim=>{
            const paidRows=repayments.filter(r=>r.claim_id===claim.id).sort((a,b)=>b.received_on.localeCompare(a.received_on));
            const liveRows=paidRows.filter(r=>!r.voided_at);
            const paying=repayFor===claim.id&&claim.outstanding>0;
            return <article className={"mh-claim-item"+(focusedClaimId===claim.id?" is-focused":"")} key={claim.id}>
              <div className="mh-claim-item-header">
                <div className="min-w-0">
                  <p className="mh-claim-item-title" data-i18n-ignore>{claim.title}</p>
                  <p className="mh-claim-item-meta" data-i18n-ignore>{claim.claimant} · {claim.paid_on} · {claim.method}</p>
                </div>
                <span className={"mh-claim-status mh-claim-status--"+claim.status}>{statusLabel(claim)}</span>
              </div>
              <div className="mh-claim-item-money">
                <div><small>{t("原垫付","ADVANCED")}</small><strong>{money(claim.amount)}</strong></div>
                <div><small>{t("已收回","RECEIVED")}</small><strong>{money(claim.repaid)}</strong></div>
                <div><small>{t("还欠你","STILL OWED")}</small><strong className="mh-claim-owed">{money(claim.outstanding)}</strong></div>
              </div>
              <div className="mh-claim-progress"><div style={{width:claim.progress+"%"}} /></div>
              {claim.note&&<p className="mh-claim-item-note" data-i18n-ignore>{claim.note}</p>}
              <div className="mh-claim-actions">
                {claim.outstanding>0&&!claim.submitted_on&&<button type="button" disabled={busy||disabled}
                  onClick={()=>run(()=>onSubmitClaim(claim),t("已标记提交，仍继续提醒直到全额到账。","Marked submitted; reminder stays until fully received."))}>
                  {t("标记已申请 Claim","Mark Submitted")}
                </button>}
                {claim.outstanding>0&&<button type="button" disabled={busy||disabled}
                  className="is-primary" onClick={()=>paying?setRepayFor(null):selectRepay(claim)}>
                  {paying?t("关闭收款","Close Repayment"):t("＋ 记录收到报销","＋ Record Reimbursement")}
                </button>}
                {!claim.cancelled_at&&!liveRows.length&&<button type="button" disabled={busy||disabled}
                  className="is-danger" onClick={()=>removeClaim(claim)}>
                  {t("取消错误垫付","Cancel Claim")}
                </button>}
              </div>
              {paying&&<form className="mh-claim-form mh-claim-repay-form"
                onSubmit={e=>saveRepay(e,claim)}>
                <h4>{t("实际收到多少？支持分批报销","How much was actually received? Partial payments supported.")}</h4>
                <div className="mh-claim-fields">
                  <label>{t("到账金额 RM","Received RM")}
                    <input required className={fieldClass} type="text" inputMode="decimal"
                      value={repayDraft.amount} onChange={e=>updateRepay("amount",e.target.value)}/></label>
                  <label>{t("收到钱的账户","Received into")}
                    <select className={fieldClass} value={repayDraft.method}
                      onChange={e=>updateRepay("method",e.target.value)}>
                      {methods.map(m=><option key={m} value={m}>{m}</option>)}
                    </select></label>
                  <label>{t("实际到账日期","Received date")}
                    <input required className={fieldClass} type="date"
                      min={claim.paid_on} max={localDateMY()} value={repayDraft.received_on}
                      onChange={e=>updateRepay("received_on",e.target.value)}/></label>
                  <label>{t("备注","Note")}
                    <input className={fieldClass} maxLength={1000} value={repayDraft.note}
                      onChange={e=>updateRepay("note",e.target.value)}/></label>
                </div>
                <button type="submit" disabled={busy||disabled} className="mh-claim-save">
                  {t("确认实际收款","Confirm Actual Receipt")}
                </button>
              </form>}
              {paidRows.length>0&&<details className="mh-claim-repayment-history">
                <summary>{t("报销到账历史","Reimbursement History")} · {paidRows.length}</summary>
                {paidRows.map(r=><div key={r.id} className="mh-claim-repayment-row">
                  <div className="min-w-0">
                    <p className={r.voided_at?"is-void":""}>{money(r.amount)} · <span data-i18n-ignore>{r.method}</span></p>
                    <small>{r.received_on} {r.voided_at?t("· 已撤销","· Voided"):""}</small>
                  </div>
                  {!r.voided_at&&<button type="button" disabled={busy||disabled}
                    onClick={()=>voidPayment(r)}>{t("撤销错误收款","Void")}</button>}
                </div>)}
              </details>}
            </article>;
          })}
          {!sorted.length&&<p className="mh-claim-empty">{filter==="outstanding"?
            t("目前没有等待报销的款项。","No outstanding reimbursements.") :
            t("这里还没有符合条件的记录。","No matching claims yet.")}</p>}
        </div>
      </section>
    </FinanceOverlay>
  </>;
}
