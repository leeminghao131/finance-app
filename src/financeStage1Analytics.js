import {localDateMY} from "./financeCalendar.js";

// All amounts are computed in integer sen. Read-only helpers never write records.
export const cents = value => {
  const n=Number(value);
  const s=Math.round(n*100);
  if(!Number.isFinite(n)||!Number.isSafeInteger(s)||Math.abs(n*100-s)>0.00001)
    throw new Error("Invalid RM amount for analysis.");
  return s;
};
export const rm = s => s/100;
export const money = n => new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const monthRegex=/^\d{4}-(0[1-9]|1[0-2])$/;
export function validMonth(month){
  if(typeof month!=="string"||!monthRegex.test(month))throw new Error("Choose a valid YYYY-MM month.");
  return month;
}
export function validDate(date){
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Choose a valid date.");
  const d=new Date(date+"T00:00:00Z");
  if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date)throw new Error("Choose a valid calendar date.");
  return date;
}
export function addMonths(month,count){
  validMonth(month);
  const [year,mon]=month.split("-").map(Number);
  const d=new Date(Date.UTC(year,mon-1+count,1));
  return d.toISOString().slice(0,7);
}
export function monthEnd(month){
  validMonth(month);
  const [y,m]=month.split("-").map(Number);
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}
const dayIndex=date=>Date.parse(validDate(date)+"T00:00:00Z")/86400000;
const recordsOf=records=>{
  if(!Array.isArray(records))throw new Error("Complete finance records are unavailable.");
  return records.filter(r=>r&&!r.deleted_at&&["income","expense"].includes(r.type));
};
function groupedSums(records,first,last){
  let income=0,expense=0,count=0;const categories=new Map(),methods=new Map(),notes=new Map(),days=new Map();
  const largest=[];
  for(const row of recordsOf(records)){
    if(row.date<first||row.date>last)continue;
    validDate(row.date);
    const amount=cents(row.amount);
    if(amount<0)throw new Error("Negative finance amount in analysis.");
    count++;
    if(row.type==="income")income+=amount;
    else{
      expense+=amount;
      categories.set(row.category,(categories.get(row.category)||0)+amount);
      const method=String(row.method||"Unknown");
      methods.set(method,(methods.get(method)||0)+amount);
      const note=String(row.note||"").trim();
      if(note)notes.set(note,(notes.get(note)||0)+1);
      largest.push({id:row.id,date:row.date,category:row.category,note,amount:rm(amount)});
    }
    const day=days.get(row.date)||{date:row.date,income:0,expense:0};
    day[row.type]+=amount;days.set(row.date,day);
    if(!Number.isSafeInteger(income)||!Number.isSafeInteger(expense))throw new Error("Analysis totals exceed safe precision.");
  }
  const ranking=(map)=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([name,value])=>({name,value:rm(value)}));
  const trend=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date))
    .map(d=>({date:d.date,income:rm(d.income),expense:rm(d.expense)}));
  largest.sort((a,b)=>b.amount-a.amount||b.date.localeCompare(a.date));
  return {income:rm(income),expense:rm(expense),net:rm(income-expense),count,
    categories:ranking(categories),methods:ranking(methods),
    notes:[...notes.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,7).map(([name,count])=>({name,count})),
    largest:largest.slice(0,5),trend};
}

