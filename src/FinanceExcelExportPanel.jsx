import React,{useState} from "react";
import * as XLSX from "xlsx";
import { localDateMY } from "./financeCalendar.js";
import { buildFinanceWorkbook,verifyFinanceWorkbook } from "./financeExcel.js";

const button="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50";
export default function FinanceExcelExportPanel({
  records,deletedRecords,transfers,deletedTransfers,
  monthRows,budgetTemplate,forecastPlans,
  dataReady,dataLoading,onClose,
}) {
  const [scope,setScope]=useState("all");
  const [month,setMonth]=useState(localDateMY().slice(0,7));
  const [includeRecycleBin,setIncludeRecycleBin]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  function startExport(){
    if(!dataReady || dataLoading){setMessage("Wait until all cloud data finishes syncing before exporting.");return;}
    setBusy(true);setMessage("");
    try{
      const {workbook,stats}=buildFinanceWorkbook({
        records,deletedRecords,transfers,deletedTransfers,
        monthRows,budgetTemplate,forecastPlans,
        scope,month,includeRecycleBin,
      });
      // Roundtrip-check the file and financial totals before starting a download.
      verifyFinanceWorkbook(workbook,stats);
      const suffix=scope==="all"?"all":month;
      XLSX.writeFile(workbook,"MH_Finance_Export_"+suffix+"_"+localDateMY()+".xlsx");
      setMessage("Export checked: "+stats.records+" finance records, "+stats.transfers+
        " transfers, "+stats.monthlyBudgets+" budget snapshots; amounts verified.");
    }catch(e){setMessage("Export failed: "+e.message);}
    finally{setBusy(false);}
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
      aria-label="Excel Export Options">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Complete Excel Export / 完整数据导出</h2>
          <p className="mt-1 text-sm text-slate-600">
            Read-only export. No records are created, updated or deleted.
          </p>
        </div>
        <button type="button" className={button} onClick={onClose} disabled={busy}>Close</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Export scope
          <select value={scope} onChange={e=>setScope(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="all">Export All Records (recommended)</option>
            <option value="month">Export Selected Month</option>
          </select>
        </label>
        {scope==="month"&&<label className="text-sm font-semibold text-slate-700">Month
          <input type="month" className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2"
            value={month} onChange={e=>setMonth(e.target.value)}/>
        </label>}
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={includeRecycleBin} onChange={e=>setIncludeRecycleBin(e.target.checked)}/>
          Include Recycle Bin (separate sheets)
        </label>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Sheets: Finance Records, Transfers, Monthly Budgets, Budget Template,
        Expected Income, Export Summary
        {includeRecycleBin?", Recycle Bin and Transfer Trash":""}.
      </p>
      <button type="button" disabled={busy||!dataReady||dataLoading}
        onClick={startExport} className="mt-4 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy?"Verifying Excel...":"Generate and verify Excel"}
      </button>
      {!dataReady||dataLoading?<p className="mt-2 text-xs text-amber-700">
        Waiting for all cloud records before enabling exports.</p>:null}
      {message&&<p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
      <p className="mt-3 text-xs text-slate-500">
        These are readable finance data, not a full Supabase database backup.
        Keep downloaded financial files in your private, encrypted storage.
      </p>
    </section>
  );
}
