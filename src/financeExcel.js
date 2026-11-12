import * as XLSX from "xlsx";
import { requireCalendarDate, localDateMY } from "./financeCalendar.js";
import { openingTotal, parseOpeningAmount } from "./financeOpeningBalance.js";

const HEADERS = {
  records: ["Record ID","Date","Type","Category","Method","Amount (RM)","Note","Version","Updated At"],
  transfers: ["Transfer ID","Date","From Method","To Method","Amount (RM)","Note","Version","Updated At"],
  budgets: ["Month","Category","Budget (RM)","Snapshot Version"],
  template: ["Category","Default Budget (RM)"],
  planned: ["Plan ID","Expected Date","Description","Expected Amount (RM)","Status"],
  opening: ["Method","Opening Balance (RM)"],
};
const cents = n=>Math.round(Number(n||0)*100);
const rm = c=>Math.round(c)/100;
const inMonth=(r,scope,month)=>scope==="all"||String(r.date??r.month??"").startsWith(month);

export function safeExcelText(value) {
  const text=String(value ?? "");
  // Strings like =SUM, +CMD, @... must remain inert if later copied into CSV.
  return /^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'"+text : text;
}
export function excelDateNumber(value) {
  const iso=requireCalendarDate(value);
  const [y,m,d]=iso.split("-").map(Number);
  return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000);
}
function makeSheet(workbook,name,headers,rows,dateColumns=[],amountColumns=[]) {
  const data=[headers,...rows];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const width=headers.map((title,i)=>({wch:Math.min(46,Math.max(14,title.length+4,...rows.slice(0,100).map(r=>Math.min(40,String(r[i]??"").length+2))))}));
  ws["!cols"]=width;
  if(ws["!ref"]) ws["!autofilter"]={ref:ws["!ref"]};
  for(let row=2;row<=data.length;row++){
    for(const col of dateColumns){
      const cell=ws[XLSX.utils.encode_cell({r:row-1,c:col})];
      if(cell)cell.z="yyyy-mm-dd";
    }
    for(const col of amountColumns){
      const cell=ws[XLSX.utils.encode_cell({r:row-1,c:col})];
      if(cell)cell.z="#,##0.00";
    }
  }
  XLSX.utils.book_append_sheet(workbook,ws,name);
}
function asBudgetAmount(value) {
  if(value==="" || value===null || value===undefined)return "";
  const n=Number(value);
  return Number.isFinite(n)?rm(cents(n)):"";
}

