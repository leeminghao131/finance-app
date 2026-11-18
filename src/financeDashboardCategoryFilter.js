// Read-only category scope for dashboard analysis. Never mutates saved records.
// A category key is paired with its record type so names shared by expense and
// income (including custom names) can never select the wrong transactions.
export function makeDashboardCategoryChoices(expenseCategories = [], incomeCategories = []) {
  const rows = [
    ...expenseCategories.map(category => ({ type: "expense", category })),
    ...incomeCategories.map(category => ({ type: "income", category })),
  ];
  return rows.filter(item => typeof item.category === "string" && item.category.length > 0)
    .map(item => ({ ...item, key: item.type + ":" + encodeURIComponent(item.category) }));
}

export function selectedDashboardCategory(choices, key) {
  if (!key || key === "all") return null;
  return choices.find(choice => choice.key === key) || null;
}

export function categoryOnlyRows(records, selected) {
  if (!selected) return records;
  return records.filter(record =>
    record.type === selected.type && record.category === selected.category
  );
}

// Comparisons need the other transaction type as a true period baseline.
// Expense category: all period income + selected expense; income category:
// selected income + all period expense.
export function categoryComparisonRows(records, selected) {
  if (!selected) return records;
  return records.filter(record =>
    record.type !== selected.type || record.category === selected.category
  );
}
