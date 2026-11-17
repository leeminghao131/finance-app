import {getReferenceFxRate,makeFxSnapshot} from "./financeFx.js";
import {csvRecordFingerprint} from "./financeCsv.js";
/** Reference-only CSV FX conversion, before confirmation; no DB writes until user approves. */
export async function resolveImportedFxRows(rows,quoteFetcher=getReferenceFxRate){
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
  return result;
}
