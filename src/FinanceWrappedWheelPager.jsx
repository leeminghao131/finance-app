import React, { useEffect, useRef } from "react";

/**
 * Native non-passive wheel handling applies only while this Wrapped view exists.
 * Preventing browser scroll requires a real native listener, not React's passive
 * onWheel listener. No global wheel handler or document scrolling changes.
 */
export default function FinanceWrappedWheelPager({ enabled, onNavigate, children }) {
  const rootRef = useRef(null);
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  useEffect(() => {
    if (!enabled || !rootRef.current) return undefined;
    const root = rootRef.current;
    let accumulated = 0, lastInputTime = 0, lastNavigationTime = 0, lastDirection = 0;
    const wheel = event => {
      if (event.ctrlKey || event.metaKey) return; // Preserve browser zoom/pinch.
      if (event.target instanceof Element &&
        event.target.closest(".mh-wrap-details[open], select, input, textarea")) return;
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      const now = performance.now();
      if (direction !== lastDirection || now - lastInputTime > 250) accumulated = 0;
      lastDirection = direction;
      lastInputTime = now;
      if (now - lastNavigationTime < 440) return; // A short lockout stops inertial multi-page jumps without a sluggish delay.
      const amount = event.deltaMode === 1 ? event.deltaY * 16 :
        event.deltaMode === 2 ? event.deltaY * 700 : event.deltaY;
      accumulated += amount;
      if (Math.abs(accumulated) < 40) return;
      accumulated = 0;
      lastNavigationTime = now;
      navigateRef.current(direction > 0 ? 1 : -1);
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [enabled]);
  return <div ref={rootRef} className="mh-wrap">{children}</div>;
}
