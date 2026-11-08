import { requireCalendarDate } from "./financeCalendar.js";
import { parseEditedAmount } from "./financeData.js";

const EXPECTED_HEADERS = ["date","type","category","method","amount","note"];
const MAX_CSV_ROWS = 20000;
const MAX_CSV_BYTES = 8 * 1024 * 1024;

export const CSV_MAX_BYTES = MAX_CSV_BYTES;

export function parseRFC4180Csv(csvText) {
  const text = String(csvText ?? "").replace(/^\uFEFF/,"");
  if (!text.trim()) throw new Error("CSV file is empty.");
  const rows = [];
  let fields = [];
  let value = "";
  let mode = "start"; // start, plain, quoted, closed
  let position = 0;

  function finishField() { fields.push(value); value=""; mode="start"; }
  function finishRow() {
    finishField();
    if (!(fields.length===1 && fields[0]==="")) rows.push(fields);
    fields=[];
    if (rows.length>MAX_CSV_ROWS+1) throw new Error("CSV has more than 20,000 records.");
  }

  while (position < text.length) {
    const char=text[position];
    const newline = char==="\n" || char==="\r";
    if (mode==="quoted") {
      if (char==='"') {
        if (text[position+1]==='"') {value+='"';position+=2;continue;}
        mode="closed";position++;continue;
      }
      if (char==="\r" && text[position+1]==="\n") {value+="\n";position+=2;continue;}
      value+=char;position++;continue;
    }

    if (char===",") {
      finishField();position++;continue;
    }
    if (newline) {
      finishRow();
      if(char==="\r"&&text[position+1]==="\n")position++;
      position++;continue;
    }
    if (char==='"') {
      if(mode!=="start")throw new Error("Unescaped CSV quote near character " + (position+1));
      mode="quoted";position++;continue;
    }
    if (mode==="closed")throw new Error("Unexpected content after a quoted CSV field.");
    value+=char;mode="plain";position++;
  }
  if (mode==="quoted")throw new Error("CSV ends inside an unclosed quoted field.");
  if(fields.length>0 || value!=="" || mode!=="start")finishRow();
  if(rows.length===0)throw new Error("CSV has no header row.");
  return rows;
}

function normalizedAmount(value) {
  const raw=String(value ?? "").trim();
  const amountText = raw.replace(/^RM\s*/i, "");
  // Only properly grouped commas are accepted, never ambiguous 1,20.
  const grouped=/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
  if(amountText.includes(",") && !grouped.test(amountText))
    throw new Error("Invalid comma separators in amount");
  return parseEditedAmount(amountText.replace(/,/g,""));
}
export function csvRecordFingerprint(row) {
  return [
    row.date,row.type,row.category.trim().toLocaleLowerCase("en"),
    row.method.trim().toLocaleLowerCase("en"),
    Number(row.amount).toFixed(2),row.note.trim(),
  ].join("\u001f");
}

export function inspectCsvText(csvText,existingRecords=[]) {
  const rows=parseRFC4180Csv(csvText);
  const header=rows[0].map(x=>x.trim().replace(/^\uFEFF/,"").toLowerCase());
  const indices={};
  for(const col of EXPECTED_HEADERS) {
    if(header.filter(x=>x===col).length!==1)
      throw new Error("CSV must have exactly one '" + col + "' column.");
    indices[col]=header.indexOf(col);
  }
  const known=new Set(existingRecords.map((r)=>csvRecordFingerprint({
    date:r.date,type:r.type,category:String(r.category||""),
    method:String(r.method||r.fromMethod||""),amount:r.amount,note:String(r.note||""),
  })));
  const internal=new Set();
  const reviewed=[];
  for(let index=1;index<rows.length;index++) {
    const cells=rows[index];
    const sourceRow=index+1;
    try {
      if(cells.length!==header.length)throw new Error("Expected "+header.length+" columns, found "+cells.length);
      const read=(name)=>cells[indices[name]];
      const date=requireCalendarDate(read("date").trim());
      const type=read("type").trim().toLowerCase();
      if(type!=="income"&&type!=="expense")throw new Error("Type must be income or expense");
      const category=read("category").trim(), method=read("method").trim();
      if(!category || category.length>100)throw new Error("Category is missing or too long");
      if(!method || method.length>100)throw new Error("Method is missing or too long");
      const amount=normalizedAmount(read("amount"));
      if(amount>999999999999.99)throw new Error("Amount exceeds safe import range");
      const note=read("note");
      if(note.length>2000)throw new Error("Note exceeds 2,000 characters");
      const record={source_row:sourceRow,date,type,category,method,amount:amount.toFixed(2),note};
      const key=csvRecordFingerprint(record);
      const reason=known.has(key)?"Similar transaction already exists"
        :internal.has(key)?"Similar transaction appears earlier in this CSV":null;
      internal.add(key);
      reviewed.push({sourceRow,record,issue:reason,invalid:false});
    } catch(error) {
      reviewed.push({sourceRow,record:null,issue:error.message,invalid:true});
    }
  }
  return reviewed;
}
