import React, {useEffect, useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {parseOpeningAmount} from "./financeOpeningBalance.js";

export default function FinanceOpeningBalancePanel({methods, balances, onSave, disabled}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!open) setDraft(Object.fromEntries(
    methods.map(method => [method, String(balances[method] ?? "0.00")])
  )); }, [methods, balances, open]);
  function close() {
    if (busy) return;
    if (JSON.stringify(Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,String(v)]))) !==
        JSON.stringify(Object.fromEntries(methods.map(k=>[k,String(balances[k] ?? "0.00")])))) {
      if (!window.confirm("Discard unsaved opening balance changes?")) return;
    }
    setOpen(false);setError("");
  }
  async function save(event) {
    event.preventDefault();setError("");
    try {
      const next = {...balances};
      for (const method of methods) next[method] = parseOpeningAmount(draft[method] ?? "0");
      setBusy(true);
      const ok = await onSave(next);
      if (ok) {setOpen(false);setError("");}
      else setError("Not saved. Another device may have changed the settings; review the latest balances.");
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }
  return <>
    <button type="button" disabled={disabled} onClick={()=>setOpen(true)}
      className="min-h-9 w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold leading-tight disabled:opacity-50">
      🏦 Opening Balance / 初始余额
    </button>
    <FinanceOverlay open={open} title="Opening Balance / 初始余额" onClose={close} widthClass="max-w-xl">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-600">Account starting amounts, not Income. Saved per user; historical records remain untouched. Negative values are allowed.</p>
        {methods.map(method=><label key={method} className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold" data-i18n-ignore>{method}</span>
          <input type="text" inputMode="decimal" aria-label={method+" opening balance"}
            className="w-40 rounded-xl border border-slate-300 px-3 py-2 text-right"
            value={draft[method] ?? "0.00"}
            onChange={e=>setDraft(prev=>({...prev,[method]:e.target.value}))}/>
        </label>)}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={close} className="rounded-xl border px-4 py-2">Cancel</button>
          <button type="submit" disabled={busy||disabled} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{busy?"Saving...":"Save Opening Balances"}</button>
        </div>
      </form>
    </FinanceOverlay>
  </>;
}
