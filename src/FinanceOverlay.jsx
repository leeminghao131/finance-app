import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// A fixed viewport dialog rendered outside dashboard grids/cards.
// It never changes the document layout or clips under an overflow-hidden card.
export default function FinanceOverlay({ open, title, onClose, children, widthClass = "max-w-3xl" }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const activeBeforeOpen = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    if (scrollBarWidth) document.body.style.paddingRight = scrollBarWidth + "px";
    dialogRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      }
      // Keep keyboard focus within the visible modal.
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el => el.getClientRects().length > 0);
        if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      if (activeBeforeOpen && typeof activeBeforeOpen.focus === "function") activeBeforeOpen.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`w-full ${widthClass} min-w-0 overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none`}
        style={{ maxHeight: "calc(100dvh - 1.5rem)" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <h2 className="min-w-0 text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={() => onCloseRef.current?.()}
            aria-label={"Close " + title}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
            ✕ Close
          </button>
        </div>
        <div className="min-w-0 p-3 sm:p-4">{children}</div>
      </section>
    </div>,
    document.body
  );
}
