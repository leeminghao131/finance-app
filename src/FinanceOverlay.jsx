import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The visual transition is deliberately isolated from all finance forms and their state.
export const FINANCE_MODAL_MOTION_MS = 300;
const openDialogStack = [];

function openerRect(triggerRef) {
  const el = triggerRef?.current;
  if (!el?.getBoundingClientRect) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function modalFrames(source, modalRect) {
  if (!source) {
    return [
      { transform: "translate(0, 10px) scale(0.97)", opacity: 0.5, borderRadius: "12px" },
      { transform: "translate(0, 0) scale(1)", opacity: 1, borderRadius: "16px" },
    ];
  }
  const dx = source.left - modalRect.left;
  const dy = source.top - modalRect.top;
  const sx = Math.max(0.025, Math.min(1, source.width / modalRect.width));
  const sy = Math.max(0.025, Math.min(1, source.height / modalRect.height));
  // From the exact button rectangle to the normal dialog rectangle: no 100%-viewport overshoot.
  return [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      opacity: 0.76, borderRadius: "10px",
    },
    { transform: "translate(0, 0) scale(1, 1)", opacity: 1, borderRadius: "16px" },
  ];
}

// A portal dialog: its final dimensions, content, focus trap, scroll and finance callbacks
// are unchanged. Only the journey from/to the provided trigger element is animated.
export default function FinanceOverlay({
  open, title, onClose, children, widthClass = "max-w-3xl", showTitle = true, triggerRef,
}) {
  const [mounted, setMounted] = useState(Boolean(open));
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const triggerRefRef = useRef(triggerRef);
  const originRectRef = useRef(null);
  const motionRef = useRef([]);
  const phaseRef = useRef("idle");
  const lastChildrenRef = useRef(children);
  const lastTitleRef = useRef(title);
  if (open) { lastChildrenRef.current = children; lastTitleRef.current = title; }
  const shownTitle = open ? title : lastTitleRef.current;
  onCloseRef.current = onClose;
  openRef.current = open;
  triggerRefRef.current = triggerRef;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted || typeof window === "undefined") return undefined;
    const dialog = dialogRef.current, backdrop = backdropRef.current;
    if (!dialog || !backdrop) return undefined;
    if (open && phaseRef.current === "open") return undefined;
    if (!open && phaseRef.current === "closing") return undefined;

    for (const animation of motionRef.current) animation?.cancel?.();
    motionRef.current = [];
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (open) {
      phaseRef.current = "open";
      originRectRef.current = openerRect(triggerRefRef.current);
    } else {
      phaseRef.current = "closing";
    }

    if (reduced || typeof dialog.animate !== "function") {
      if (!open) { phaseRef.current = "idle"; setMounted(false); }
      return undefined;
    }

    const frames = modalFrames(originRectRef.current, dialog.getBoundingClientRect());
    const options = {
      duration: FINANCE_MODAL_MOTION_MS,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
      direction: open ? "normal" : "reverse",
    };
    // Independent backdrop and sheet animations let the sheet appear to emerge
    // from the clicked button instead of scaling the entire application.
    const sheetMotion = dialog.animate(frames, options);
    const backdropMotion = backdrop.animate([
      { backgroundColor: "rgba(2, 6, 23, 0)" },
      { backgroundColor: "rgba(2, 6, 23, 0.55)" },
    ], options);
    motionRef.current = [sheetMotion, backdropMotion];
    sheetMotion.onfinish = () => {
      if (open) {
        // Discard the animation's fill; the original static modal styling takes over.
        sheetMotion.cancel();
        backdropMotion.cancel();
      } else {
        phaseRef.current = "idle";
        setMounted(false);
      }
    };
    return undefined;
  }, [open, mounted]);

  useEffect(() => () => {
    for (const animation of motionRef.current) animation?.cancel?.();
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") return undefined;
    const activeBeforeOpen = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    if (scrollBarWidth) document.body.style.paddingRight = scrollBarWidth + "px";
    const currentDialog = dialogRef.current;
    openDialogStack.push(currentDialog);
    currentDialog?.focus();

    const onKeyDown = event => {
      if (openDialogStack[openDialogStack.length - 1] !== currentDialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (openRef.current) onCloseRef.current?.();
      }
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
      const index = openDialogStack.lastIndexOf(currentDialog);
      if (index !== -1) openDialogStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      if (activeBeforeOpen && typeof activeBeforeOpen.focus === "function") activeBeforeOpen.focus();
    };
  }, [mounted]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5"
      onMouseDown={event => {
        if (open && event.target === event.currentTarget) onCloseRef.current?.();
      }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={shownTitle} tabIndex={-1}
        className={`w-full ${widthClass} min-w-0 overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none`}
        style={{ maxHeight: "calc(100dvh - 1.5rem)", transformOrigin: "top left", pointerEvents: open ? "auto" : "none" }}>
        <div className={`sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5 ${showTitle ? "justify-between" : "justify-end"}`}>
          <h2 className={showTitle ? "min-w-0 text-lg font-bold text-slate-900" : "sr-only"}>{shownTitle}</h2>
          <button type="button" onClick={() => { if (open) onCloseRef.current?.(); }}
            aria-label={"Close " + shownTitle}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
            ✕ Close
          </button>
        </div>
        <div className="min-w-0 p-3 sm:p-4">{open ? children : lastChildrenRef.current}</div>
      </section>
    </div>,
    document.body
  );
}