export function buildFinanceWorkbook({
  records=[],deletedRecords=[],transfers=[],deletedTransfers=[],
  monthRows=[],budgetTemplate={},forecastPlans=[],openingBalances={},
  scope="all",month=localDateMY().slice(0,7),includeRecycleBin=false,
  exportedOn=localDateMY(),
} = {}) {
  if(!["all","month"].includes(scope))throw new Error("Unknown export scope");
  if(scope==="month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("Invalid month");
  const validRecords=records.filter(r=>!r.deleted_at&&inMonth(r,scope,month));
  const validTransfers=transfers.filter(r=>!r.deleted_at&&inMonth(r,scope,month));
  const validBudgets=monthRows.filter(r=>scope==="all"||r.month===month);
  const validPlans=forecastPlans.filter(p=>inMonth(p,scope,month));

  const recordRows=validRecords.map(r=>[
    safeExcelText(r.id),excelDateNumber(r.date),safeExcelText(r.type),
    safeExcelText(r.category),safeExcelText(r.method),
    rm(cents(r.amount)),safeExcelText(r.note),Number(r.version||1),
    safeExcelText(r.updated_at),
  ]);
  const transferRows=validTransfers.map(r=>[
    safeExcelText(r.id),excelDateNumber(r.date),
    safeExcelText(r.fromMethod),safeExcelText(r.toMethod),
    rm(cents(r.amount)),safeExcelText(r.note),Number(r.version||1),
    safeExcelText(r.updated_at),
  ]);
  const monthlyRows=validBudgets.flatMap(row=>Object.entries(row.category_budgets||{})
    .map(([category,budget])=>[
      safeExcelText(row.month),safeExcelText(category),asBudgetAmount(budget),Number(row.version||1),
    ]));
  const templateRows=Object.entries(budgetTemplate).map(([category,budget])=>[
    safeExcelText(category),asBudgetAmount(budget),
  ]);
  const plannedRows=validPlans.map(p=>[
    safeExcelText(p.id),excelDateNumber(p.date),safeExcelText(p.note),
    rm(cents(p.amount)),"NOT ACTUAL INCOME",
  ]);
  const initialCents = Math.round(openingTotal(openingBalances) * 100);
  const openingRows = Object.entries(openingBalances).map(([method,amount])=>[
    safeExcelText(method),parseOpeningAmount(amount),
  ]);
  const incomeCents=validRecords.filter(r=>r.type==="income").reduce((n,r)=>n+cents(r.amount),0);
  const expenseCents=validRecords.filter(r=>r.type==="expense").reduce((n,r)=>n+cents(r.amount),0);
  const summaryRows=[
    ["Export date (MY)",exportedOn],
    ["Scope",scope==="all"?"All active records":"Selected month "+month],
    ["Active finance records",validRecords.length],
    ["Total income (RM)",rm(incomeCents)],
    ["Total expense (RM)",rm(expenseCents)],
    ["Opening balance total (RM)", rm(initialCents)],
    ["Estimated ledger balance (RM)",rm(incomeCents-expenseCents+(scope==="all"?initialCents:0))],
    ["Opening balances in selected-month subtotal","Excluded: opening amounts are not period income"],
    ["Active transfers",validTransfers.length],
    ["Saved monthly budget snapshots",validBudgets.length],
    ["Expected income plans",validPlans.length],
    ["Recycle Bin included",includeRecycleBin?"Yes":"No"],
    ["Currency","MYR"],
    ["Data protection","Read-only browser export; no database writes"],
    ["Not a full backup","This Excel file does not restore Supabase Auth, RLS or the full schema"],
  ];

  const wb=XLSX.utils.book_new();
  makeSheet(wb,"Finance Records",HEADERS.records,recordRows,[1],[5]);
  makeSheet(wb,"Transfers",HEADERS.transfers,transferRows,[1],[4]);
  makeSheet(wb,"Opening Balances",HEADERS.opening,openingRows,[],[1]);
  makeSheet(wb,"Monthly Budgets",HEADERS.budgets,monthlyRows,[],[2]);
  makeSheet(wb,"Budget Template",HEADERS.template,templateRows,[],[1]);
  makeSheet(wb,"Expected Income",HEADERS.planned,plannedRows,[1],[3]);
  makeSheet(wb,"Export Summary",["Metric","Value"],summaryRows);
  if(includeRecycleBin) {
    const oldRecords=deletedRecords.filter(r=>inMonth(r,scope,month)).map(r=>[
      safeExcelText(r.id),excelDateNumber(r.date),safeExcelText(r.type),
      safeExcelText(r.category),safeExcelText(r.method),rm(cents(r.amount)),
      safeExcelText(r.note),safeExcelText(r.deleted_at),
    ]);
    makeSheet(wb,"Recycle Bin",
      ["Record ID","Date","Type","Category","Method","Amount (RM)","Note","Deleted At"],
      oldRecords,[1],[5]);
    const oldTransfers=deletedTransfers.filter(r=>inMonth(r,scope,month)).map(r=>[
      safeExcelText(r.id),excelDateNumber(r.date),safeExcelText(r.fromMethod),
      safeExcelText(r.toMethod),rm(cents(r.amount)),safeExcelText(r.note),safeExcelText(r.deleted_at),
    ]);
    makeSheet(wb,"Transfer Trash",
      ["Transfer ID","Date","From Method","To Method","Amount (RM)","Note","Deleted At"],
      oldTransfers,[1],[4]);
  }
  // Capture every cell from every generated sheet as an independent
  // round-trip expectation, not just Income/Expense totals.
  const expectedSheets = Object.fromEntries(wb.SheetNames.map(name => [
    name, XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1,defval:""})
      .map(row => row.map(value => value instanceof Date
        ? excelDateNumber(value.toISOString().slice(0,10)) : value)),
  ]));
  return {workbook:wb,stats:{
    records:validRecords.length,transfers:validTransfers.length,
    monthlyBudgets:validBudgets.length,plans:validPlans.length,
    income:rm(incomeCents),expense:rm(expenseCents),openingTotalCents:initialCents,
    transferTotalCents:validTransfers.reduce((n,r)=>n+cents(r.amount),0),
    plannedTotalCents:validPlans.reduce((n,p)=>n+cents(p.amount),0),
    budgetTotalCents:validBudgets.reduce((n,r)=>n+Object.values(r.category_budgets||{})
      .reduce((s,value)=>s+(value===""?0:cents(value)),0),0),
    expectedSheets,
  }};
}

