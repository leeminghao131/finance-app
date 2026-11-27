// Stage 4: deterministic reference-rate conversion. All ledger totals remain MYR.
import {requireCalendarDate} from "./financeCalendar.js";
export const FX_SOURCE="frankfurter-v2";
export const FX_FAVORITES=["MYR","SGD","CNY","JPY","THB","USD","EUR","GBP","KRW","TWD","HKD","IDR","AUD","VND"];
export function currencyDigits(code){
  if(!/^[A-Z]{3}$/.test(String(code||"")))throw Error("Invalid currency code.");
  try{return new Intl.NumberFormat("en",{style:"currency",currency:code}).resolvedOptions().maximumFractionDigits;}
  catch{throw Error("Unsupported currency code.");}
}
export async function getSupportedFxCurrencies(fetcher=fetch,signal){
  const response=await fetcher("https://api.frankfurter.dev/v2/currencies",{signal});
  if(!response?.ok)throw Error("Currency catalog unavailable.");
  const data=await response.json();
  if(!Array.isArray(data))throw Error("Invalid reference currency catalog.");
  const others=data.map(item=>String(item?.iso_code||"").toUpperCase())
    .filter(code=>/^[A-Z]{3}$/.test(code)&&code!=="MYR");
  if(!others.length)throw Error("Empty reference currency catalog.");
  return [...new Set([...FX_FAVORITES,...others])];
}
export function normalizeFxInput(amount,code){
  const raw=String(amount??"").trim();
  const digits=currencyDigits(code);
  if(!/^\d+(?:\.\d+)?$/.test(raw)||raw.split(".")[1]?.length>digits)throw Error("Invalid foreign amount or currency decimal places.");
  const whole=raw.split(".")[0].replace(/^0+(?=\d)/,"");
  const normalized=whole+(raw.includes(".")?"."+raw.split(".")[1]:"");
  if(!Number.isFinite(Number(normalized))||Number(normalized)<=0||Number(normalized)>999999999999.999)
    throw Error("Foreign amount is out of range.");
  return normalized;
}
export function normalizeFxRate(rate){
  const value=Number(rate);
  if(!Number.isFinite(value)||value<=0||value>1000000000)throw Error("Invalid reference exchange rate.");
  const fixed=value.toFixed(12).replace(/0+$/,"").replace(/\.$/,"");
  if(!fixed||Number(fixed)<=0)throw Error("Exchange rate precision is insufficient.");
  return fixed;
}
function decimalParts(value){
  const [w,f=""]=String(value).split(".");
  return {value:BigInt(w+f),scale:10n**BigInt(f.length)};
}
export function convertForeignToMYR(amount,rate,currency){
  const a=decimalParts(normalizeFxInput(amount,currency));
  const b=decimalParts(normalizeFxRate(rate));
  const numerator=a.value*b.value*100n;
  const denominator=a.scale*b.scale;
  const cents=(numerator+denominator/2n)/denominator;
  if(cents<=0n||cents>99999999999999n)throw Error("Converted RM amount is out of range.");
  return Number(cents)/100;
}
export function makeFxSnapshot({currency,foreignAmount,quote,recordDate}){
  requireCalendarDate(recordDate);
  if(currency==="MYR")throw Error("MYR needs no foreign exchange snapshot.");
  if(!quote||quote.currency!==currency||quote.requestedDate!==recordDate||quote.source!==FX_SOURCE)
    throw Error("Currency rate is missing or no longer matches the transaction date.");
  requireCalendarDate(quote.date);
  if(quote.date>recordDate)throw Error("Rate date cannot be later than transaction.");
  const foreign=normalizeFxInput(foreignAmount,currency),rate=normalizeFxRate(quote.rate);
  const amount=convertForeignToMYR(foreign,rate,currency);
  return {amount,fx_currency:currency,fx_amount:foreign,fx_rate:rate,
    fx_rate_date:quote.date,fx_provider:FX_SOURCE};
}
export function foreignDetail(record){
  if(!record?.fx_currency)return null;
  return {currency:record.fx_currency,amount:String(record.fx_amount),rate:String(record.fx_rate),
    date:record.fx_rate_date,source:record.fx_provider};
}
export async function getReferenceFxRate(currency,date,fetcher=fetch,signal){
  if(currency==="MYR")throw Error("MYR is already the base currency.");
  currencyDigits(currency);
  requireCalendarDate(date);
  const malaysiaToday=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(date>malaysiaToday)throw Error("Future-date foreign exchange rates are not published.");
  const url="https://api.frankfurter.dev/v2/rate/"+encodeURIComponent(currency)+"/MYR?date="+date;
  const response=await fetcher(url,{signal});
  if(!response?.ok)throw Error("Reference rate unavailable (HTTP "+(response?.status||"unknown")+").");
  const data=await response.json();
  const effectiveDate=String(data?.date||"");
  requireCalendarDate(effectiveDate);
  if(data?.base?.toUpperCase()!==currency||data?.quote?.toUpperCase()!=="MYR"||effectiveDate>date)
    throw Error("Reference provider returned a mismatched date or currency.");
  const age=(Date.parse(date+"T00:00:00Z")-Date.parse(effectiveDate+"T00:00:00Z"))/86400000;
  if(age<0||age>7)throw Error("No recent-enough published reference rate for this date.");
  return {currency,requestedDate:date,date:effectiveDate,rate:normalizeFxRate(data.rate),source:FX_SOURCE};
}
