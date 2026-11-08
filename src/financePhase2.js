// MY personal finance date and forecast tools. All calendar days use Asia/Kuala_Lumpur.
// Transaction `date` is a YYYY-MM-DD *calendar day*, never a UTC timestamp.
export const FINANCE_TIME_ZONE = "Asia/Kuala_Lumpur";
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: FINANCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function malaysiaDate(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function malaysiaMonth(now = new Date()) { return malaysiaDate(now).slice(0, 7); }
export function malaysiaYear(now = new Date()) { return malaysiaDate(now).slice(0, 4); }

export function validCalendarDate(value) {
  const str = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [year, month, day] = str.split("-").map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCFullYear(year);
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

export function shiftCalendarDate(value, days) {
  if (!validCalendarDate(value) || !Number.isInteger(days)) throw new Error("Invalid calendar date or offset.");
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  dt.setUTCFullYear(year);
  return dt.toISOString().slice(0, 10);
}

export function daysInCalendarMonth(monthString) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthString))) throw new Error("Invalid month.");
  const [y,m] = monthString.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function recentCalendarStart(days, referenceDate = malaysiaDate()) {
  if (!Number.isInteger(days) || days < 1) throw new Error("Invalid day count.");
  return shiftCalendarDate(referenceDate, -(days - 1));
}

export function monthLastDate(monthString) {
  return monthString + "-" + String(daysInCalendarMonth(monthString)).padStart(2, "0");
}

const toSen = (v) => Math.round(Number(v || 0) * 100);
const fromSen = (v) => Math.round(v) / 100;

// Period budgets only count categories with an explicitly valid positive budget.
export function summarizeMonthlyBudget(records, configuredBudgets, monthString) {
  const budgets = configuredBudgets || {};
  const totals = new Map();
  for (const row of records || []) {
    if (row.type !== "expense" || row.deleted_at || !String(row.date || "").startsWith(monthString)) continue;
    const key = String(row.category || "");
    totals.set(key, (totals.get(key) || 0) + toSen(row.amount));
  }
  const keys = new Set([...Object.keys(budgets), ...totals.keys()]);
  const categories = [...keys].map((name) => {
    const raw = budgets[name];
    const budget = raw !== "" && raw !== null && raw !== undefined && Number.isFinite(Number(raw)) && Number(raw) > 0
      ? toSen(raw) : null;
    const spent = totals.get(name) || 0;
    return { name, budgetSen: budget, spentSen: spent, percentage: budget === null ? null : spent / budget * 100 };
  });
  const budgetSen = categories.reduce((sum,row) => sum + (row.budgetSen || 0),0);
  const budgetedSpentSen = categories.reduce((sum,row) => sum + (row.budgetSen === null ? 0 : row.spentSen),0);
  const unbudgetedSpentSen = categories.reduce((sum,row) => sum + (row.budgetSen === null ? row.spentSen : 0),0);
  return {
    month: monthString,
    budget: fromSen(budgetSen), spent: fromSen(budgetedSpentSen),
    unbudgetedSpent: fromSen(unbudgetedSpentSen),
    remaining: fromSen(budgetSen-budgetedSpentSen),
    percentage: budgetSen > 0 ? budgetedSpentSen/budgetSen*100 : null,
    categories: categories.map((row) => ({
      name: row.name,
      budget: row.budgetSen === null ? null : fromSen(row.budgetSen),
      spent: fromSen(row.spentSen),
      remaining: row.budgetSen === null ? null : fromSen(row.budgetSen-row.spentSen),
      percentage: row.percentage,
    })),
  };
}

export function forecastCashFlow({ records, expectedIncome = [], selectedMonth, referenceDate = malaysiaDate(), daysWindow = 30, horizon = "month" }) {
  if (![7,30,60].includes(daysWindow)) throw new Error("Invalid spending window.");
  if (!["month","30","90"].includes(horizon)) throw new Error("Invalid forecast horizon.");
  if (!validCalendarDate(referenceDate)) throw new Error("Invalid reference date.");
  const scopeMonth = selectedMonth || referenceDate.slice(0,7);
  const historic = scopeMonth < referenceDate.slice(0,7);
  const asOfDate = historic ? monthLastDate(scopeMonth) : referenceDate;
  const lastDate = historic ? asOfDate : horizon === "month"
    ? monthLastDate(scopeMonth < referenceDate.slice(0,7) ? referenceDate.slice(0,7) : scopeMonth)
    : shiftCalendarDate(referenceDate, Number(horizon));
  const normalized = (records || []).filter(row => !row.deleted_at && validCalendarDate(row.date));
  const actualChange = (row) => (row.type === "income" ? 1 : -1) * toSen(row.amount);
  const currentSen = normalized.filter(row => row.date <= asOfDate).reduce((sum,row) => sum + actualChange(row),0);
  const expenseStart = recentCalendarStart(daysWindow, asOfDate);
  const spentWindow = normalized.filter(row => row.type === "expense" && row.date >= expenseStart && row.date <= asOfDate)
    .reduce((sum,row) => sum + toSen(row.amount),0);
  const dailySen = Math.round(spentWindow/daysWindow);
  const validPlans = (expectedIncome || []).filter(plan => validCalendarDate(plan.date)
    && Number.isFinite(Number(plan.amount)) && Number(plan.amount) > 0 && plan.date > asOfDate && plan.date <= lastDate);
  const plansOnDate = new Map();
  for(const plan of validPlans) plansOnDate.set(plan.date, (plansOnDate.get(plan.date) || 0) + toSen(plan.amount));
  const entries = [];
  if(historic) {
    // History is real end-of-day balances, never hypothetical projections.
    const first = scopeMonth + "-01";
    let running = normalized.filter(row => row.date < first).reduce((sum,row)=>sum + actualChange(row),0);
    for(let d=first;d<=lastDate;d=shiftCalendarDate(d,1)) {
      running += normalized.filter(row => row.date===d).reduce((sum,row)=>sum+actualChange(row),0);
      entries.push({day:d, actual:fromSen(running), projected:null});
    }
    return { historic:true, currentBalance:fromSen(currentSen), predictedBalance:fromSen(currentSen),
      avgDailyExpense:fromSen(dailySen),daysLeft:0,expectedIncome:0,entries };
  }
  entries.push({day:asOfDate,actual:fromSen(currentSen),projected:fromSen(currentSen)});
  let projected = currentSen;
  let days = 0;
  for(let d=shiftCalendarDate(asOfDate,1);d<=lastDate;d=shiftCalendarDate(d,1)) {
    projected += (plansOnDate.get(d) || 0) - dailySen;
    entries.push({day:d,actual:null,projected:fromSen(projected)});
    if(++days>370) throw new Error("Forecast exceeds safe horizon.");
  }
  return {
    historic:false,currentBalance:fromSen(currentSen),predictedBalance:fromSen(projected),
    avgDailyExpense:fromSen(dailySen),daysLeft:days,
    expectedIncome:fromSen([...plansOnDate.values()].reduce((a,b)=>a+b,0)),entries,
  };
}