export function verifyFinanceWorkbook(workbook,stats) {
  // Verify serialization, row counts and cents before offering a download.
  const data=XLSX.write(workbook,{bookType:"xlsx",type:"array"});
  if(!data || data.byteLength<100)throw new Error("Excel generation failed");
  const roundtrip=XLSX.read(data,{type:"array",cellDates:false});
  for (const [name, expected] of Object.entries(stats.expectedSheets || {})) {
    if (!roundtrip.Sheets[name]) throw new Error("Excel verification failed: missing sheet " + name);
    const actual=XLSX.utils.sheet_to_json(roundtrip.Sheets[name],{header:1,defval:""});
    if (JSON.stringify(actual)!==JSON.stringify(expected)) {
      const index=expected.findIndex((row,i)=>JSON.stringify(row)!==JSON.stringify(actual[i]));
      const row=expected[index]||[], other=actual[index]||[];
      const col=row.findIndex((value,i)=>JSON.stringify(value)!==JSON.stringify(other[i]));
      throw new Error("Excel verification failed: cell data changed in " + name
        + " at row " + (index+1) + " column " + (col+1)
        + " (expected type " + typeof row[col] + ", actual type " + typeof other[col] + ")");
    }
  }
  const count=(sheet)=>XLSX.utils.sheet_to_json(roundtrip.Sheets[sheet],{defval:""}).length;
  if(count("Finance Records")!==stats.records || count("Transfers")!==stats.transfers)
    throw new Error("Excel verification failed: an entry was missing");
  if(!roundtrip.SheetNames.includes("Export Summary"))throw new Error("Export Summary missing");
  const moneyRows=XLSX.utils.sheet_to_json(roundtrip.Sheets["Finance Records"],{defval:""});
  const inc=moneyRows.filter(r=>r.Type==="income").reduce((n,r)=>n+cents(r["Amount (RM)"]),0);
  const exp=moneyRows.filter(r=>r.Type==="expense").reduce((n,r)=>n+cents(r["Amount (RM)"]),0);
  if(rm(inc)!==stats.income||rm(exp)!==stats.expense)throw new Error("Export amount total mismatch");
  const sumSheet=(name,field)=>XLSX.utils.sheet_to_json(roundtrip.Sheets[name],{defval:""})
    .reduce((sum,row)=>sum+cents(row[field]),0);
  if(sumSheet("Opening Balances","Opening Balance (RM)")!==stats.openingTotalCents ||
     sumSheet("Transfers","Amount (RM)")!==stats.transferTotalCents ||
     sumSheet("Monthly Budgets","Budget (RM)")!==stats.budgetTotalCents ||
     sumSheet("Expected Income","Expected Amount (RM)")!==stats.plannedTotalCents) {
    throw new Error("Excel verification failed: transfer, budget or expected income amounts differ");
  }
  return data;
}
