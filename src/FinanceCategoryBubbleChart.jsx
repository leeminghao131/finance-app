
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFinanceLanguage } from "./FinanceLanguageLayer.jsx";
import { builtInFinanceCategory } from "./financeLanguage.js";

const SHADES = ["#7A8698", "#269A75", "#C96A75", "#BD9A45", "#799DC0", "#9D82B0", "#CE88A4", "#509AA2", "#A19B7C"];
const KNOWN = { "住房": 0, "饮食": 1, "娱乐": 2, "交通": 3, "医疗": 4, "教育": 5, "美容": 6, "运动": 7, "日用": 8 };
const money = n => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cap = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
function shadeFor(name) {
  if (Object.prototype.hasOwnProperty.call(KNOWN, name)) return SHADES[KNOWN[name]];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return SHADES[hash % SHADES.length];
}
function labelLines(text, radius) {
  if (radius < 34) return [];
  const maxChars = radius > 75 ? 15 : radius > 49 ? 10 : 7;
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  if (words.length > 1) {
    const half = Math.ceil(words.length / 2);
    return [words.slice(0, half).join(" "), words.slice(half).join(" ")].filter(Boolean)
      .map(line => line.length > maxChars ? line.slice(0, maxChars - 1) + "…" : line);
  }
  return [text.slice(0, maxChars - 1) + "…"];
}
function makeParticles(items, width, height) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const maxShare = Math.max(...items.map(item => item.value / total));
  const scale = Math.min(
    Math.sqrt(width * height * 0.31 / Math.PI),
    height * 0.36 / Math.sqrt(maxShare),
    width * 0.42 / Math.sqrt(maxShare)
  );
  const bodies = items.map((item, index) => {
    const radius = scale * Math.sqrt(item.value / total);
    const angle = index * 2.399963229728653;
    return {
      ...item, radius, mass: Math.max(1, radius * radius),
      x: cap(width / 2 + Math.cos(angle) * width * 0.26, radius + 5, width - radius - 5),
      y: cap(height / 2 + Math.sin(angle) * height * 0.27, radius + 5, height - radius - 5),
      vx: Math.sin(index * 1.71 + 1) * 0.28,
      vy: Math.cos(index * 1.27 + 2) * 0.28,
    };
  });
  // Deterministic pre-settle prevents bubbles beginning inside one another.
  for (let iteration = 0; iteration < 260; iteration++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.001) { dx = 0.707; dy = 0.707; dist = 1; }
        const overlap = a.radius + b.radius + 3 - dist;
        if (overlap <= 0) continue;
        const nx = dx / dist, ny = dy / dist;
        const invA = 1 / a.mass, invB = 1 / b.mass;
        const correction = overlap / (invA + invB) * 0.95;
        a.x -= nx * correction * invA;
        a.y -= ny * correction * invA;
        b.x += nx * correction * invB;
        b.y += ny * correction * invB;
      }
    }
    for (const p of bodies) {
      p.x = cap(p.x, p.radius + 4, width - p.radius - 4);
      p.y = cap(p.y, p.radius + 4, height - p.radius - 4);
    }
  }
  return bodies;
}

