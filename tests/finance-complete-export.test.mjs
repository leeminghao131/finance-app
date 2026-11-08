import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildFinanceWorkbook,verifyFinanceWorkbook,safeExcelText,excelDateNumber } from "../src/financeExcel.js";

const fixture={
  records:[
    {id:1,date:"2026-10-31",type:"income",category:"Salary",method:"BANK",amount:2500.05,note:"Salary",version:1},
    {id:2,date:"2026-11-08",type:"expense",category:"Food",method:"TNG",amount:25.50,note:"Coffee, Tea",version:3},
    {id:3,date:"2026-11-09",type:"income",category:"Allowance",method:"BANK",amount:300,note:'=HYPERLINK("http://invalid.test")'},
  ],
  deletedRecords:[{id:4,date:"2026-11-08",type:"expense",category:"Food",method:"CASH",amount:10,note:"old",deleted_at:"2026-11-08T13:00:00Z"}],
  transfers:[{id:"tx1",date:"2026-11-08",fromMethod:"BANK",toMethod:"TNG",amount:100,note:"topup",version:2}],
  deletedTransfers:[{id:"tx0",date:"2026-10-20",fromMethod:"BANK",toMethod:"CASH",amount:50,deleted_at:"2026-11-08T13:00:00Z"}],
  monthRows:[
   {month:"2026-10",category_budgets:{Food:"500.00"},version:1},
   {month:"2026-11",category_budgets:{Food:"600.00",Transport:"300.00"},version:2},
  ],
  budgetTemplate:{Food:"600",Transport:"300",Medical:""},
  forecastPlans:[{id:"p1",date:"2026-11-25",amount:2500,note:"Expected salary"}],
};

function rows(book,sheet){return XLSX.utils.sheet_to_json(book.Sheets[sheet],{defval:""});}

test("Complete finance export includes 6 sheets, records/transfers/budgets/template/plans",()=>{
 const {workbook,stats}=buildFinanceWorkbook(fixture);
 assert.deepEqual(workbook.SheetNames,[
  "Finance Records","Transfers","Monthly Budgets","Budget Template","Expected Income","Export Summary"
 ]);
 assert.equal(stats.records,3);assert.equal(stats.transfers,1);
 assert.equal(stats.monthlyBudgets,2);assert.equal(stats.plans,1);
 assert.equal(stats.income,2800.05);
 assert.equal(stats.expense,25.5);
 const actual=rows(workbook,"Finance Records");
 assert.equal(actual[0]["Record ID"],"1");
 assert.equal(actual[1]["Amount (RM)"],25.5);
 assert.equal(actual[1].Note,"Coffee, Tea");
 assert.equal(actual[2].Note[0],"'");
 assert.equal(rows(workbook,"Transfers")[0]["Amount (RM)"],100);
 assert.equal(rows(workbook,"Monthly Budgets").length,3);
 assert.equal(rows(workbook,"Budget Template").length,3);
 assert.equal(rows(workbook,"Expected Income")[0].Status,"NOT ACTUAL INCOME");
 const bytes=verifyFinanceWorkbook(workbook,stats);
 assert.ok(bytes.byteLength>2000);
});

test("Month export is scoped, excludes soft-deleted data and never changes source arrays",()=>{
 const untouched=JSON.stringify(fixture);
 const {workbook,stats}=buildFinanceWorkbook({...fixture,scope:"month",month:"2026-11"});
 assert.equal(stats.records,2);
 assert.equal(stats.transfers,1);
 assert.equal(stats.monthlyBudgets,1);
 assert.equal(stats.income,300);
 assert.equal(stats.expense,25.5);
 assert.equal(rows(workbook,"Monthly Budgets").length,2);
 assert.equal(rows(workbook,"Expected Income").length,1);
 assert.equal(rows(workbook,"Finance Records").some(row=>row["Record ID"]==="4"),false);
 verifyFinanceWorkbook(workbook,stats);
 assert.equal(JSON.stringify(fixture),untouched);
});

test("Recycle Bin only appears on opt-in and is isolated from active totals",()=>{
 const {workbook,stats}=buildFinanceWorkbook({...fixture,includeRecycleBin:true});
 assert.ok(workbook.SheetNames.includes("Recycle Bin"));
 assert.ok(workbook.SheetNames.includes("Transfer Trash"));
 assert.equal(rows(workbook,"Recycle Bin").length,1);
 assert.equal(rows(workbook,"Transfer Trash").length,1);
 assert.equal(stats.expense,25.5);
 verifyFinanceWorkbook(workbook,stats);
});

test("Date numeric serial avoids Malaysia/UTC shift and user note cannot be executable formula",()=>{
 assert.equal(excelDateNumber("2026-11-08"),46334);
 assert.equal(safeExcelText("+cmd|'/C calc"),"'+cmd|'/C calc");
 assert.equal(safeExcelText("@HYPERLINK(...)"),"'@HYPERLINK(...)");
 assert.equal(safeExcelText("Lunch, coffee"),"Lunch, coffee");
 assert.throws(()=>excelDateNumber("2026-02-29"));
 const {workbook}=buildFinanceWorkbook(fixture);
 const cell=workbook.Sheets["Finance Records"].G4;
 assert.equal(cell.t,"s");
 assert.equal(cell.f,undefined);
 assert.equal(cell.v[0],"'");
});
