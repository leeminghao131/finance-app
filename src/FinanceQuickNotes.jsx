import React, { useMemo } from "react";
import { mostUsedNotes } from "./financePlanning.js";

/**
 * Seven compact note chips in the existing space below Category.
 * Clicking one only fills the draft Note; no overlay and no database write.
 */
export default function FinanceQuickNotes({ records = [], type, category, onChoose }) {
  const suggestions = useMemo(
    () => mostUsedNotes(records, type, category, 7),
    [records, type, category],
  );

  if (!suggestions.length) return null;

  return (
    <div
      className="mt-2 flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
      aria-label="Quick Add - seven most used notes"
      title="Quick Add"
    >
      {suggestions.map(({ note, count }) => (
        <button
          key={note}
          type="button"
          onClick={() => onChoose(note)}
          title={note}
          aria-label={note}
          className="min-h-9 max-w-[140px] shrink-0 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <span data-i18n-ignore>{note}</span>
        </button>
      ))}
    </div>
  );
}