export default function FinanceCategoryBubbleChart({ data, emptyText = "No expense data." }) {
  const { language } = useFinanceLanguage();
  const id = useId().replace(/:/g, "");
  const rootRef = useRef(null);
  const nodesRef = useRef(new Map());
  const hoverRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [size, setSize] = useState({ width: 640, height: 350 });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width > 0) setSize(previous => {
        const next = Math.max(260, Math.round(width));
        return previous.width === next ? previous : { width: next, height: next < 470 ? 300 : 350 };
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data?.length]);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(entries => setVisible(Boolean(entries[0]?.isIntersecting)), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data?.length]);

  const items = useMemo(() => (Array.isArray(data) ? data : [])
    .filter(item => Number.isFinite(Number(item.value)) && Number(item.value) > 0)
    .map(item => ({ name: String(item.name), value: Number(item.value) }))
    .sort((a, b) => b.value - a.value), [data]);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const bodies = useMemo(() => total > 0 ? makeParticles(items, size.width, size.height) : [],
    [items, total, size.width, size.height]);
  const active = items.find(item => item.name === (hover || selectedName)) || null;

  useEffect(() => {
    if (!visible || !bodies.length) return undefined;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion?.matches) return undefined;
    let frame = 0;
    let last = performance.now();
    const particles = bodies.map(b => ({ ...b }));
    function tick(now) {
      if (document.hidden) { last = now; frame = requestAnimationFrame(tick); return; }
      const step = cap((now - last) / 16.667, 0.1, 1.5);
      last = now;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (hoverRef.current === p.name) { p.vx = 0; p.vy = 0; continue; }
        // A very light buoyancy/current. No financial values are ever changed.
        p.vx += (Math.sin(now * 0.00031 + i * 2.8) * 0.005 + (size.width / 2 - p.x) * 0.000055) * step;
        p.vy += (Math.cos(now * 0.00028 + i * 2.1) * 0.006 - 0.002 + (size.height / 2 - p.y) * 0.000055) * step;
        p.vx = cap(p.vx * 0.998, -0.54, 0.54);
        p.vy = cap(p.vy * 0.998, -0.54, 0.54);
        p.x += p.vx * step;
        p.y += p.vy * step;
      }
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.001) { dx = 1; dy = 0; distance = 1; }
          const overlap = a.radius + b.radius + 3 - distance;
          if (overlap <= 0) continue;
          const nx = dx / distance, ny = dy / distance;
          const invA = hoverRef.current === a.name ? 0 : 1 / a.mass;
          const invB = hoverRef.current === b.name ? 0 : 1 / b.mass;
          const sum = invA + invB;
          if (sum <= 0) continue;
          const correction = overlap / sum;
          a.x -= nx * correction * invA;
          a.y -= ny * correction * invA;
          b.x += nx * correction * invB;
          b.y += ny * correction * invB;
          const closingSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (closingSpeed < 0) {
            const impulse = -(1 + 0.8) * closingSpeed / sum;
            a.vx -= nx * impulse * invA; a.vy -= ny * impulse * invA;
            b.vx += nx * impulse * invB; b.vy += ny * impulse * invB;
          }
        }
      }
      for (const p of particles) {
        if (p.x < p.radius + 4) { p.x = p.radius + 4; p.vx = Math.abs(p.vx) * 0.8; }
        if (p.x > size.width - p.radius - 4) { p.x = size.width - p.radius - 4; p.vx = -Math.abs(p.vx) * 0.8; }
        if (p.y < p.radius + 4) { p.y = p.radius + 4; p.vy = Math.abs(p.vy) * 0.8; }
        if (p.y > size.height - p.radius - 4) { p.y = size.height - p.radius - 4; p.vy = -Math.abs(p.vy) * 0.8; }
        nodesRef.current.get(p.name)?.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bodies, visible, size.width, size.height]);

  if (!items.length || total <= 0) {
    return <div className="flex h-full min-h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">{emptyText}</div>;
  }
  return (
    <div className="w-full min-w-0">
      <div ref={rootRef} className="h-[300px] w-full min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 sm:h-[350px]">
        <svg viewBox={"0 0 " + size.width + " " + size.height} width="100%" height="100%" role="group"
          aria-label="Interactive floating expense category bubbles">
          <defs>
            <filter id={id + "softShadow"} x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#475569" floodOpacity="0.15" />
            </filter>
            {bodies.map((p, index) => (
              <radialGradient key={p.name} id={id + "glass" + index} cx="28%" cy="23%" r="86%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95"/>
                <stop offset="34%" stopColor="#FFFFFF" stopOpacity="0.68"/>
                <stop offset="75%" stopColor={shadeFor(p.name)} stopOpacity="0.18"/>
                <stop offset="100%" stopColor={shadeFor(p.name)} stopOpacity="0.42"/>
              </radialGradient>
            ))}
          </defs>
          {bodies.map((p, index) => {
            const name = builtInFinanceCategory(p.name, language);
            const percent = (p.value / total) * 100;
            const lines = labelLines(name, p.radius);
            const fontSize = cap(p.radius * 0.20, 10, 20);
            return (
              <g key={p.name} ref={node => { if (node) nodesRef.current.set(p.name, node); else nodesRef.current.delete(p.name); }}
                transform={"translate(" + p.x + " " + p.y + ")"}
                role="button" tabIndex={0}
                aria-label={name + " " + percent.toFixed(1) + "% " + money(p.value)}
                onMouseEnter={() => { hoverRef.current = p.name; setHover(p.name); }}
                onMouseLeave={() => { hoverRef.current = null; setHover(null); }}
                onFocus={() => { hoverRef.current = p.name; setHover(p.name); }}
                onBlur={() => { hoverRef.current = null; setHover(null); }}
                onClick={() => setSelectedName(p.name)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedName(p.name); } }}
                className="cursor-pointer outline-none">
                <circle r={p.radius} fill={"url(#" + id + "glass" + index + ")"}
                  stroke={shadeFor(p.name)} strokeWidth={hover === p.name || selectedName === p.name ? 3.6 : 2.2}
                  filter={"url(#" + id + "softShadow" + ")"} />
                <circle r={Math.max(0, p.radius - 4)} fill="none" stroke="#FFFFFF" strokeOpacity="0.64" strokeWidth="1.5" />
                <ellipse cx={-p.radius * 0.28} cy={-p.radius * 0.44}
                  rx={p.radius * 0.38} ry={Math.max(1.5, p.radius * 0.13)}
                  transform={"rotate(-26 " + (-p.radius * 0.28) + " " + (-p.radius * 0.44) + ")"}
                  fill="#FFFFFF" fillOpacity="0.67" pointerEvents="none"/>
                {p.radius >= 26 && (
                  <text fill="#273444" fontWeight="650" textAnchor="middle" pointerEvents="none"
                    fontFamily="Inter, Segoe UI, Arial, sans-serif">
                    {lines.map((line, n) => (
                      <tspan key={n} x="0" y={lines.length > 1 ? -fontSize * 1.15 + n * fontSize * 1.1 : -fontSize * 0.3}
                        fontSize={fontSize}>{line}</tspan>
                    ))}
                    <tspan x="0" y={lines.length ? fontSize * (lines.length > 1 ? 0.9 : 1.1) : fontSize * 0.3}
                      fontSize={cap(p.radius * 0.26, 10, 25)} fontWeight="750">
                      {percent < 1 ? percent.toFixed(1) : percent.toFixed(0)}%
                    </tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        {active ? (
          <>
            <span className="min-w-0 break-words font-semibold" data-i18n-ignore>{builtInFinanceCategory(active.name, language)}</span>
            <span className="font-semibold tabular-nums">{(active.value / total * 100).toFixed(1)}% · {money(active.value)}</span>
          </>
        ) : <span className="text-xs text-slate-500">Hover or tap a bubble to see category, amount and share.</span>}
      </div>
    </div>
  );
}
