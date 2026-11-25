import {inclusiveCalendarDays,requireCalendarDate} from "./financeCalendar.js";
import {billOccurrences} from "./financeStage2.js";
import {claimCashMovements} from "./financeClaims.js";
import {cents} from "./financeStage1Analytics.js";

// READ ONLY. Calendar overlays never create/edit a saved finance transaction.
// Actual cash and personal Expense are deliberately separate concepts.
export function financeCalendarDayGrid(days=[]) {
  if(!Array.isArray(days)||!days.length)return [];
  const first=requireCalendarDate(days[0].date);
  const weekday=new Date(first+"T00:00:00Z").getUTCDay();
  return [...Array(weekday).fill(null),...days];
}

export function financeCalendarEventsForRange({
  records=[],transfers=[],claims=[],repayments=[],bills=[],plannedIncomes=[],
  first,last,asOfDate
}={}) {
  requireCalendarDate(first);requireCalendarDate(last);requireCalendarDate(asOfDate);
  if(first>last)throw Error("Invalid financial calendar range.");
  for(const rows of [records,transfers,claims,repayments,bills,plannedIncomes])
    if(!Array.isArray(rows))throw Error("Incomplete finance calendar snapshot.");
  const inside=date=>typeof date==="string"&&date>=first&&date<=last;
  const result=[];
  const push=(row)=>{if(inside(row.date))result.push(row);};
  for(const row of records) {
    if(row.deleted_at||!["income","expense"].includes(row.type)||!inside(row.date))continue;
    requireCalendarDate(row.date);
    const sen=cents(row.amount),expense=row.type==="expense",real=row.date<=asOfDate;
    if(sen<0)throw Error("Invalid calendar record amount.");
    push({id:"record:"+row.id,sourceId:row.id,date:row.date,kind:row.type,
      title:row.category||row.type,method:row.method||"",note:row.note||"",
      amountSen:sen,cashSen:real?(expense?-sen:sen):0,
      planned:!real,status:real?"actual":"future-record"});
  }
  for(const row of transfers) {
    if(row.deleted_at||!inside(row.date))continue;
    requireCalendarDate(row.date);
    const sen=cents(row.amount);
    if(sen<0)throw Error("Invalid calendar transfer.");
    push({id:"transfer:"+row.id,sourceId:row.id,date:row.date,kind:"transfer",
      title:(row.fromMethod||row.from_method||"")+" → "+(row.toMethod||row.to_method||""),
      method:"",note:row.note||"",amountSen:sen,cashSen:0,
      planned:row.date>asOfDate,status:row.date>asOfDate?"future-record":"actual"});
  }
  const claimById=new Map(claims.map(c=>[c.id,c]));
  const repayById=new Map(repayments.map(r=>[r.id,r]));
  for(const event of claimCashMovements(claims,repayments)) {
    if(!inside(event.date))continue;
    const advance=event.kind==="advance";
    const sourceId=event.id.slice(event.id.indexOf(":")+1);
    const detail=advance?claimById.get(sourceId):claimById.get(repayById.get(sourceId)?.claim_id);
    const sen=Math.abs(event.sen),real=event.date<=asOfDate;
    push({id:event.id,sourceId:detail?.id||sourceId,date:event.date,
      kind:advance?"claim-out":"claim-in",
      title:detail?.title||"Claim",method:event.method,
      note:detail?.claimant||"",amountSen:sen,cashSen:real?event.sen:0,
      planned:!real,status:real?"actual":"future-record"});
  }
  // Generate only the visible days. A paid bill whose Expense exists is already
  // represented by its actual record; never count/show a second payment.
  const span=inclusiveCalendarDays(first,last);
  if(span>370)throw Error("Calendar event page is too large.");
  const billRows=billOccurrences(bills,first,records,0,span-1);
  for(const bill of billRows) {
    if(!inside(bill.due)||["paid","skipped"].includes(bill.status))continue;
    push({id:"bill:"+bill.id,sourceId:bill.billId,date:bill.due,kind:"bill",
      title:bill.title,method:bill.method,note:bill.category||"",
      amountSen:cents(bill.amount),cashSen:0,planned:true,
      status:bill.status==="unlinked"?"unlinked":bill.status==="snoozed"?"snoozed":bill.due<asOfDate?"overdue":"scheduled"});
  }
  for(const plan of plannedIncomes) {
    if(!inside(plan.date))continue;
    requireCalendarDate(plan.date);
    const sen=cents(plan.amount);
    if(sen<0)throw Error("Invalid expected income.");
    push({id:"expected:"+plan.id,sourceId:plan.id,date:plan.date,kind:"expected",
      title:plan.note||"Expected Income",method:"",note:"",
      amountSen:sen,cashSen:0,planned:true,
      status:plan.date<asOfDate?"past-plan":"scheduled"});
  }
  return result.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

export function financeCalendarDaySummary(events=[],date) {
  requireCalendarDate(date);
  if(!Array.isArray(events))throw Error("Invalid calendar events.");
  let incomeSen=0,expenseSen=0,cashSen=0;
  const selected=events.filter(e=>e.date===date);
  for(const event of selected) {
    cashSen+=event.cashSen;
    if(!event.planned&&event.kind==="income")incomeSen+=event.amountSen;
    if(!event.planned&&event.kind==="expense")expenseSen+=event.amountSen;
  }
  return {events:selected,incomeSen,expenseSen,cashSen};
}
