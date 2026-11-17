import React,{useEffect,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {FX_FAVORITES,FX_SOURCE,makeFxSnapshot,getReferenceFxRate,getSupportedFxCurrencies} from "./financeFx.js";
/** Dedicated atomic foreign-amount + RM editor. Never edits the MYR amount in isolation. */
export default function FinanceFxRecordEditor({record,onSave,onClose,triggerRef}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [currency,setCurrency]=useState("USD"),[foreignAmount,setForeignAmount]=useState("");
  const [currencies,setCurrencies]=useState(FX_FAVORITES);
  useEffect(()=>{
    const ctrl=new AbortController();
    getSupportedFxCurrencies(fetch,ctrl.signal).then(list=>{
      if(!ctrl.signal.aborted)setCurrencies(list);
    }).catch(()=>{/* Existing currency remains selectable offline. */});
    return ()=>ctrl.abort();
  },[]);
  const [date,setDate]=useState(""),[quote,setQuote]=useState(null);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!record)return;
    setCurrency(record.fx_currency);setForeignAmount(String(record.fx_amount));
    setDate(record.date);setQuote({currency:record.fx_currency,requestedDate:record.date,
      date:record.fx_rate_date,rate:String(record.fx_rate),source:FX_SOURCE});
    setError("");
  },[record?.id,record?.version]);
  useEffect(()=>{
    if(!record||!date||!currency)return;
    if(date===record.date&&currency===record.fx_currency)return;
    const ctrl=new AbortController();
    setQuote(null);setLoading(true);setError("");
    getReferenceFxRate(currency,date,fetch,ctrl.signal)
      .then(result=>{if(!ctrl.signal.aborted)setQuote(result);})
      .catch(e=>{if(!ctrl.signal.aborted)setError(e.message||String(e));})
      .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
    return ()=>ctrl.abort();
  },[record?.id,currency,date]);
  let snap=null,validation="";
  if(record&&quote)try{snap=makeFxSnapshot({currency,foreignAmount,quote,recordDate:date});}
  catch(e){validation=e.message;}
  async function save(){
    if(!record||!snap||loading||saving)return;
    setSaving(true);setError("");
    try{
      const ok=await onSave(record,{...snap,date});
      if(!ok)throw Error(t("云端未确认保存，数据可能已变化；请刷新核对。","Cloud save not confirmed. Refresh and verify."));
      onClose();
    }catch(e){setError(e.message||String(e));}
    finally{setSaving(false);}
  }
  return <FinanceOverlay open={!!record} title={t("编辑外币交易","Edit foreign-currency record")}
    onClose={()=>{if(!saving)onClose();}} widthClass="max-w-lg" triggerRef={triggerRef}>
    {record&&<div className="space-y-3">
      <p className="text-sm text-slate-600">{t("原始外币与 RM 一起安全更新。只有日期或货币变化时才重新获取参考汇率。","Original currency and RM are updated atomically. The saved rate stays locked unless the date/currency changes.")}</p>
      <label className="block text-sm font-semibold">{t("币种","Currency")}
        <select className="mt-1 w-full rounded-xl border p-3" value={currency}
          onChange={e=>setCurrency(e.target.value)} disabled={saving}>
          {Array.from(new Set([...currencies,record.fx_currency])).filter(c=>c!=="MYR").map(c=><option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">{t("外币金额","Foreign amount")} ({currency})
        <input type="text" inputMode="decimal" value={foreignAmount} onChange={e=>setForeignAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border p-3" disabled={saving}/>
      </label>
      <label className="block text-sm font-semibold">{t("交易日期","Transaction date")}
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border p-3" disabled={saving}/>
      </label>
      {loading&&<p role="status" className="text-sm text-blue-700">{t("正在查询历史汇率…","Fetching historical rate…")}</p>}
      {quote&&<div className="rounded-xl bg-slate-50 p-3 text-sm">
        <p>1 {currency} = RM {quote.rate} · {quote.date}</p>
        <p className="mt-1 text-lg font-bold">{snap?"RM "+snap.amount.toFixed(2):"—"}</p>
        <p className="text-xs text-slate-500">{t("参考汇率，不是银行实际扣款。","Reference rate, not bank settlement.")}</p>
      </div>}
      {(error||validation)&&<p role="alert" className="text-sm font-semibold text-red-700">{error||validation}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={saving||loading||!snap} onClick={save}
          className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40">
          {saving?t("保存中…","Saving…"):t("保存外汇修改","Save FX changes")}</button>
        <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border px-4 text-sm font-bold">{t("取消","Cancel")}</button>
      </div>
    </div>}
  </FinanceOverlay>;
}
