import React from "react";
import {mostUsedNotes} from "./financePlanning.js";

/** Read-only suggestions; choosing a note only edits the draft record form. */
export default function FinanceQuickNotes({records=[],type,category,onChoose}) {
  const suggestions=React.useMemo(()=>mostUsedNotes(records,type,category,7),[records,type,category]);
  return <div className="mt-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200" aria-label="Most used notes for category">
    <p className="mb-2 text-xs font-semibold text-slate-700">Quick Add / 常用备注 · Top 7</p>
    {!suggestions.length?<p className="text-xs text-slate-500">No past notes for this category. Enter your own Note below.</p>:
      <div className="flex flex-wrap gap-2">
        {suggestions.map(({note,count})=><button key={note} type="button"
          data-i18n-ignore title={"Used "+count+" times"}
          onClick={()=>onChoose(note)}
          className="max-w-full break-all rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-blue-500 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          {note} <span className="ml-1 text-xs text-slate-400">×{count}</span>
        </button>)}
      </div>}
    <p className="mt-2 text-xs text-slate-500">Tap a suggestion to fill Note. Amount, category and method stay unchanged; no record is saved until Add Income / Expense.</p>
  </div>;
}
