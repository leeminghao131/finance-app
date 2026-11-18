import React, { useId } from "react";

// Decorative, accessible-by-parent notification emblem. Never changes alert state.
// Modeled after the metallic rings and animated energy paths in the Transfer console.
export default function FinanceNotificationEmblem({ active = false }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={"mh-notification-emblem" + (active ? " is-active" : "")} aria-hidden="true">
      <svg viewBox="0 0 52 52" width="36" height="36" focusable="false">
        <defs>
          <linearGradient id={id+"metal"} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f9dfa5"/>
            <stop offset="48%" stopColor="#bd9663"/>
            <stop offset="100%" stopColor="#5a7386"/>
          </linearGradient>
          <linearGradient id={id+"bell"} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff7da"/>
            <stop offset="52%" stopColor="#ddb06c"/>
            <stop offset="100%" stopColor="#a67645"/>
          </linearGradient>
        </defs>
        <circle className="mh-notification-emblem__halo" cx="26" cy="26" r="23" fill="none"
          stroke={"url(#"+id+"metal)"} strokeWidth="1.3" strokeDasharray="2 4"/>
        <circle className="mh-notification-emblem__ring" cx="26" cy="26" r="18.4" fill="none"
          stroke={"url(#"+id+"metal)"} strokeWidth="1.9" strokeDasharray="15 6 5 6"/>
        <circle cx="26" cy="26" r="14" fill="#1b2937" stroke="#57697b" strokeWidth="1.2"/>
        <g className="mh-notification-emblem__bell" fill={"url(#"+id+"bell)"} stroke="#ffe2a8" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M26 15.3a2.3 2.3 0 0 1 2.3 2.2v.8c4.1 1.1 5.2 4.4 5.2 7.6v3.2l2.5 3.2H16l2.5-3.2v-3.2c0-3.2 1.2-6.5 5.2-7.6v-.8a2.3 2.3 0 0 1 2.3-2.2Z"/>
          <path d="M23 34.1a3.2 3.2 0 0 0 6 0" fill="none" strokeWidth="2"/>
        </g>
        {active && <circle className="mh-notification-emblem__signal" cx="38" cy="13" r="4.1"
          fill="#ec715b" stroke="#ffe2b5" strokeWidth="1.6" />}
      </svg>
    </span>
  );
}