export function forecastBudgetBurnRate(records,budgets,month,asOfDate=localDateMY(),categoryOptions=[]){
  validMonth(month);validDate(asOfDate);
  if(!budgets||typeof budgets!=="object"||Array.isArray(budgets))throw new Error("Budget snapshot is unavailable.");
  const end=monthEnd(month),start=month+"-01";
  const historical=end<asOfDate, future=start>asOfDate;
  const effectiveDay=historical?end:future?null:asOfDate;
  const elapsed=effectiveDay?dayIndex(effectiveDay)-dayIndex(start)+1:0;
  const totalDays=dayIndex(end)-dayIndex(start)+1;
  const remainingDays=historical?0:future?totalDays:totalDays-elapsed;
  const eligible=recordsOf(records).filter(r=>r.type==="expense"&&r.date>=start&&r.date<=String(effectiveDay||end));
  const map=new Map();
  for(const row of eligible){validDate(row.date);const n=cents(row.amount);if(n<0)throw new Error("Negative Expense.");
    const bucket=map.get(row.category)||[];bucket.push({date:row.date,amount:n});map.set(row.category,bucket);}
  const cats=[...new Set([...categoryOptions,...Object.keys(budgets),...map.keys()])];
  const rows=cats.map(category=>{
    const entries=map.get(category)||[];
    const spent=entries.reduce((a,b)=>a+b.amount,0);
    const raw=budgets[category];
    const budget=raw==null||String(raw).trim()===""?0:cents(raw);
    if(budget<0)throw new Error("Negative budget.");
    const recentDays=Math.min(7,elapsed);
    const from=effectiveDay?new Date((dayIndex(effectiveDay)-recentDays+1)*86400000).toISOString().slice(0,10):"";
    const recent=entries.filter(e=>e.date>=from).reduce((a,b)=>a+b.amount,0);
    const monthlyRate=elapsed?spent/elapsed:0;
    const recentRate=recentDays?recent/recentDays:0;
    const extrapolate=rate=>rm(Math.round(spent+rate*remainingDays));
    const remaining=budget-spent;
    return {category,hasBudget:budget>0,spent:rm(spent),budget:rm(budget),
      remaining:budget>0?rm(remaining):null,
      usage:budget>0?Math.round(spent/budget*1000)/10:null,
      projectedMonth:effectiveDay?extrapolate(monthlyRate):null,
      projectedRecent:effectiveDay?extrapolate(recentRate):null,
      likelyOver:budget>0&&effectiveDay?rm(Math.max(0,Math.round(spent+monthlyRate*remainingDays)-budget)):null,
      safeDaily:budget>0&&remainingDays>0?rm(Math.floor(Math.max(0,remaining)/remainingDays)):null,
      recentDays, insufficient:elapsed<3, historical, future};
  });
  return {month,asOfDate,elapsed,totalDays,remainingDays,rows,historical,future,
    note:historical?"Historical month: actual amounts, not forecasts."
      :future?"Future month: no current spend rate available."
      :elapsed<3?"Early-month projections are unstable.":"Estimates based only on recorded spending; not guarantees."};
}
const validAmountInput=(raw)=>{
  if(raw===null||raw===undefined||raw==="")return null;
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(raw).trim()))throw new Error("Use a nonnegative RM amount with up to 2 decimals.");
  return cents(String(raw).trim());
};
export const emptyAdvancedFilter=()=>({from:"",to:"",type:"all",categories:[],methods:[],min:"",max:"",keyword:"",sort:"newest"});
export function validateAdvancedFilter(f){
  if(!f||typeof f!=="object"||Array.isArray(f))throw new Error("Invalid advanced filter.");
  const from=f.from?validDate(f.from):"",to=f.to?validDate(f.to):"";
  if(from&&to&&from>to)throw new Error("Start date must not be after end date.");
  const type=f.type||"all";if(!["all","income","expense"].includes(type))throw new Error("Invalid transaction type.");
  const cleanOptions=x=>{
    if(!Array.isArray(x)||x.length>40||x.some(v=>typeof v!=="string"||!v.trim()||v.length>100))
      throw new Error("Invalid Category or Method selection.");
    return [...new Set(x)].slice(0,40);
  };
  const min=validAmountInput(f.min),max=validAmountInput(f.max);
  if(min!==null&&max!==null&&min>max)throw new Error("Minimum amount exceeds maximum.");
  const sort=f.sort||"newest";
  if(!["newest","oldest","amountHigh","amountLow"].includes(sort))throw new Error("Unsupported transaction sorting.");
  const keyword=String(f.keyword||"").trim();
  if(keyword.length>160)throw new Error("Search text is too long.");
  return {from,to,type,categories:cleanOptions(f.categories||[]),methods:cleanOptions(f.methods||[]),
    min:min===null?"":rm(min).toFixed(2),max:max===null?"":rm(max).toFixed(2),keyword,sort};
}
export function filterFinanceRecordsAdvanced(records,filters){
  const f=validateAdvancedFilter(filters);
  const min=validAmountInput(f.min),max=validAmountInput(f.max);
  const needle=f.keyword.toLocaleLowerCase();
  return recordsOf(records).filter(r=>{
    const d=String(r.date||"");
    if(f.from&&d<f.from||f.to&&d>f.to)return false;
    if(f.type!=="all"&&f.type!==r.type)return false;
    if(f.categories.length&&!f.categories.includes(r.category))return false;
    if(f.methods.length&&!f.methods.includes(r.method))return false;
    const amount=cents(r.amount);
    if(min!==null&&amount<min||max!==null&&amount>max)return false;
    return !needle||[r.note,r.category,r.method,r.date,r.type].some(v=>String(v||"").toLocaleLowerCase().includes(needle));
  }).sort((a,b)=>{
    if(f.sort==="amountHigh"||f.sort==="amountLow"){
      const difference=cents(a.amount)-cents(b.amount);
      return (f.sort==="amountLow"?difference:-difference)||String(b.date).localeCompare(String(a.date));
    }
    const date=String(b.date).localeCompare(String(a.date));
    return (f.sort==="oldest"?-date:date)||String(b.created_at||"").localeCompare(String(a.created_at||""));
  });
}
export function validateSavedFilters(value){
  if(!Array.isArray(value)||value.length>20)throw new Error("No more than 20 saved filters.");
  const seen=new Set();
  return value.map(v=>{
    const id=String(v?.id||""),name=String(v?.name||"").trim();
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id)||seen.has(id))throw new Error("Invalid or duplicate saved filter ID.");
    seen.add(id);
    if(!name||name.length>60)throw new Error("Saved filter name must be 1 to 60 characters.");
    return {id,name,filters:validateAdvancedFilter(v.filters)};
  });
}
export function financeWrapped(records,{mode="monthly",month=localDateMY().slice(0,7),quarterStart=month,year=localDateMY().slice(0,4)}={}){
  let first,last,previousFirst,previousLast,label;
  if(mode==="monthly"){
    validMonth(month);first=month+"-01";last=monthEnd(month);
    const prev=addMonths(month,-1);previousFirst=prev+"-01";previousLast=monthEnd(prev);label=month;
  }else if(mode==="quarterly"){
    validMonth(quarterStart);first=quarterStart+"-01";const ending=addMonths(quarterStart,2);last=monthEnd(ending);
    const prev=addMonths(quarterStart,-3),prevEnd=addMonths(quarterStart,-1);
    previousFirst=prev+"-01";previousLast=monthEnd(prevEnd);label=quarterStart+" — "+ending;
  }else if(mode==="yearly"){
    if(!/^\d{4}$/.test(String(year)))throw new Error("Choose a valid year.");
    first=year+"-01-01";last=year+"-12-31";
    previousFirst=(Number(year)-1)+"-01-01";previousLast=(Number(year)-1)+"-12-31";label=String(year);
  }else throw new Error("Unknown Wrapped mode.");
  const current=groupedSums(records,first,last),previous=groupedSums(records,previousFirst,previousLast);
  return {mode,label,first,last,current,previous,
    changes:{income:rm(cents(current.income)-cents(previous.income)),
      expense:rm(cents(current.expense)-cents(previous.expense)),
      net:rm(cents(current.net)-cents(previous.net))},
    daysWithRecords:new Set(current.trend.map(v=>v.date)).size,
    disclaimer:"Based on saved records only. Missing entries cannot be inferred; Transfers and Expected Income are excluded."};
}
export function simulateFinanceScenarios(records,{
  currentBalance=0,asOfDate=localDateMY(),months=12,incomeAdjustment=0,expenseReduction=0,extraExpense=0,
}={}){
  validDate(asOfDate);
  if(![3,6,12,24].includes(Number(months)))throw new Error("Choose 3, 6, 12 or 24 months.");
  const adjustIncome=cents(incomeAdjustment),reduceExpense=cents(expenseReduction),addExpense=cents(extraExpense);
  if(adjustIncome<0||reduceExpense<0||addExpense<0)throw new Error("Scenario adjustments must be nonnegative.");
  const end=dayIndex(asOfDate),first=new Date((end-89)*86400000).toISOString().slice(0,10);
  const snapshot=groupedSums(records,first,asOfDate),balance=cents(currentBalance);
  const incomePerMonth=Math.round(cents(snapshot.income)*30/90),expensePerMonth=Math.round(cents(snapshot.expense)*30/90);
  const change=adjustIncome+reduceExpense-addExpense;
  const baseline=[],scenario=[];
  for(let i=0;i<=Number(months);i++){
    baseline.push({month:i,balance:rm(balance+(incomePerMonth-expensePerMonth)*i)});
    scenario.push({month:i,balance:rm(balance+(incomePerMonth-expensePerMonth+change)*i)});
  }
  return {baseline,scenario,startingBalance:rm(balance),historicalDays:90,
    historicIncome:rm(incomePerMonth),historicExpense:rm(expensePerMonth),
    monthlyImprovement:rm(change),finalDifference:rm(change*Number(months)),
    sampleRecords:snapshot.count,estimated:true,
    disclaimer:"Illustrative linear projection based on the past 90 days of recorded transactions, normalized to 30-day months. No bills, inflation, interest or missing transactions assumed."};
}
