import React,{useEffect,useState} from "react";
import {FX_FAVORITES,normalizeFxInput,convertForeignToMYR,getReferenceFxRate,getSupportedFxCurrencies} from "./financeFx.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
/** Never allows manual exchange-rate substitution or pretending a live bank debit. */
export default function FinanceCurrencyInput({date,currency,onCurrency,foreignAmount,onForeignAmount,quote,onQuote,disabled=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [currencies,setCurrencies]=useState(FX_FAVORITES);
  useEffect(()=>{
    const ctrl=new AbortController();
    getSupportedFxCurrencies(fetch,ctrl.signal)
      .then(list=>{if(!ctrl.signal.aborted)setCurrencies(list);})
      .catch(()=>{/* Favorites remain available if catalog is offline. */});
    return ()=>ctrl.abort();
  },[]);
  useEffect(()=>{
    if(currency==="MYR"){onQuote(null);setError("");return;}
    const ctrl=new AbortController();
    onQuote(null);setBusy(true);setError("");
    getReferenceFxRate(currency,date,fetch,ctrl.signal)
      .then(value=>{if(!ctrl.signal.aborted)onQuote(value);})
      .catch(e=>{if(!ctrl.signal.aborted)setError(e.message||String(e));})
      .finally(()=>{if(!ctrl.signal.aborted)setBusy(false);});
    return ()=>ctrl.abort();
  },[currency,date]);
  const valid=quote?.currency===currency&&quote?.requestedDate===date;
  let converted=null,inputError="";
  if(currency!=="MYR"&&valid&&foreignAmount){
    try{converted=convertForeignToMYR(normalizeFxInput(foreignAmount,currency),quote.rate,currency);}
    catch(e){inputError=e.message;}
  }
  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="text-sm font-semibold text-slate-700">{zh?"交易货币":"Transaction currency"}
      <select aria-label={zh?"交易货币":"Transaction currency"} value={currency} disabled={disabled}
        onChange={e=>onCurrency(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
        {[...new Set([...currencies,currency])].map(code=><option key={code} value={code}>{code}{code==="MYR"?" · RM":""}</option>)}
      </select>
    </label>
    {currency!=="MYR"&&<div className="mt-3 space-y-2">
      <label className="block text-sm font-semibold">{zh?"原始外币金额":"Original foreign amount"} ({currency})
        <input type="text" inputMode="decimal" value={foreignAmount} disabled={disabled}
          onChange={e=>onForeignAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
          />
      </label>
      {busy&&<p role="status" className="text-xs text-blue-700">{zh?"正在读取参考汇率…":"Fetching reference rate…"}</p>}
      {error&&<p role="alert" className="text-xs font-semibold text-red-700">{error}. {zh?"无法保存外币交易，请更改日期或联网后重试。":"Cannot save foreign transaction. Retry online or change date."}</p>}
      {inputError&&<p role="alert" className="text-xs text-red-700">{inputError}</p>}
      {valid&&<div className="rounded-xl bg-white p-3 text-sm">
        <p>{zh?"参考汇率":"Reference rate"}：1 {currency} = RM {quote.rate}</p>
        <p className="text-xs text-slate-500">{zh?"参考报价日期":"Published rate date"}：{quote.date} · Frankfurter v2</p>
        <p className="mt-2 text-lg font-bold">{zh?"换算后入账":"Ledger equivalent"}：{converted===null?"—":"RM "+converted.toFixed(2)}</p>
      </div>}
      <p className="text-xs text-slate-500">{zh?"参考汇率不是银行扣款汇率；保存后锁定此笔换算结果。不支持手动覆盖汇率。":"Reference rates may differ from bank debits. Saved conversions are locked. No manual rate override."}</p>
    </div>}
  </section>;
}
