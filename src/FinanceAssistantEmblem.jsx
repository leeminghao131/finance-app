import React, { useId } from "react";

/** Decorative transfer-console-inspired steampunk robot; no finance actions or data. */
export default function FinanceAssistantEmblem({ compact = false }) {
  const id = useId().replace(/:/g, "");
  const brass = id + "brass";
  const steel = id + "steel";
  const eye = id + "eye";
  return (
    <span className={"mh-steampunk-assistant-emblem" + (compact ? " is-compact" : "")} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="presentation" focusable="false">
        <defs>
          <linearGradient id={brass} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff0bb"/>
            <stop offset=".49" stopColor="#ddb06b"/>
            <stop offset="1" stopColor="#865633"/>
          </linearGradient>
          <linearGradient id={steel} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#637688"/>
            <stop offset=".55" stopColor="#29394b"/>
            <stop offset="1" stopColor="#151f2d"/>
          </linearGradient>
          <radialGradient id={eye}>
            <stop offset="0" stopColor="#ddfff5"/>
            <stop offset=".42" stopColor="#7ff4dd"/>
            <stop offset="1" stopColor="#23a99d"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill="none" stroke={"url(#"+brass+")"}
          strokeWidth="1.4" strokeDasharray="2 5" className="mh-steampunk-assistant-emblem__orbit"/>
        <circle cx="32" cy="32" r="25" fill="#1d2d3e" stroke="#9f8057" strokeWidth="1.4"/>
        <g className="mh-steampunk-assistant-emblem__gear" fill={"url(#"+brass+")"} stroke="#ffdda0" strokeWidth=".75">
          <path d="M32 4 34.2 7.4 38.2 8 39 12 42.8 13.4 42.2 17.2 45.4 19.7
            44 23.3 46.6 26.5 44.6 29.8 46 33.7 43 36.1 43 40 39.3 41.1
            38 45 34.1 44.8 32 48 29.7 44.8 25.8 45 24.7 41.2 21 40
            21.1 36.1 18 33.7 19.5 29.8 17.4 26.5 20 23.3 18.6 19.7
            21.9 17.2 21.3 13.4 25.2 12 25.9 8 29.7 7.4Z"
            fillOpacity=".22" transform="translate(0 3)"/>
        </g>
        <rect x="19" y="43" width="26" height="9" rx="4" fill={"url(#"+steel+")"} stroke="#c2a078" strokeWidth="1.2"/>
        <rect x="13" y="25" width="9" height="15" rx="4" fill={"url(#"+brass+")"} stroke="#fce6b4" strokeWidth="1"/>
        <rect x="42" y="25" width="9" height="15" rx="4" fill={"url(#"+brass+")"} stroke="#fce6b4" strokeWidth="1"/>
        <circle cx="17" cy="32" r="2.5" fill="#344b58" stroke="#ffe5ac" strokeWidth=".9"/>
        <circle cx="47" cy="32" r="2.5" fill="#344b58" stroke="#ffe5ac" strokeWidth=".9"/>
        <path d="M28 15V11h8v4" stroke={"url(#"+brass+")"} strokeWidth="3" fill="none"/>
        <circle cx="32" cy="10" r="3.2" fill="#b98145" stroke="#f9dca2" strokeWidth="1"/>
        <rect x="19" y="17" width="26" height="29" rx="9" fill={"url(#"+brass+")"} stroke="#ffedbc" strokeWidth="1.15"/>
        <rect x="22.3" y="20.5" width="19.4" height="21" rx="6.5" fill={"url(#"+steel+")"} stroke="#735b49" strokeWidth=".8"/>
        <g className="mh-steampunk-assistant-emblem__eyes">
          <circle cx="27.4" cy="29.6" r="4.8" fill="#141f2a" stroke="#e2b47b" strokeWidth="1.3"/>
          <circle cx="36.6" cy="29.6" r="4.8" fill="#141f2a" stroke="#e2b47b" strokeWidth="1.3"/>
          <circle cx="27.4" cy="29.6" r="2.8" fill={"url(#"+eye+")"}/>
          <circle cx="36.6" cy="29.6" r="2.8" fill={"url(#"+eye+")"}/>
          <circle cx="26.6" cy="28.7" r=".8" fill="#fff"/>
          <circle cx="35.8" cy="28.7" r=".8" fill="#fff"/>
        </g>
        <path d="M25 37h14" stroke="#bd925f" strokeWidth="1" strokeLinecap="round"/>
        <path d="M27 36v4m3-4v4m3-4v4m3-4v4" stroke="#80d9d4" strokeWidth="1" strokeLinecap="round"/>
        <circle cx="21" cy="42" r="1" fill="#fff0b6"/>
        <circle cx="43" cy="42" r="1" fill="#fff0b6"/>
        <path d="M26 51v4m12-4v4" stroke="#c89c60" strokeWidth="2.7" strokeLinecap="round"/>
        <path d="M21 56h22" stroke="#b18e5b" strokeWidth="2.1" strokeLinecap="round"/>
      </svg>
    </span>
  );
}
