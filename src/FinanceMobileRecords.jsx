import React, { useEffect, useState } from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";

const FIELDS = [
  ["date", "Date"],
  ["category", "Category"],
  ["method", "Method"],
  ["amount", "Amount (RM)"],
  ["note", "Note"],
];
const currency = (amount) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(amount || 0));
const methodOf = (record) => record.method || "—";

export default function FinanceMobileRecords({ records, onUpdate, onDelete, categoryOptionsFor, methodOptionsFor }) {
  const [editingId, setEditingId] = useState(null);
  const [field, setField] = useState("date");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const record = records.find((item) => item.id === editingId);
  const fieldValue = (item, key) => key === "method" ? methodOf(item) : item[key] ?? "";

  useEffect(() => {
    if (editingId && !record) setEditingId(null);
  }, [editingId, record]);

  function startEdit(item) {
    setEditingId(item.id);
    setField("date");
    setDraft(item.date || "");
    setConfirmDelete(null);
  }

  function chooseField(item, next) {
    if (saving) return;
    setField(next);
    setDraft(String(fieldValue(item, next)));
  }

  async function saveField() {
    if (!record || saving) return;
    if (String(fieldValue(record, field)) === draft) return;
    setSaving(true);
    try {
      // Reuse the existing version-checked updateRecord handler unchanged.
      // Keep the editor open: the handler reports conflicts/errors itself.
      await onUpdate(record.id, field, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mh-mobile-records mt-3 space-y-3 md:hidden">
      {records.map((item) => (
        <article key={item.id} className="mh-record-card rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {item.type === "income" ? "Income" : "Expense"}
              </span>
              <p className="mt-2 font-mono text-xs text-slate-500">{item.date}</p>
            </div>
            <strong className={`mh-record-amount text-right text-lg ${item.type === "income" ? "text-green-700" : "text-red-700"}`}>
              {item.type === "income" ? "+" : "−"}{currency(item.amount)}
            </strong>
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="min-w-0"><p className="text-xs text-slate-500">Category</p><p className="break-words font-semibold text-slate-800" data-i18n-ignore>{item.category}</p></div>
            <div className="min-w-0"><p className="text-xs text-slate-500">Method</p><p className="break-words font-semibold text-slate-800" data-i18n-ignore>{methodOf(item)}</p></div>
          </div>
          <div className="mt-3 min-w-0 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">Note</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700" data-i18n-ignore>{item.note || "—"}</p>
          </div>
          <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => startEdit(item)} className="mh-touch flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Edit</button>
            <button type="button" onClick={() => setConfirmDelete(confirmDelete === item.id ? null : item.id)}
              className="mh-touch flex-1 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700">
              Delete
            </button>
          </div>
          {confirmDelete === item.id && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3" role="group" aria-label="Confirm delete record">
              <p className="mb-3 text-sm font-semibold text-red-800">Move this record to Recycle Bin?</p>
              <div className="flex gap-2">
                <button type="button" className="mh-touch flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white"
                  onClick={async () => { setConfirmDelete(null); await onDelete(item.id); }}>Confirm</button>
                <button type="button" className="mh-touch flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                  onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      ))}
      <FinanceOverlay open={!!record} onClose={() => { if (!saving) setEditingId(null); }} title="Edit Transaction" widthClass="max-w-lg">
        {record && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Edit one field at a time. Each save uses the existing cloud conflict protection.</p>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => chooseField(record, key)} aria-pressed={field === key}
                  disabled={saving} className={`mh-touch rounded-xl border px-3 py-2 text-sm font-semibold ${field === key ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="block text-sm font-bold text-slate-700">
              {FIELDS.find(([key]) => key === field)?.[1]}
              {field === "category" || field === "method" ? (
                <select className="mh-record-input mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
                  value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving}>
                  {Array.from(new Set([String(fieldValue(record, field)), ...(field === "category" ? categoryOptionsFor(record.type) : methodOptionsFor(record.type))])).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field === "note" ? (
                <textarea rows={4} className="mh-record-input mt-2 w-full rounded-xl border border-slate-300 p-3 text-base"
                  value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} />
              ) : (
                <input type={field === "date" ? "date" : "text"} inputMode={field === "amount" ? "decimal" : "text"}
                  className="mh-record-input mt-2 w-full rounded-xl border border-slate-300 p-3 text-base"
                  value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} />
              )}
            </label>
            {field === "amount" && <p className="text-xs text-slate-500">Normal RM amount: 100 = RM100.00 (not cents keypad).</p>}
            <div className="flex gap-3">
              <button type="button" onClick={saveField} disabled={saving || draft === String(fieldValue(record, field))}
                className="mh-touch flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save field"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving}
                className="mh-touch rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-50">Close</button>
            </div>
            <p className="text-xs text-slate-500">Check the displayed value after saving. A cloud conflict or error will be reported by the existing record handler.</p>
          </div>
        )}
      </FinanceOverlay>
    </div>
  );
}
