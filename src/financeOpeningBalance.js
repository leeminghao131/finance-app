// Opening balances are account starting amounts, never income records.
const sen = value => Math.round(Number(value) * 100);
export function parseOpeningAmount(value) {
  const raw = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Enter a valid RM opening balance (up to 2 decimals).");
  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Opening balance is outside the safe money range.");
  return (negative ? -amount : amount) / 100;
}
export function openingTotal(balances = {}) {
  return Object.values(balances).reduce((sum, amount) => {
    const parsed = parseOpeningAmount(amount);
    const next = sum + sen(parsed);
    if (!Number.isSafeInteger(next)) throw new Error("Opening balance total is out of range.");
    return next;
  }, 0) / 100;
}
export function calculateMethodBalances(records, transfers, accountMethods, openings = {}, normalize = value => String(value || "").trim()) {
  const map = new Map();
  const ensure = name => {
    const method = normalize(name);
    if (!method) return null;
    if (!map.has(method)) map.set(method, {method, openingBalance: 0, income: 0, expense: 0, transferIn: 0, transferOut: 0});
    return map.get(method);
  };
  accountMethods.forEach(ensure);
  for (const [method, value] of Object.entries(openings)) {
    const row = ensure(method);
    if (row) row.openingBalance += sen(parseOpeningAmount(value));
  }
  for (const record of records) {
    if (record.deleted_at) continue;
    const row = ensure(record.method);
    if (!row) continue;
    const amount = sen(record.amount);
    if (record.type === "income") row.income += amount;
    if (record.type === "expense") row.expense += amount;
  }
  for (const transfer of transfers) {
    if (transfer.deleted_at) continue;
    const amount = sen(transfer.amount);
    const from = ensure(transfer.fromMethod);
    const to = ensure(transfer.toMethod);
    if (from) from.transferOut += amount;
    if (to) to.transferIn += amount;
  }
  return [...map.values()].map(row => ({
    method: row.method,
    openingBalance: row.openingBalance / 100,
    income: row.income / 100, expense: row.expense / 100,
    transferIn: row.transferIn / 100, transferOut: row.transferOut / 100,
    balance: (row.openingBalance + row.income - row.expense + row.transferIn - row.transferOut) / 100,
  })).sort((a,b) => {
    const ai = accountMethods.indexOf(a.method), bi = accountMethods.indexOf(b.method);
    if (ai < 0 && bi < 0) return a.method.localeCompare(b.method);
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  });
}
