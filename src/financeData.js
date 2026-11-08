// Pure, testable finance data helpers. All amounts stored as MYR numbers; use integer sen to validate edits.
export function parseEditedAmount(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error("Enter a valid amount with no more than two decimal places.");
  }
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Amount must be greater than RM0 and within a safe range.");
  }
  return cents / 100;
}

export function splitRecordStatus(rows) {
  return {
    active: rows.filter((row) => !row.deleted_at),
    deleted: rows.filter((row) => Boolean(row.deleted_at)),
  };
}

/**
 * Read every owned row, 500 at a time; verify the result count before exposing totals.
 * If records change mid-read, retry instead of showing partial totals as final.
 */
export async function loadEveryOwnedRow(client, table, columns, userId, onProgress, pageSize = 500) {
  if (!userId) throw new Error("Cannot fetch finance data without a signed-in user.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error("Invalid pagination size.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { count: before, error: countError } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) throw countError;
    if (before === null || before === undefined) throw new Error("Database did not return the record count.");

    const rows = [];
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await client
        .from(table)
        .select(columns)
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Database returned an invalid page.");
      rows.push(...data);
      onProgress?.(rows.length, before, table);
      if (data.length < pageSize) break;
      if (rows.length > 250000) throw new Error("Finance records exceed the safe download limit.");
    }

    const { count: after, error: afterError } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (afterError) throw afterError;
    if (before === after && rows.length === after && new Set(rows.map((row) => String(row.id))).size === rows.length) {
      return rows;
    }
  }
  throw new Error("Finance data changed during synchronization. Please retry; no partial totals were applied.");
}
