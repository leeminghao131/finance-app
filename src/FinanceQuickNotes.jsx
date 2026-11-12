import React from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {mostUsedNotes} from "./financePlanning.js";

/** Read-only category note suggestions; never submits or updates real records. */
export default function FinanceQuickNotes({records=[],type,category,onChoose,open,onOpen,onClose}) {
  const suggestions=React.useMemo(()=>mostUsedNotes(records,type,category,7),[records,type,category]);
  return <>
    <button type="button" disabled={!suggestions.length} onClick={onOpen}
      className="mt-2 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
      aria-haspopup="dialog" aria-expanded={Boolean(open && suggestions.length)}>
      ✨ Quick Add · Top {suggestions.length} Notes
    </button>
    <FinanceOverlay open={Boolean(open && suggestions.length)} title="Quick Add / Most used notes" widthClass="max-w-lg" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">Choose a frequently used Note for this category. Only the Note field will change.</p>
      <div className="grid gap-2">
        {suggestions.map(({note,count})=><button key={note} type="button" title={"Used "+count+" times"}
          onClick={()=>{onChoose(note);onClose();}}
          className="min-h-11 w-full break-words rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <span data-i18n-ignore>{note}</span> <span className="ml-2 text-xs font-normal text-slate-500">×{count}</span>
        </button>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">No record is created until you press Add Income / Expense.</p>
    </FinanceOverlay>
  </>;
}
