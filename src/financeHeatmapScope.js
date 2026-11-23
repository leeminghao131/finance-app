import {calendarMonthDays,requireCalendarDate} from "./financeCalendar.js";

// Read-only month navigator. YEAR exposes all 12 calendar months (including
// dates with zero transactions); ALL exposes every month between the earliest
// and latest real saved record, with NO arbitrary 35-day truncation.
// Only the visible 28-31 calendar cells are rendered at a time on Android.
export function heatmapMonthIndex(month) {
  if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(month||"")))
    throw Error("Invalid heatmap month.");
  const [year,m]=month.split("-").map(Number);
  return year*12+m-1;
}
export function heatmapMonthFromIndex(index) {
  if(!Number.isSafeInteger(index)||index<12||index>120000)
    throw Error("Heatmap month outside supported calendar range.");
  const year=Math.floor(index/12),m=index%12+1;
  return String(year).padStart(4,"0")+"-"+String(m).padStart(2,"0");
}
export function heatmapScopeMonths(mode,records,selectedYear) {
  if(mode==="year"){
    const year=String(selectedYear);
    if(!/^\d{4}$/.test(year))return null;
    return {first:year+"-01",last:year+"-12"};
  }
  if(mode!=="all")return null;
  const months=[];
  for(const record of Array.isArray(records)?records:[]){
    const date=String(record?.date||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    try{requireCalendarDate(date);}catch{continue;}
    months.push(date.slice(0,7));
  }
  if(!months.length)return null;
  months.sort();
  return {first:months[0],last:months[months.length-1]};
}

export function heatmapPageMonth(scope,requested,asOfDate) {
  if(!scope)return null;
  const current=String(asOfDate||"").slice(0,7);
  const chosen=String(requested||"");
  if(chosen>=scope.first&&chosen<=scope.last&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(chosen))
    return chosen;
  return current>=scope.first&&current<=scope.last?current:scope.last;
}
export function heatmapShiftMonth(month,delta,scope) {
  if(!scope||!Number.isInteger(delta))return null;
  const target=heatmapMonthIndex(month)+delta;
  if(target<heatmapMonthIndex(scope.first)||target>heatmapMonthIndex(scope.last))
    return null;
  return heatmapMonthFromIndex(target);
}
export function heatmapMonthCalendarDays(month,days) {
  const count=calendarMonthDays(month);
  const amounts=new Map((Array.isArray(days)?days:[])
    .filter(d=>d&&typeof d.date==="string"&&d.date.startsWith(month+"-"))
    .map(d=>[d.date,Number(d.amount)||0]));
  return Array.from({length:count},(_,i)=>{
    const date=month+"-"+String(i+1).padStart(2,"0");
    return {date,amount:amounts.get(date)||0};
  });
}
