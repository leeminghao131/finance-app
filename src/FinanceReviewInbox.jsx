import React,{useMemo,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {localDateMY} from "./financeCalendar.js";
import {confirmReview,findReviewCandidates,validateReviewState,REVIEW_RULE_KEYS,DEFAULT_REVIEW_RULES} from "./financeStage2.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const money=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const field="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const labels={
  large:["大额支出","Large expense"],duplicate:["疑似重复","Possible duplicate"],
  missingNote:["缺少备注","Missing note"],futureDate:["未来日期","Future-dated"],
};
export default function FinanceReviewInbox({
  records=[],reviewState={threshold:500,decisions:[]},onSave,optionsFor,
  onUpdateRecord,onDeleteRecord,onEditFx=()=>{},open=false,selectedId=null,disabled=false,onClose=()=>{},
}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const t=(cn,en)=>zh?cn:en;
  const [onlyPending,setOnlyPending]=useState(true),[editingId,setEditingId]=useState(null);
  const [fieldName,setFieldName]=useState("note"),[editValue,setEditValue]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const candidates=useMemo(()=>findReviewCandidates(records,reviewState,localDateMY()),[records,reviewState]);
  const selected=candidates.find(c=>c.id===selectedId);
  const displayed=selectedId?selected?[selected]:[]:onlyPending?candidates.filter(c=>!c.confirmed):candidates;
  const startEdit=c=>{setEditingId(c.id);setFieldName("note");setEditValue(String(c.record.note||""));setError("");setMessage("");};
  const setEditField=(c,next)=>{
    setFieldName(next);
    setEditValue(String(c.record[next]??""));
    setError("");
  };
  const saveSnapshot=async(next,baseline)=>{
    if(busy||disabled)return false;
    setBusy(true);setError("");setMessage("");
    try{
      if(JSON.stringify(reviewState)!==baseline)throw Error(t("复查记录已变动，请刷新后再试。","Review state changed on another device."));
      if(!await onSave(validateReviewState(next),baseline))throw Error(t("复查结果未确认保存到云端，请刷新后重试。","Review decision not confirmed in cloud; refresh and retry."));
      return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  };
  const toggleRule=async(rule,checked)=>{
    const normalized=validateReviewState(reviewState);
    const next={...normalized,enabled:{...normalized.enabled,[rule]:checked}};
    await saveSnapshot(next,JSON.stringify(reviewState));
  };
  const confirm=async c=>{
    if(await saveSnapshot(confirmReview(reviewState,c.record,localDateMY()),JSON.stringify(reviewState)))
      setMessage(t("已确认无误，之后同版本不会重复提醒。","Confirmed. This unchanged record will not alert again."));
  };
  const saveEdit=async c=>{
    if(busy||disabled)return;
    setBusy(true);setError("");setMessage("");
    try{
      // Existing updateRecord performs input validation, owner id, version CAS
      // and background conflict refresh. The Review UI never writes SQL itself.
      const ok=await onUpdateRecord(c.record.id,fieldName,editValue);
      if(!ok)throw Error(t("修改未成功，请检查记录并刷新。","Edit was not saved. Refresh before retrying."));
      setEditingId(null);
      setMessage(t("记录已保存。若仍符合异常规则，会继续等待确认。","Record saved. Remaining flags still require review."));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const removeRecord=async c=>{
    if(busy||disabled||!onDeleteRecord)return;
    if(!window.confirm(t("确定把这笔记录移到回收站？不会永久删除，之后可以 Restore。",
      "Move this record to Recycle Bin? This is not permanent and can be restored.")))return;
    setBusy(true);setError("");setMessage("");
    try{
      // Route through the SAME owner/version-guarded soft-delete as Transaction Records.
      // Do not claim success here: App reports errors and displays Undo on acknowledgement.
      await onDeleteRecord(c.record.id);
    }catch(e){setError(e.message||String(e));}finally{setBusy(false);}
  };
  const adjustThreshold=async e=>{
    e.preventDefault();
    const v=String(e.currentTarget.elements.threshold.value);
    try{
      const next=validateReviewState({...reviewState,threshold:v});
      if(await saveSnapshot(next,JSON.stringify(reviewState)))
        setMessage(t("异常金额阈值已更新。","Review threshold updated."));
    }catch(e){setError(e.message);}
  };
  return <>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="text-lg font-bold">{t("异常记录复查中心","Transaction Review Inbox")}</h2>
        </div>
      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
        {candidates.filter(c=>!c.confirmed).length} {t("待确认","pending")}
      </span>
    </div>
    <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-bold">{t("异常提醒开关","Anomaly reminder switches")}</h3>
      
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {REVIEW_RULE_KEYS.map(rule=><label key={rule}
          className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
          <span className="font-medium">{labels[rule]?.[zh?0:1]||rule}</span>
          <input type="checkbox" role="switch" aria-label={labels[rule]?.[zh?0:1]||rule}
            checked={(reviewState.enabled??DEFAULT_REVIEW_RULES)[rule]!==false}
            disabled={busy||disabled} onChange={e=>toggleRule(rule,e.target.checked)}
            className="h-5 w-5 accent-teal-700"/>
        </label>)}
      </div>
    </section>
    <form onSubmit={adjustThreshold} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
      <label className="min-w-[140px] flex-1 text-sm">{t("大额支出提醒阈值（RM）","Large-expense threshold (RM)")}
        <input name="threshold" defaultValue={reviewState.threshold} key={String(reviewState.threshold)}
          inputMode="decimal" className={field}/></label>
      <button type="submit" disabled={busy||disabled} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">
        {t("更新阈值","Update threshold")}
      </button>
      <label className="flex min-h-10 items-center gap-2 text-xs">
        <input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)}/>
        {t("只看待确认","Only pending")}
      </label>
    </form>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    <div className="mt-3 space-y-2">
      {displayed.map(c=><article key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="min-w-0">
            <b className="break-words" data-i18n-ignore>{c.record.category} · {money(c.record.amount)}</b>
            <p className="mt-1 text-xs text-slate-500">{c.record.date} · {c.record.method} ·
              <span data-i18n-ignore> {c.record.note||"—"}</span></p>
          </div>
          <span className={"rounded-full px-2.5 py-1 text-xs font-semibold "+(c.confirmed?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>
            {c.confirmed?t("已确认","Reviewed"):t("待复查","Needs review")}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {c.reasons.map(reason=><span key={reason} className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
            {labels[reason]?.[zh?0:1]||reason}</span>)}
        </div>
        {editingId===c.id?<div className="mt-3 rounded-xl bg-slate-50 p-3">
          <label className="block text-xs">{t("选择需要修改的字段","Select a field to edit")}
            <select className={field} value={fieldName} onChange={e=>setEditField(c,e.target.value)}>
              {["note","amount","date","category","method"].filter(name=>!c.record.fx_currency||!["amount","date"].includes(name)).map(name=><option key={name} value={name}>{
                {note:t("备注","Note"),amount:t("金额","Amount"),date:t("日期","Date"),
                  category:t("分类","Category"),method:t("付款方式","Method")}[name]}</option>)}
            </select>
          </label>
          <label className="mt-2 block text-xs">{t("修改为","New value")}
            {["category","method"].includes(fieldName)?
              <select value={editValue} onChange={e=>setEditValue(e.target.value)} className={field}>
                {(fieldName==="category"?optionsFor(c.record.type).categories:optionsFor(c.record.type).methods)
                  .map(value=><option value={value} key={value}>{value}</option>)}
              </select>:
              <input type={fieldName==="date"?"date":"text"}
                inputMode={fieldName==="amount"?"decimal":"text"}
                className={field} value={editValue} onChange={e=>setEditValue(e.target.value)}/>}
          </label>
          <div className="mt-2 flex gap-2">
            <button disabled={busy||disabled} type="button" onClick={()=>saveEdit(c)}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">
              {t("保存这项修改","Save this edit")}</button>
            <button type="button" onClick={()=>setEditingId(null)} className="rounded-lg border px-3 py-2.5 text-xs">
              {t("取消","Cancel")}</button>
          </div>
          
        </div>:<div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled||busy||c.confirmed} onClick={()=>confirm(c)}
            className="rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {t("确认无误","Confirm correct")}</button>
          <button type="button" disabled={disabled||busy} onClick={()=>startEdit(c)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-bold">{t("修改对应记录","Edit transaction")}</button>
          {c.record.fx_currency&&<button type="button" disabled={disabled||busy}
            onClick={e=>onEditFx(c.record,e.currentTarget)}
            className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800">
            {t("编辑外币金额","FX Edit")}</button>}
          <button type="button" disabled={disabled||busy||!onDeleteRecord} onClick={()=>removeRecord(c)}
            className="min-h-11 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 disabled:opacity-50">
            {t("删除记录","Delete transaction")}</button>
        </div>}
      </article>)}
      {!displayed.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        {selectedId?t("该异常已消失或对应记录已变动。","This anomaly has cleared or the record changed."):
          t("暂无需要复查的记录。","No transactions to review.")}</p>}
    </div>
    
  </>;
}
