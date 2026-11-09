import { localizedFinanceConfirm } from "./FinanceLanguageLayer.jsx";
import React, { useMemo, useRef, useState } from "react";
import { CSV_MAX_BYTES, inspectCsvText } from "./financeCsv.js";
import { findImportedSourceRows, importReviewedCsvRows } from "./financeImportService.js";

const btn="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50";
export default function FinanceCsvImportPanel({
  supabase,user,existingRecords,onClose,onImported,
}) {
  const fileRef=useRef(null);
  const [fileName,setFileName]=useState("");
  const [fileHash,setFileHash]=useState("");
  const [rows,setRows]=useState([]);
  const [previouslyImported,setPreviouslyImported]=useState(new Set());
  const [selected,setSelected]=useState(new Set());
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(null);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(null);
  const [visible,setVisible]=useState(100);

  const eligible=useMemo(()=>rows.filter(row=>!row.invalid&&!previouslyImported.has(row.sourceRow)),[rows,previouslyImported]);
  const invalidCount=rows.filter(row=>row.invalid).length;
  const suspiciousCount=rows.filter(row=>row.issue&&!row.invalid).length;
  const doneCount=rows.filter(row=>previouslyImported.has(row.sourceRow)).length;
  const selectedItems=eligible.filter(row=>selected.has(row.sourceRow));

  async function inspect(file) {
    if(!file)return;
    setBusy(true);setError("");setRows([]);setProgress(null);setSuccess(null);
    setSelected(new Set());setPreviouslyImported(new Set());setVisible(100);
    try {
      if(!user?.id)throw new Error("Please sign in before importing.");
      if(file.size===0 || file.size>CSV_MAX_BYTES)throw new Error("CSV must be nonempty and no larger than 8 MB.");
      const buffer=await file.arrayBuffer();
      if(!crypto?.subtle?.digest)throw new Error("Secure SHA-256 is unavailable; use HTTPS.");
      const hashBuffer=await crypto.subtle.digest("SHA-256",buffer);
      const sha=Array.from(new Uint8Array(hashBuffer),b=>b.toString(16).padStart(2,"0")).join("");
      const csvText=new TextDecoder("utf-8",{fatal:true}).decode(buffer);
      const inspected=inspectCsvText(csvText,existingRecords);
      const already=await findImportedSourceRows(supabase,user.id,sha);
      setFileName(file.name);setFileHash(sha);
      setRows(inspected);setPreviouslyImported(already);
      setSelected(new Set(inspected.filter(row=>
        !row.invalid && !row.issue && !already.has(row.sourceRow)
      ).map(row=>row.sourceRow)));
    }catch(e){setError(e.message);setFileHash("");setFileName("");}
    finally{setBusy(false);if(fileRef.current)fileRef.current.value="";}
  }

  function toggle(sourceRow) {
    setSelected(prev=>{
      const next=new Set(prev);
      if(next.has(sourceRow))next.delete(sourceRow);else next.add(sourceRow);
      return next;
    });
  }
  async function confirmImport() {
    if(!fileHash || busy || !selectedItems.length)return;
    if(!localizedFinanceConfirm("Import "+selectedItems.length+" selected records into the TEST database? No existing records will be changed or deleted."))return;
    setBusy(true);setError("");setSuccess(null);
    try {
      const result=await importReviewedCsvRows(
        supabase,fileHash,selectedItems.map(row=>row.record),setProgress
      );
      const seen=await findImportedSourceRows(supabase,user.id,fileHash);
      setPreviouslyImported(seen);
      setSelected(new Set());
      const summary={...result,alreadyPreviously:doneCount};
      setSuccess(summary);
      await onImported?.();
    }catch(e){
      setError(e.message);
      try{
        const seen=await findImportedSourceRows(supabase,user.id,fileHash);
        setPreviouslyImported(seen);
        setSelected(prev=>new Set([...prev].filter(sourceRow=>!seen.has(sourceRow))));
      }catch{ /* Keep original failure; the server uses an idempotent import key. */ }
      await onImported?.();
    }finally{setBusy(false);}
  }

  return (
    <section aria-label="CSV Import Preview" className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">CSV Import Preview / 导入预览</h2>
          <p className="mt-1 text-sm text-slate-600">
            Nothing is imported until you confirm. Existing transactions are never overwritten or deleted.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onClose} className={btn}>Close</button>
      </div>
      <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        <b>TEST MODE:</b> Use only fake data. Same-file retries skip rows already imported.
        Potential duplicate purchases can be selected individually if they were genuinely separate transactions.
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">Choose UTF-8 CSV file (max 8 MB, 20,000 records)
        <input ref={fileRef} type="file" accept=".csv,text/csv" disabled={busy}
          className="mt-2 block w-full text-sm text-slate-600"
          onChange={e=>inspect(e.target.files?.[0])}/>
      </label>
      <p className="mt-2 text-xs text-slate-500">
        Required headers: Date, Type, Category, Method, Amount, Note. Quoted commas, escaped quotes and multiline notes are supported.
      </p>
      {fileName && <p className="mt-3 break-all text-sm font-semibold text-slate-800">{fileName}</p>}
      {rows.length>0&&(
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Rows",rows.length],["Already imported",doneCount],
              ["Possible duplicates",suspiciousCount],["Invalid",invalidCount],
            ].map(([name,value])=><div key={name} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-600">{name}</p><p className="text-xl font-bold">{value}</p>
            </div>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={btn} type="button" disabled={busy} onClick={()=>
              setSelected(new Set(eligible.filter(row=>!row.issue).map(row=>row.sourceRow)))
            }>Select valid nonduplicates</button>
            <button className={btn} type="button" disabled={busy} onClick={()=>setSelected(new Set())}>Clear selection</button>
            <p className="text-sm font-semibold text-slate-700">{selectedItems.length} selected to import</p>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {rows.slice(0,visible).map(item=>{
              const imported=previouslyImported.has(item.sourceRow);
              return <div key={item.sourceRow}
                className={"rounded-xl border p-3 text-sm "+(item.invalid?"border-red-200 bg-red-50":
                  imported?"border-slate-200 bg-slate-100":item.issue?"border-amber-200 bg-amber-50":"border-slate-200 bg-white")}>
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1" disabled={busy||item.invalid||imported}
                    checked={selected.has(item.sourceRow)&&!imported} onChange={()=>toggle(item.sourceRow)}/>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="font-semibold">CSV row {item.sourceRow}</span>
                    {item.record&&<span> · {item.record.date} · {item.record.type} · {item.record.category} · RM{item.record.amount}</span>}
                    {imported?<span className="block text-xs font-bold text-slate-600">Already imported from this identical file — safely skipped</span>:
                      item.issue&&<span className={"block text-xs font-semibold "+(item.invalid?"text-red-700":"text-amber-700")}>{item.issue}</span>}
                    {item.record?.note&&<span className="block text-xs text-slate-500"><span data-i18n-ignore>{item.record.note.slice(0,180)}</span></span>}
                  </span>
                </label>
              </div>;
            })}
          </div>
          {visible<rows.length&&<button className={btn} type="button" onClick={()=>setVisible(n=>n+100)}>
            Show 100 more rows
          </button>}
          {progress&&<p role="status" className="mt-3 text-sm font-semibold text-blue-800">
            Processed {progress.processed} / {progress.total}, newly inserted {progress.inserted},
            already imported {progress.alreadyImported}
          </p>}
          {success&&<p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
            Completed: {success.inserted} added; {success.alreadyImported} already imported. No existing data was overwritten.
          </p>}
          <button type="button" disabled={busy||!selectedItems.length}
            className="mt-4 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            onClick={confirmImport}>
            {busy?"Importing...":"Confirm import "+selectedItems.length+" selected rows"}
          </button>
        </>
      )}
      {busy&&<p className="mt-3 text-sm text-blue-800" role="status">Checking or importing CSV; do not close this page until the response is confirmed.</p>}
      {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        {error} Import is safe to retry with the same file: rows already committed will be skipped.
      </p>}
    </section>
  );
}
