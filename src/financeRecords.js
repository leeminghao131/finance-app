// Exact finance record wire-data transforms extracted without changing stored values.
export function normalizeRecord(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount || 0),
    category: row.category,
    method: row.method,
    note: row.note || "",
    date: row.date,
    version: Number(row.version || 1),
    updated_at: row.updated_at || row.created_at,
    deleted_at: row.deleted_at || null,
  };
}
export function normalizeTransfer(row) {
  return {
    id: row.id,
    fromMethod: row.from_method,
    toMethod: row.to_method,
    amount: Number(row.amount || 0),
    note: row.note || "",
    date: row.date,
    version: Number(row.version || 1),
    deleted_at: row.deleted_at || null,
    updated_at: row.updated_at || row.created_at,
  };
}
export function toRecordPayload(record, userId) {
  return {
    user_id: userId,
    type: record.type,
    amount: Number(record.amount || 0),
    category: record.category,
    method: record.method,
    note: record.note || "",
    date: record.date,
  };
}

