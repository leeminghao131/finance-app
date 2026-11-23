import {getReferenceFxRate,makeFxSnapshot} from "./financeFx.js";
import {csvRecordFingerprint} from "./financeCsv.js";

// Distinct ORIGINAL currencies/amounts remain distinct even if the dated
// reference conversion rounds both to the same MYR cents. Never skip a
// legitimate FX transaction just because its RM total happens to match.
export function csvFxAwareFingerprint(row){
  const base=csvRecordFingerprint(row);
  const currency=String(row?.fx_currency||"").trim().toUpperCase();
  if(!currency||currency==="MYR")return "MYR\u001f"+base;
  const raw=String(row.fx_amount??"").trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))
    throw new Error("Invalid original FX amount in duplicate check.");
  const [whole,fraction=""]=raw.split(".");
  const normalized=whole.replace(/^0+(?=\d)/,"")+"."+(fraction.replace(/0+$/,"")||"0");
  return "FX\u001f"+base.split("\u001f").slice(0,4).join("\u001f")+
    "\u001f"+String(row.note||"").trim()+"\u001f"+currency+"\u001f"+normalized;
}
/** Reference-only CSV FX conversion, before confirmation; no DB writes until user approves. */
export async function resolveImportedFxRows(rows,quoteFetcher=getReferenceFxRate,existingRecords=[]){
  const cache=new Map(),result=[];
  for(const item of rows){
    if(item.invalid||!item.record?.fx_currency){result.push(item);continue;}
    const row=item.record,key=row.fx_currency+"|"+row.date;
    try{
      if(!cache.has(key))cache.set(key,quoteFetcher(row.fx_currency,row.date));
      const quote=await cache.get(key);
      const snapshot=makeFxSnapshot({currency:row.fx_currency,foreignAmount:row.fx_amount,quote,recordDate:row.date});
      result.push({...item,record:{...row,...snapshot,amount:snapshot.amount.toFixed(2)},
        issue:item.issue});
    }catch(e){result.push({...item,invalid:true,record:null,issue:"FX rate unavailable: "+(e.message||String(e))});}
  }
  // Recompute duplicate warnings AFTER FX amounts have been converted to MYR.
  // FX duplicate identity compares original money; the calculated RM is display-only.
  // The initial CSV validation uses a zero placeholder for FX and must not
  // incorrectly flag two distinct original-currency amounts as duplicates.
  const known=new Set(existingRecords.map(r=>csvFxAwareFingerprint({
    date:r.date,type:r.type,category:r.category,method:r.method,amount:r.amount,note:r.note||"",
    fx_currency:r.fx_currency,fx_amount:r.fx_amount,
  })));
  const within=new Set();
  return result.map(item=>{
    if(item.invalid||!item.record)return item;
    const key=csvFxAwareFingerprint(item.record);
    const issue=known.has(key)?"Similar transaction already exists":
      within.has(key)?"Similar transaction appears earlier in this CSV":null;
    within.add(key);
    return {...item,issue};
  });
}
