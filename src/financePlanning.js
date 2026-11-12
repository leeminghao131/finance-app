import {requireCalendarDate} from "./financeCalendar.js";

const toSen = amount => Math.round(Number(amount) * 100);
const rm = amount => Math.round(amount) / 100;
export function validateMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Choose a valid month.");
  return value;
}
export function compareFinanceMonths(records, firstMonth, secondMonth) {
  validateMonth(firstMonth); validateMonth(secondMonth);
  if (!Array.isArray(records)) throw new Error("Finance records not ready.");
  const summarize = month => {
    let income = 0, expense = 0, count = 0;
    const categories = {};
    for (const record of records) {
      if (record.deleted_at || !String(record.date || "").startsWith(month)) continue;
      if (!["income","expense"].includes(record.type)) continue;
      const amount = toSen(record.amount);
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid finance amount.");
      count++;
      if (record.type === "income") income += amount;
      else {
        expense += amount;
        categories[record.category] = (categories[record.category] || 0) + amount;
      }
      if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expense)) throw new Error("Totals exceed supported precision.");
    }
    return {month, income:rm(income), expense:rm(expense), net:rm(income-expense),count,categories};
  };
  const a=summarize(firstMonth), b=summarize(secondMonth);
  const keys=[...new Set([...Object.keys(a.categories),...Object.keys(b.categories)])]
    .sort((x,y)=>Math.max(b.categories[y]||0,a.categories[y]||0)-Math.max(b.categories[x]||0,a.categories[x]||0) || x.localeCompare(y));
  const categories=keys.map(category=>({
    category, first:rm(a.categories[category]||0),second:rm(b.categories[category]||0),
    change:rm((b.categories[category]||0)-(a.categories[category]||0)),
  }));
  return {first:a,second:b,categories,
    changes:{income:rm(toSen(b.income)-toSen(a.income)),
      expense:rm(toSen(b.expense)-toSen(a.expense)),net:rm(toSen(b.net)-toSen(a.net))}};
}
export function mostUsedNotes(records, type, category, limit=7) {
  if (!Array.isArray(records) || !["income","expense"].includes(type) || !category) return [];
  const map=new Map();
  for (const r of records) {
    if (r.deleted_at || r.type!==type || r.category!==category) continue;
    const note=String(r.note || "").trim();
    if (!note) continue;
    const item=map.get(note) || {note,count:0,latest:""};
    item.count++;
    if (String(r.date||"") > item.latest) item.latest=String(r.date||"");
    map.set(note,item);
  }
  return [...map.values()].sort((a,b)=>b.count-a.count || b.latest.localeCompare(a.latest) || a.note.localeCompare(b.note))
    .slice(0,limit).map(({note,count})=>({note,count}));
}
export function validateSavingsGoals(goals) {
  if (!Array.isArray(goals) || goals.length>50) throw new Error("Invalid savings goals list.");
  const seen=new Set();
  return goals.map(g=>{
    const id=String(g.id||"");
    const title=String(g.title||"").trim();
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || seen.has(id)) throw new Error("Invalid or duplicate goal ID.");
    seen.add(id);
    if (!title || title.length>100) throw new Error("Goal name must be 1 to 100 characters.");
    const parse=(n,positive)=>{
      const raw=String(n ?? "").trim();
      if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Enter amounts in RM with at most 2 decimals.");
      const [whole,dec=""]=raw.split(".");
      const sen=Number(whole)*100+Number(dec.padEnd(2,"0"));
      if (!Number.isSafeInteger(sen) || (positive&&sen<=0)) throw new Error("Goal amount is invalid.");
      return sen/100;
    };
    const target=parse(g.target,true),saved=parse(g.saved,false);
    const deadline=String(g.deadline||"");
    if (deadline) requireCalendarDate(deadline);
    return {id,title,target,saved,deadline};
  });
}
export function savingsGoalProgress(goal) {
  const [g]=validateSavingsGoals([goal]);
  return {remaining:rm(Math.max(0,toSen(g.target)-toSen(g.saved))),
    percent:Math.round((g.saved/g.target)*10000)/100,
    completed:g.saved>=g.target};
}

/**
 * Savings Goals use one shared, read-only available-balance estimate.
 * The current month's saved budget snapshot (or default template) is reserved
 * once. Do not write this calculated figure to any record or goal row.
 */
export function calculateSavingsAvailable(totalBalance, monthlyBudgets = {}) {
  const balanceSen = Math.round(Number(totalBalance) * 100);
  if (!Number.isFinite(Number(totalBalance)) || !Number.isSafeInteger(balanceSen)) {
    throw new Error("Invalid total balance for Savings Goals.");
  }
  if (!monthlyBudgets || typeof monthlyBudgets !== "object" || Array.isArray(monthlyBudgets)) {
    throw new Error("Invalid monthly budget for Savings Goals.");
  }
  let budgetSen = 0;
  for (const value of Object.values(monthlyBudgets)) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;
    if (!/^\\d+(?:\\.\\d{1,2})?$/.test(raw)) {
      throw new Error("Invalid monthly budget amount for Savings Goals.");
    }
    const [whole, decimals = ""] = raw.split(".");
    const amountSen = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
    if (!Number.isSafeInteger(amountSen)) {
      throw new Error("Monthly budget amount exceeds safe precision.");
    }
    budgetSen += amountSen;
    if (!Number.isSafeInteger(budgetSen)) {
      throw new Error("Monthly budget total exceeds safe precision.");
    }
  }
  const netSen = balanceSen - budgetSen;
  if (!Number.isSafeInteger(netSen)) {
    throw new Error("Savings availability exceeds safe precision.");
  }
  return {
    totalBalance: balanceSen / 100,
    monthlyBudget: budgetSen / 100,
    available: Math.max(0, netSen) / 100,
    shortfall: Math.max(0, -netSen) / 100,
    netAfterBudget: netSen / 100,
  };
}
