import test from "node:test";
import assert from "node:assert/strict";
import { parseRFC4180Csv,inspectCsvText,csvRecordFingerprint } from "../src/financeCsv.js";
import { findImportedSourceRows,importReviewedCsvRows } from "../src/financeImportService.js";

test("RFC4180 parses BOM, CRLF, quoted commas, doubled quotes and multiline notes",()=>{
  const csv='\uFEFFDate,Type,Category,Method,Amount,Note\r\n'
    +'2026-11-08,Expense,"Food, Drinks",TNG,"2,500.50","Coffee, ""large""\r\nwith water"\r\n'
    +'2026-11-09,Income,Salary,BANK,1000.00,"Bonus"\r\n';
  const rows=parseRFC4180Csv(csv);
  assert.equal(rows.length,3);
  assert.equal(rows[1][2],"Food, Drinks");
  assert.equal(rows[1][5],'Coffee, "large"\nwith water');
  const inspected=inspectCsvText(csv);
  assert.equal(inspected.length,2);
  assert.equal(inspected[0].invalid,false);
  assert.equal(inspected[0].record.amount,"2500.50");
  assert.equal(inspected[0].record.note,'Coffee, "large"\nwith water');
  assert.equal(inspected[1].record.amount,"1000.00");
});
test("CSV import never guesses malformed quoting, header mapping or invalid cents/date",()=>{
  assert.throws(()=>parseRFC4180Csv('Date,Type\n"x,y'),/unclosed quoted/);
  assert.throws(()=>parseRFC4180Csv('Date,Type\n"abc"x,y'),/after a quoted/);
  assert.throws(()=>inspectCsvText("Date,Type,Category,Method,Amount\n2026-11-08,income,Salary,BANK,100"),/note/);
  const csv="Date,Type,Category,Method,Amount,Note\n"
    +"2026-02-29,expense,Food,CASH,20,Invalid leap date\n"
    +"2028-02-29,expense,Food,CASH,20.123,Invalid cents\n"
    +"2028-02-29,expense,Food,CASH,-20,Negative\n"
    +"2028-02-29,expense,Food,CASH,20.00,Valid";
  const checked=inspectCsvText(csv);
  assert.deepEqual(checked.map(row=>row.invalid),[true,true,true,false]);
  assert.equal(checked.at(-1).record.date,"2028-02-29");
});
test("Possible duplicate text is flagged but genuine identical purchases remain selectable",()=>{
 const csv="Date,Type,Category,Method,Amount,Note\n"
   +"2026-11-08,expense,Food,TNG,15.00,Lunch\n"
   +"2026-11-08,expense,Food,TNG,15.00,Lunch\n"
   +"2026-11-08,expense,Transport,BANK,50.00,Taxi";
 const reviewed=inspectCsvText(csv,[{date:"2026-11-08",type:"expense",category:"Food",method:"TNG",amount:15,note:"Lunch"}]);
 assert.equal(reviewed.length,3);
 assert.match(reviewed[0].issue,/already exists/);
 assert.match(reviewed[1].issue,/already exists|earlier/);
 assert.equal(reviewed[2].issue,null);
 assert.notEqual(csvRecordFingerprint(reviewed[0].record),csvRecordFingerprint(reviewed[2].record));
});
test("Batch service acknowledges each row, preventing silent partial success",async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{
  assert.equal(name,"finance_import_csv_rows");
  calls.push(args.p_rows);
  return {data:args.p_rows.map(row=>({source_row:row.source_row,import_status:"inserted",record_id:row.source_row})),error:null};
 }};
 const rows=Array.from({length:225},(_,i)=>({source_row:i+2,date:"2026-11-08",type:"expense",
   category:"Food",method:"CASH",amount:"1.00",note:"fixture"}));
 const progress=[];
 const result=await importReviewedCsvRows(client,"f".repeat(64),rows,x=>progress.push(x));
 assert.equal(result.inserted,225);
 assert.deepEqual(calls.map(chunk=>chunk.length),[100,100,25]);
 assert.equal(progress.at(-1).processed,225);
});
test("A disconnected retry skips previously committed rows under the same file SHA",async()=>{
 const committed=new Set();
 let shouldFail=true;
 const client={rpc:async(_,args)=>{
   const rows=args.p_rows;
   if(shouldFail && Math.min(...rows.map(row=>row.source_row))>=102){
     shouldFail=false;return {data:null,error:{message:"simulated disconnect"}};
   }
   return {data:rows.map(row=>{
     const seen=committed.has(row.source_row);committed.add(row.source_row);
     return {source_row:row.source_row,import_status:seen?"already_imported":"inserted",record_id:row.source_row};
   }),error:null};
 }};
 const rows=Array.from({length:120},(_,i)=>({source_row:i+2,date:"2026-11-08",
  type:"income",category:"Salary",method:"BANK",amount:"1.00",note:""}));
 await assert.rejects(importReviewedCsvRows(client,"f".repeat(64),rows),/retry safely/);
 assert.equal(committed.size,100);
 const result=await importReviewedCsvRows(client,"f".repeat(64),rows);
 assert.equal(result.inserted,20);assert.equal(result.alreadyImported,100);
 assert.equal(committed.size,120);
});
test("Previous source-row markers are retrieved with paging and explicit owner/source filters",async()=>{
 const all=Array.from({length:1001},(_,i)=>({source_row:i+2}));
 const calls=[];
 const client={from:(table)=>{
   assert.equal(table,"finance_import_items");
   return {select(){return this;},eq(k,v){calls.push([k,v]);return this;},
    order(k){assert.equal(k,"source_row");return this;},
    async range(a,b){return {data:all.slice(a,b+1),error:null};}};
 }};
 const rows=await findImportedSourceRows(client,"user-fixture","a".repeat(64));
 assert.equal(rows.size,1001);
 assert.ok(calls.some(([k,v])=>k==="user_id"&&v==="user-fixture"));
 assert.ok(calls.some(([k,v])=>k==="file_sha256"&&v==="a".repeat(64)));
});
