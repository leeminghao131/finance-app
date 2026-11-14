import { localDateMY, localMonthMY, shiftCalendarDay, calendarDaysRange, calendarMonthDays, calendarMonthEnd, inclusiveCalendarDays, previousCalendarDays, requireCalendarDate } from "./financeCalendar.js";
const cents = (n) => Math.round(Number(n || 0) * 100);
const money = (n) => Math.round(n) / 100;

export function summarizeMonthlyBudget(records, budgets, month, categoryOptions = []) {
  const expenses = records.filter((r) => r.type === "expense" && r.date?.startsWith(month) && !r.deleted_at);
  const spent = new Map();
  for (const row of expenses) spent.set(row.category, (spent.get(row.category) || 0) + cents(row.amount));
  const categories = [...new Set([...categoryOptions, ...Object.keys(budgets || {}), ...spent.keys()])];
  let budgetCents = 0, trackedCents = 0, untrackedCents = 0;
  const rows = categories.map((category) => {
    const configured = Number(budgets?.[category]);
    const limit = Number.isFinite(configured) && configured > 0 ? cents(configured) : 0;
    const used = spent.get(category) || 0;
    if (limit) { budgetCents += limit; trackedCents += used; }
    else untrackedCents += used;
    return {
      category, hasBudget: limit > 0, budget: money(limit), spent: money(used),
      remaining: limit ? money(limit - used) : null,
      usage: limit ? used / limit * 100 : null,
    };
  });
  return {
    month, rows, totalBudget: money(budgetCents), trackedExpense: money(trackedCents),
    unbudgetedExpense: money(untrackedCents), totalExpense: money(trackedCents + untrackedCents),
    usage: budgetCents ? trackedCents / budgetCents * 100 : null,
    remaining: money(budgetCents - trackedCents),
  };
}

export function normalizeBudgetsInput(budgets) {
  const saved = {};
  for (const [category, raw] of Object.entries(budgets || {})) {
    const value = String(raw ?? "").trim();
    if (value === "") { saved[category] = ""; continue; }
    if (!/^\d+(\.\d{1,2})?$/.test(value) || cents(value) < 0 || !Number.isSafeInteger(cents(value))) {
      throw new Error("Invalid RM budget for " + category + " — use a nonnegative amount up to 2 decimal places.");
    }
    saved[category] = money(cents(value)).toFixed(2);
  }
  return saved;
}

export function calculateCashForecast(records, {
  asOfDate = localDateMY(),
  selectedMonth = localMonthMY(),
  horizon = "monthEnd",
  trailingDays = 30,
  plannedIncomes = [],
  openingBalanceTotal = 0,
} = {}) {
  requireCalendarDate(asOfDate);
  if (![7, 30, 60].includes(trailingDays)) throw new Error("Unsupported trailing expense period");
  if (!["monthEnd", "30days", "90days"].includes(horizon)) throw new Error("Unsupported forecast horizon");
  const todayMonth = asOfDate.slice(0,7);
  const historical = horizon === "monthEnd" && selectedMonth < todayMonth;
  const target = horizon === "30days" ? shiftCalendarDay(asOfDate, 30)
    : horizon === "90days" ? shiftCalendarDay(asOfDate, 90)
    : calendarMonthEnd(selectedMonth);
  const signedCents = (r) => (r.type === "income" ? 1 : -1) * cents(r.amount);
  const usedRecords = records.filter((r) => !r.deleted_at && r.date && ["income","expense"].includes(r.type));
  const openingCents = cents(openingBalanceTotal);
  const currentCents = openingCents + usedRecords.filter(r => r.date <= asOfDate).reduce((sum,r) => sum + signedCents(r),0);
  const pastEndCents = historical ? openingCents + usedRecords.filter(r => r.date <= target).reduce((sum,r) => sum + signedCents(r),0) : currentCents;
  const expenseStart = previousCalendarDays(trailingDays,asOfDate);
  const expenseSum = usedRecords.filter(r => r.type==="expense" && r.date>=expenseStart && r.date<=asOfDate)
    .reduce((sum,r)=>sum+cents(r.amount),0);
  const meanDailyCents = expenseSum / trailingDays;
  const remainingDays = historical || target <= asOfDate ? 0 : inclusiveCalendarDays(shiftCalendarDay(asOfDate,1),target);
  if (remainingDays > 366) throw new Error("Choose a forecast within the next 12 months.");
  const plans = plannedIncomes.filter(p => p.date > asOfDate && p.date <= target)
    .map(p => ({...p,centAmount:cents(p.amount)}));
  const expectedCents = plans.reduce((sum,p)=>sum+p.centAmount,0);
  const projectedExpenseCents = Math.round(meanDailyCents*remainingDays);
  const projectedBalanceCents = pastEndCents + expectedCents - projectedExpenseCents;
  const actualStart = historical ? selectedMonth+"-01" : previousCalendarDays(30,asOfDate);
  const actualEnd = historical ? target : asOfDate;
  const actualDays = inclusiveCalendarDays(actualStart, actualEnd);
  const timeline = [];
  if (actualDays > 0 && actualDays <= 400) {
    const actualDates = calendarDaysRange(actualStart,actualDays);
    for (const date of actualDates) {
      const balance = openingCents + usedRecords.filter(r=>r.date<=date).reduce((sum,r)=>sum+signedCents(r),0);
      timeline.push({date,day:date.slice(5),actual:money(balance),forecast:null});
    }
  }
  if (!historical && remainingDays > 0) {
    // Connect the prediction line to the latest actual point.
    if (timeline.length) timeline[timeline.length-1].forecast = money(currentCents);
    for (let day=1;day<=remainingDays;day++) {
      const date = shiftCalendarDay(asOfDate,day);
      const scheduled = plans.filter(p=>p.date<=date).reduce((sum,p)=>sum+p.centAmount,0);
      timeline.push({
        date,day:date.slice(5),actual:null,
        forecast:money(currentCents + scheduled - Math.round(meanDailyCents*day)),
      });
    }
  }
  return {
    historical, targetDate:target, asOfDate, currentBalance:money(pastEndCents),
    averageDailyExpense:money(meanDailyCents), daysLeft:remainingDays,
    expectedIncome:money(expectedCents), expectedExpense:money(projectedExpenseCents),
    predictedBalance:money(projectedBalanceCents), timeline,
    title: historical ? "Actual month-end balance" : horizon === "monthEnd" ? "Month-end forecast" : "Next "+(horizon==="30days"?"30":"90")+" days",
    note:"Ledger estimate only; not verified bank balances. Expected income is not added to actual records.",
  };
}
