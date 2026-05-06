import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, hasSupabaseEnv } from "./supabaseClient";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, LineChart, Line,
} from "recharts";

const RECORDS_KEY = "finance-records-v3";
const BUDGET_KEY = "finance-category-budget-v3";
const SOUND_KEY = "finance-sound-v3";
const BALANCE_LIMIT_KEY = "finance-balance-limit-v3";
const CUSTOM_CARD_TEXT_KEY = "finance-custom-card-text-v3";
const CUSTOM_CARD_IMAGE_KEY = "finance-custom-card-image-v3";

const EXPENSE_CATEGORIES = ["饮食", "教育", "住房", "日用", "交通", "娱乐", "运动", "医疗", "美容"];
const INCOME_CATEGORIES = ["Salary", "Allowance", "Part-time", "Gift", "Others"];
const EXPENSE_METHODS = ["TNG", "CASH", "DEBIT CARD", "ONLINE BANK IN", "GRAB PAY"];
const INCOME_METHODS = ["TNG", "CASH", "BANK IN", "GRAB PAY"];
const DEFAULT_BUDGETS = { 饮食: "600", 教育: "", 住房: "", 日用: "", 交通: "300", 娱乐: "200", 运动: "", 医疗: "", 美容: "150" };
const COLORS = ["#6366f1", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#a855f7", "#eab308", "#64748b", "#ec4899"];

const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const yearNow = () => String(new Date().getFullYear());
const makeId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const pad = (n) => String(n).padStart(2, "0");
const money = (v) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(v || 0));
const categoriesFor = (t) => (t === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);
const methodsFor = (t) => (t === "expense" ? EXPENSE_METHODS : INCOME_METHODS);
const recordMethod = (r) => r.method || methodsFor(r.type)[0];

function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function addDays(dateString, amount) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + amount);
  return d.toISOString().slice(0, 10);
}

function dateRange(start, count) {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

function recentStart(days) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function sumType(records, type) {
  return records.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount || 0), 0);
}

function group(records, keyFn) {
  const out = {};
  records.forEach((r) => {
    const key = keyFn(r);
    out[key] = (out[key] || 0) + Number(r.amount || 0);
  });
  return Object.entries(out).map(([name, value]) => ({ name, value }));
}

function calculate(text) {
  const expression = String(text || "")
    .replaceAll("×", "*").replaceAll("x", "*").replaceAll("X", "*")
    .replaceAll("÷", "/").replaceAll("，", "+").replaceAll("、", "+")
    .replaceAll(",", "+").replaceAll(" ", "").replace(/[\t\n\r]/g, "");
  if (!expression || !Array.from(expression).every((c) => "0123456789+-*/().".includes(c))) throw new Error("Invalid");
  const value = Function(`"use strict"; return (${expression});`)();
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid");
  return Math.round(value * 100) / 100;
}

function filterRecords(records, mode, month, year, keyword) {
  const q = String(keyword || "").toLowerCase();
  const now = today();
  const starts = { recent30: recentStart(30), recent7: recentStart(7), recent3: recentStart(3) };
  return records
    .filter((r) => {
      if (!r?.date) return false;
      if (mode === "all") return true;
      if (mode === "month") return r.date.startsWith(month);
      if (mode === "year") return r.date.startsWith(year);
      if (mode in starts) return r.date >= starts[mode] && r.date <= now;
      return true;
    })
    .filter((r) => `${r.category || ""} ${r.note || ""} ${r.type || ""} ${recordMethod(r)}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}
function CoinRainEffect({ trigger }) {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    if (!trigger) return;

    const symbols = ["RM", "$", "€", "¥", "£", "₿"];
    const newCoins = Array.from({ length: 46 }, (_, index) => ({
      id: `${trigger}-${index}`,
      symbol: symbols[index % symbols.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.45,
      duration: 1.6 + Math.random() * 1.4,
      size: 22 + Math.random() * 18,
      rotate: Math.random() * 360,
      drift: -70 + Math.random() * 140,
    }));

    setCoins(newCoins);

    const timer = setTimeout(() => {
      setCoins([]);
    }, 3600);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (!coins.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <style>
        {`
          @keyframes antiqueCoinFall {
            0% {
              transform: translate3d(0, -90px, 0) rotateX(0deg) rotateZ(0deg) scale(0.85);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            72% {
              opacity: 1;
            }
            100% {
              transform: translate3d(var(--drift), 108vh, 0) rotateX(720deg) rotateZ(540deg) scale(1);
              opacity: 0;
            }
          }

          @keyframes antiqueCoinShine {
            0%, 100% {
              filter: brightness(1) drop-shadow(0 0 8px rgba(245, 158, 11, 0.35));
            }
            50% {
              filter: brightness(1.45) drop-shadow(0 0 14px rgba(251, 191, 36, 0.75));
            }
          }
        `}
      </style>

      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute top-0 flex items-center justify-center rounded-full border border-amber-700/80 bg-gradient-to-br from-yellow-200 via-amber-500 to-yellow-800 font-black text-yellow-950 shadow-[inset_0_2px_6px_rgba(255,255,255,0.55),inset_0_-4px_8px_rgba(92,46,0,0.55),0_8px_20px_rgba(0,0,0,0.35)]"
          style={{
            left: `${coin.left}%`,
            width: `${coin.size}px`,
            height: `${coin.size}px`,
            fontSize: `${coin.size * 0.34}px`,
            animation: `antiqueCoinFall ${coin.duration}s cubic-bezier(.2,.7,.25,1) ${coin.delay}s forwards, antiqueCoinShine 0.55s ease-in-out ${coin.delay}s infinite`,
            "--drift": `${coin.drift}px`,
          }}
        >
          <span
            style={{
              transform: `rotate(${coin.rotate}deg)`,
              textShadow: "0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            {coin.symbol}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, icon, desc }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl">{icon}</div>
      </div>
    </Card>
  );
}

function BalanceCard({ title, value, desc, limit }) {
  const safeLimit = Number(limit || 0);
  const low = value < safeLimit;

  return (
    <Card className={low ? "bg-red-50 ring-red-300" : ""}>
      <p className={`text-sm font-medium ${low ? "text-red-700" : "text-slate-500"}`}>{title}</p>
      <p className={`mt-2 text-2xl font-bold ${low ? "text-red-700" : "text-slate-900"}`}>{money(value)}</p>
      <p className={`mt-1 text-sm ${low ? "text-red-700" : "text-slate-500"}`}>
        {low ? `⚠ Balance below ${money(safeLimit)}` : desc}
      </p>
    </Card>
  );
}

function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />;
}

function BudgetCard({ totalBudget, used, budgets, setBudgets, spentMap }) {
  const [open, setOpen] = useState(false);
  const warning = used >= 75;
  return (
    <Card className={`relative ${warning ? "bg-red-50 ring-red-300" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium ${warning ? "text-red-700" : "text-slate-500"}`}>Total Budget</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className={`rounded-xl px-3 py-1 text-xs font-bold ${warning ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>Category Budget</button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-sm font-semibold ${warning ? "text-red-700" : "text-slate-500"}`}>RM</span>
        <div className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-lg font-bold ${warning ? "border-red-300 text-red-700" : "border-slate-200 text-slate-900"}`}>{totalBudget.toFixed(2)}</div>
      </div>
      <div className={`mt-3 h-3 overflow-hidden rounded-full ${warning ? "bg-red-200" : "bg-slate-100"}`}>
        <div className={`h-full rounded-full ${warning ? "bg-red-600" : "bg-slate-900"}`} style={{ width: `${Math.min(used, 100)}%` }} />
      </div>
      <p className={`mt-1 text-sm font-medium ${warning ? "text-red-700" : "text-slate-500"}`}>Used {used.toFixed(0)}%</p>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 max-h-[70vh] w-[760px] max-w-[90vw] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-base font-bold text-slate-900">Category Budget / 分类预算</p><p className="text-xs text-slate-500">Calculated from current filtered expense.</p></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">×</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {EXPENSE_CATEGORIES.map((category) => {
              const budget = Number(budgets[category] || 0);
              const spent = Number(spentMap[category] || 0);
              const categoryUsed = budget > 0 ? (spent / budget) * 100 : 0;
              const warn = categoryUsed >= 75;
              return (
                <div key={category} className={`rounded-2xl p-3 ring-1 ${warn ? "bg-red-50 ring-red-200" : "bg-slate-50 ring-slate-200"}`}>
                  <div className="flex items-center justify-between gap-3"><p className={`font-bold ${warn ? "text-red-700" : "text-slate-800"}`}>{category}</p><p className={`text-sm font-bold ${warn ? "text-red-700" : "text-slate-500"}`}>Used {categoryUsed.toFixed(0)}%</p></div>
                  <div className="mt-2 flex items-center gap-2"><span className="text-xs font-bold text-slate-500">RM</span><input value={budgets[category] || ""} onChange={(e) => setBudgets((p) => ({ ...p, [category]: e.target.value }))} type="number" min="0" placeholder="Budget" className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold outline-none" /></div>
                  <div className={`mt-2 h-2 overflow-hidden rounded-full ${warn ? "bg-red-200" : "bg-slate-200"}`}><div className={`h-full rounded-full ${warn ? "bg-red-600" : "bg-slate-900"}`} style={{ width: `${Math.min(categoryUsed, 100)}%` }} /></div>
                  <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500"><span>Spent {money(spent)}</span><span>{budget > 0 ? money(budget) : "Not set"}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function MiniPie({ data, emptyText, onClick, selectedName }) {
  if (!data.length) return <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-slate-500">{emptyText}</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 24, right: 42, bottom: 24, left: 42 }}>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} onClick={onClick}>
          {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} opacity={!selectedName || selectedName === entry.name ? 1 : 0.35} />)}
        </Pie>
        <Tooltip formatter={(value) => money(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ForecastCard({ stats, data, month }) {
  return (
    <Card>
      <h2 className="text-xl font-bold">Cash Flow Forecast</h2>
      <p className="mt-1 text-sm text-slate-500">Projected Balance Trend · {month}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-slate-500">Current balance</p><p className="mt-1 font-bold text-slate-900">{money(stats.currentBalance)}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-slate-500">Avg daily expense</p><p className="mt-1 font-bold text-slate-900">{money(stats.avgDailyExpense)}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-slate-500">Days left</p><p className="mt-1 font-bold text-slate-900">{stats.daysLeft}</p></div>
        <div className={`rounded-2xl p-3 ring-1 ${stats.predictedBalance < 1500 ? "bg-red-50 text-red-700 ring-red-200" : "bg-green-50 text-green-700 ring-green-200"}`}><p>Predicted balance</p><p className="mt-1 font-bold">{money(stats.predictedBalance)}</p></div>
      </div>
      <div className="mt-4 h-44">{data.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="balance" name="Projected Balance" stroke={stats.predictedBalance < 1500 ? "#ef4444" : "#22c55e"} strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No forecast data.</div>}</div>
    </Card>
  );
}

function HeatmapCard({ days, label }) {
  const max = Math.max(1, ...days.map((d) => d.amount));
  return (
    <Card>
      <h2 className="text-xl font-bold">Spending Heatmap / 消费热力图</h2>
      <p className="mt-1 text-sm text-slate-500">颜色越深 = 那天花费越高 · {label}</p>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d) => {
          const intensity = d.amount > 0 ? 0.18 + (d.amount / max) * 0.72 : 0.06;
          return <div key={d.date} title={`${d.date}: ${money(d.amount)}`} className="rounded-xl p-2 text-center text-xs font-bold ring-1 ring-slate-100" style={{ backgroundColor: `rgba(239, 68, 68, ${intensity})`, color: d.amount > 0 ? "#7f1d1d" : "#64748b" }}><p>{d.date.slice(8)}</p><p className="mt-1 truncate">{d.amount > 0 ? money(d.amount).replace("MYR", "RM") : "-"}</p></div>;
        })}
      </div>
    </Card>
  );
}

function TopExpensesCard({ records, label, category, setCategory }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Top 5 Highest Expenses</h2>
          <p className="mt-1 text-sm text-slate-500">
            最大消费排行 · {label}{category !== "all" ? ` · ${category}` : ""}
          </p>
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
        >
          <option value="all">全部分类</option>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {records.length ? records.map((record, index) => (
          <div key={record.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-bold text-slate-900">{record.category} · {recordMethod(record)}</p>
                <p className="text-slate-500">{record.date} · {record.note || "No note"}</p>
              </div>
            </div>
            <p className="whitespace-nowrap font-bold text-red-600">{money(record.amount)}</p>
          </div>
        )) : (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            No expense data for this category.
          </div>
        )}
      </div>
    </Card>
  );
}

function TodaySummaryCard({ stats }) {
  const balance = stats.income - stats.expense;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Today Summary</h2>
          <p className="mt-1 text-sm text-slate-500">今日摘要 · {today()}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl">📅</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-green-50 p-3 ring-1 ring-green-100">
          <p className="text-xs font-semibold text-green-700">Today Income</p>
          <p className="mt-1 font-bold text-green-700">{money(stats.income)}</p>
        </div>

        <div className="rounded-2xl bg-red-50 p-3 ring-1 ring-red-100">
          <p className="text-xs font-semibold text-red-700">Today Expense</p>
          <p className="mt-1 font-bold text-red-700">{money(stats.expense)}</p>
        </div>

        <div className={`rounded-2xl p-3 ring-1 ${balance >= 0 ? "bg-slate-50 text-slate-800 ring-slate-100" : "bg-red-50 text-red-700 ring-red-100"}`}>
          <p className="text-xs font-semibold">Today Balance</p>
          <p className="mt-1 font-bold">{money(balance)}</p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-xs font-semibold text-slate-500">Records</p>
          <p className="mt-1 font-bold text-slate-900">{stats.count}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
        <p className="text-xs font-semibold text-slate-500">Top Category</p>
        <p className="mt-1 font-bold text-slate-900">{stats.topCategory || "No expense today"}</p>
      </div>
    </Card>
  );
}

function CustomPersonalCard({ text, setText, image, setImage }) {
  const [imageError, setImageError] = useState("");

  function resizeImageToDataUrl(file, maxWidth = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl);
        };

        img.onerror = reject;
        img.src = reader.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please upload an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image is too large. Please choose an image below 8MB.");
      event.target.value = "";
      return;
    }

    try {
      const compressedImage = await resizeImageToDataUrl(file);
      setImage(compressedImage);
    } catch {
      setImageError("Failed to process image. Please try another image.");
    }

    event.target.value = "";
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Custom Card</h2>
          <p className="mt-1 text-sm text-slate-500">Write notes and place your own image.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl">🖼️</div>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        placeholder="Write anything here..."
        className="mt-4 min-h-[150px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-lg font-semibold leading-relaxed text-slate-800 outline-none focus:bg-white"
      />

      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
        {image ? (
          <div className="space-y-3">
            <img
              src={image}
              alt="Custom card upload"
              className="h-56 w-full rounded-2xl object-cover ring-1 ring-slate-200"
            />

            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white">
                Change Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setImage("");
                  setImageError("");
                }}
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-2xl bg-white text-center text-sm text-slate-500 ring-1 ring-slate-100">
            <span className="text-3xl">＋</span>
            <span className="mt-2 font-semibold">Upload your image</span>
            <span className="mt-1 text-xs">PNG / JPG / WebP · will be compressed</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        )}
      </div>

      {imageError && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100">
          {imageError}
        </p>
      )}
    </Card>
  );
}
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Custom Card</h2>
          <p className="mt-1 text-sm text-slate-500">Write notes and place your own image.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl">🖼️</div>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder="Write anything here..."
        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white"
      />

      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
        {image ? (
          <div className="space-y-3">
            <img
              src={image}
              alt="Custom card upload"
              className="h-48 w-full rounded-2xl object-cover ring-1 ring-slate-200"
            />

            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white">
                Change Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>

              <button
                type="button"
                onClick={() => setImage("")}
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl bg-white text-center text-sm text-slate-500 ring-1 ring-slate-100">
            <span className="text-3xl">＋</span>
            <span className="mt-2 font-semibold">Upload your image</span>
            <span className="mt-1 text-xs">PNG / JPG / WebP</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        )}
      </div>
    </Card>
  );
}

function EditableCell({ value, field, recordType, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  function commit() {
    setEditing(false);
    if (String(draft) !== String(value ?? "")) onSave(draft);
  }
  if (!editing) return <span className="cursor-pointer rounded px-1 py-0.5 hover:bg-slate-100" onClick={() => setEditing(true)}>{value || <span className="italic text-slate-400">—</span>}</span>;
  if (field === "category" || field === "method") {
    const list = field === "category" ? categoriesFor(recordType) : methodsFor(recordType);
    return <select autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} className="rounded border border-slate-300 px-1 py-0.5 text-xs outline-none">{list.map((x) => <option key={x}>{x}</option>)}</select>;
  }
  return <input autoFocus type={field === "date" ? "date" : field === "amount" ? "number" : "text"} min="0" step="0.01" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} className="rounded border border-slate-300 px-1 py-0.5 text-xs outline-none" />;
}

function TrendTooltip({ active, payload, records, category }) {
  if (!active || !payload || !payload.length) return null;
  const date = payload[0].payload.dateKey;
  const rows = records.filter((r) => r.type === "expense" && r.date === date).filter((r) => category === "all" || r.category === category);
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <div className="w-64 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-slate-200">
      <p className="font-bold text-slate-800">{date}</p>
      <p className="text-xs font-bold text-blue-600">Expense: {money(total)}</p>
      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
        {rows.length ? rows.map((r) => <div key={r.id} className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100"><div className="flex justify-between gap-2"><div><p className="font-semibold text-slate-800">{r.category}</p><p className="text-xs text-slate-500">{recordMethod(r)} · {r.note || "No note"}</p></div><p className="font-bold text-blue-600">{money(r.amount)}</p></div></div>) : <p className="text-xs text-slate-500">No records.</p>}
      </div>
    </div>
  );
}

function normalizeRecord(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount || 0),
    category: row.category,
    method: row.method,
    note: row.note || "",
    date: row.date,
  };
}

function toRecordPayload(record, userId) {
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

function AuthScreen() {
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = mode === "signUp"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(mode === "signUp" ? "Account created. You can sign in now." : "Signed in successfully.");
  }

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto mt-16 max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-red-200">
          <h1 className="text-2xl font-bold text-red-700">Supabase is not configured</h1>
          <p className="mt-3 text-sm text-slate-600">Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Environment Variables, then redeploy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-500">Personal Finance Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">记账可视化软件</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to sync your data across computer and phone.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} required className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none" />
          </label>
          <button disabled={busy} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Please wait..." : mode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
        {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-100">{message}</p>}
        <button onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")} className="mt-4 w-full text-sm font-semibold text-slate-600 hover:text-slate-900">
          {mode === "signUp" ? "Already have an account? Sign in" : "No account yet? Create one"}
        </button>
      </div>
    </div>
  );
}

export default function FinanceVisualizerApp() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [records, setRecords] = useState([]);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [form, setForm] = useState({ type: "expense", amount: "", category: "饮食", method: "TNG", note: "", date: today() });
  const [calculationText, setCalculationText] = useState("");
  const [calculationResult, setCalculationResult] = useState(null);
  const [filterMode, setFilterMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(monthNow());
  const [selectedYear, setSelectedYear] = useState(yearNow());
  const [keyword, setKeyword] = useState("");
  const [selectedPieCategory, setSelectedPieCategory] = useState(null);
  const [trendCategory, setTrendCategory] = useState("all");
  const [topExpenseCategory, setTopExpenseCategory] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(SOUND_KEY) !== "false");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [coinRainTrigger, setCoinRainTrigger] = useState(0);
  const [openDates, setOpenDates] = useState({});
  const [customCardText, setCustomCardText] = useState(() => {
  return localStorage.getItem(CUSTOM_CARD_TEXT_KEY) || "";
});

const [customCardImage, setCustomCardImage] = useState(() => {
  return localStorage.getItem(CUSTOM_CARD_IMAGE_KEY) || "";
});
  const [balanceLimit, setBalanceLimit] = useState(() => {
  const saved = localStorage.getItem(BALANCE_LIMIT_KEY);
  return saved || "1500";
});

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadCloudData();
    else {
      setRecords([]);
      setBudgets(DEFAULT_BUDGETS);
    }
  }, [user?.id]);

  useEffect(() => localStorage.setItem(SOUND_KEY, String(soundEnabled)), [soundEnabled]);
  useEffect(() => {
  localStorage.setItem(BALANCE_LIMIT_KEY, String(balanceLimit || "1500"));
}, [balanceLimit]);
  useEffect(() => {
  localStorage.setItem(CUSTOM_CARD_TEXT_KEY, customCardText);
}, [customCardText]);

useEffect(() => {
  localStorage.setItem(CUSTOM_CARD_IMAGE_KEY, customCardImage);
}, [customCardImage]);
  useEffect(() => setForm((p) => ({ ...p, category: categoriesFor(p.type).includes(p.category) ? p.category : categoriesFor(p.type)[0], method: methodsFor(p.type).includes(p.method) ? p.method : methodsFor(p.type)[0] })), [form.type]);


  async function loadCloudData() {
    if (!user) return;
    setDataLoading(true);
    setSyncStatus("Loading cloud data...");
    const { data: recordRows, error: recordError } = await supabase
      .from("records")
      .select("id,type,amount,category,method,note,date,created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (recordError) {
      setSyncStatus(recordError.message);
      setDataLoading(false);
      return;
    }
    setRecords((recordRows || []).map(normalizeRecord));
    const { data: settingsRow, error: settingsError } = await supabase
      .from("user_settings")
      .select("category_budgets")
      .eq("user_id", user.id)
      .maybeSingle();
    if (settingsError) setSyncStatus(settingsError.message);
    if (settingsRow?.category_budgets) {
      setBudgets({ ...DEFAULT_BUDGETS, ...settingsRow.category_budgets });
    } else {
      setBudgets(DEFAULT_BUDGETS);
      await saveBudgets(DEFAULT_BUDGETS);
    }
    setSyncStatus("Cloud synced");
    setDataLoading(false);
  }

  async function saveBudgets(nextBudgets) {
    if (!user) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, category_budgets: nextBudgets, updated_at: new Date().toISOString() });
    if (error) setSyncStatus(error.message);
    else setSyncStatus("Budget synced");
  }

  function updateBudgets(updater) {
    setBudgets((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      saveBudgets(next);
      return next;
    });
  }

  const filteredRecords = useMemo(() => filterRecords(records, filterMode, selectedMonth, selectedYear, keyword), [records, filterMode, selectedMonth, selectedYear, keyword]);
  const expenseRecords = filteredRecords.filter((r) => r.type === "expense");
  const income = sumType(records, "income");
  const expense = sumType(records, "expense");
  const filteredIncome = sumType(filteredRecords, "income");
  const filteredExpense = sumType(filteredRecords, "expense");
  const totalBudget = useMemo(() => EXPENSE_CATEGORIES.reduce((s, c) => s + Number(budgets[c] || 0), 0), [budgets]);
  const budgetUsed = totalBudget > 0 ? (filteredExpense / totalBudget) * 100 : 0;
  const showBudget = filterMode === "month" || filterMode === "recent30";
  const filterLabel = filterMode === "all" ? "全部" : filterMode === "month" ? selectedMonth : filterMode === "year" ? selectedYear : filterMode === "recent30" ? "最近 30 天" : filterMode === "recent7" ? "最近 7 天" : "最近 3 天";
  const chartLabel = (d) => filterMode === "month" ? d.slice(8) : filterMode === "all" ? d : d.slice(5);
  const categoryData = useMemo(() => group(expenseRecords, (r) => r.category), [expenseRecords]);
  const methodData = useMemo(() => group(expenseRecords, (r) => recordMethod(r)), [expenseRecords]);
  const spentMap = useMemo(() => {
    const map = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
    expenseRecords.forEach((r) => { map[r.category] = (map[r.category] || 0) + Number(r.amount || 0); });
    return map;
  }, [expenseRecords]);
  const selectedCategoryRecords = useMemo(() => selectedPieCategory ? expenseRecords.filter((r) => r.category === selectedPieCategory).sort((a, b) => new Date(a.date) - new Date(b.date)) : [], [expenseRecords, selectedPieCategory]);
  useEffect(() => {
    if (!categoryData.length) setSelectedPieCategory(null);
    else if (!categoryData.some((x) => x.name === selectedPieCategory)) setSelectedPieCategory(categoryData[0].name);
  }, [categoryData, selectedPieCategory]);

  const dailyData = useMemo(() => {
    const out = {};
    filteredRecords.forEach((r) => {
      if (!out[r.date]) out[r.date] = { dateKey: r.date, day: chartLabel(r.date), income: 0, expense: 0 };
      out[r.date][r.type] += Number(r.amount || 0);
    });
    return Object.values(out).sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey));
  }, [filteredRecords, filterMode]);

  const trendData = useMemo(() => {
    const out = {};
    filteredRecords.forEach((r) => {
      if (!out[r.date]) out[r.date] = { dateKey: r.date, day: chartLabel(r.date), expense: 0, dailyBalance: 0 };
      out[r.date].dailyBalance += r.type === "income" ? Number(r.amount || 0) : -Number(r.amount || 0);
    });
    expenseRecords.filter((r) => trendCategory === "all" || r.category === trendCategory).forEach((r) => {
      if (!out[r.date]) out[r.date] = { dateKey: r.date, day: chartLabel(r.date), expense: 0, dailyBalance: 0 };
      out[r.date].expense += Number(r.amount || 0);
    });
    let balance = 0;
    return Object.values(out).sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey)).map((row) => {
      balance += row.dailyBalance;
const limit = Number(balanceLimit || 1500);
return { ...row, balanceGreen: balance > limit ? balance : null, balanceRed: balance <= limit ? balance : null };
    });
}, [filteredRecords, expenseRecords, trendCategory, filterMode, balanceLimit]);

  const forecastMonth = filterMode === "month" ? selectedMonth : monthNow();
  const forecast = useMemo(() => {
    const totalDays = daysInMonth(forecastMonth);
    const currentDay = forecastMonth === monthNow() ? Number(today().slice(8)) : totalDays;
    const monthRecords = records.filter((r) => r.date.startsWith(forecastMonth) && Number(r.date.slice(8)) <= currentDay);
    const currentBalance = sumType(monthRecords, "income") - sumType(monthRecords, "expense");
    const avgDailyExpense = sumType(monthRecords, "expense") / Math.max(currentDay, 1);
    const daysLeft = Math.max(totalDays - currentDay, 0);
    const predictedBalance = currentBalance - avgDailyExpense * daysLeft;
    const data = Array.from({ length: daysLeft + 1 }, (_, i) => ({ day: pad(currentDay + i), balance: Math.round((currentBalance - avgDailyExpense * i) * 100) / 100 }));
    return { stats: { currentBalance, avgDailyExpense, daysLeft, predictedBalance }, data };
  }, [records, forecastMonth]);

  const heatmapDays = useMemo(() => {
    const amounts = {};
    expenseRecords.forEach((r) => { amounts[r.date] = (amounts[r.date] || 0) + Number(r.amount || 0); });
    let dates = [];
    if (filterMode === "month") dates = dateRange(`${selectedMonth}-01`, daysInMonth(selectedMonth));
    else if (filterMode === "recent30") dates = dateRange(recentStart(30), 30);
    else if (filterMode === "recent7") dates = dateRange(recentStart(7), 7);
    else if (filterMode === "recent3") dates = dateRange(recentStart(3), 3);
    else dates = Array.from(new Set(filteredRecords.map((r) => r.date))).sort((a, b) => new Date(a) - new Date(b)).slice(-35);
    return dates.map((date) => ({ date, amount: Number(amounts[date] || 0) }));
  }, [expenseRecords, filteredRecords, filterMode, selectedMonth]);

  const topExpenses = useMemo(() => {
  const source = topExpenseCategory === "all"
    ? expenseRecords
    : expenseRecords.filter((record) => record.category === topExpenseCategory);

  return source
    .slice()
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);
}, [expenseRecords, topExpenseCategory]);
  const todaySummaryStats = useMemo(() => {
  const todayRecords = records.filter((record) => record.date === today());
  const todayExpenseRecords = todayRecords.filter((record) => record.type === "expense");

  const categoryTotals = {};
  todayExpenseRecords.forEach((record) => {
    categoryTotals[record.category] = (categoryTotals[record.category] || 0) + Number(record.amount || 0);
  });

  const topCategory = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    income: sumType(todayRecords, "income"),
    expense: sumType(todayRecords, "expense"),
    count: todayRecords.length,
    topCategory,
  };
}, [records]);
  const groupedTransactionRecords = useMemo(() => {
  const grouped = {};

  filteredRecords.forEach((record) => {
    if (!grouped[record.date]) {
      grouped[record.date] = {
        date: record.date,
        records: [],
        income: 0,
        expense: 0,
      };
    }

    grouped[record.date].records.push(record);

    if (record.type === "income") {
      grouped[record.date].income += Number(record.amount || 0);
    } else {
      grouped[record.date].expense += Number(record.amount || 0);
    }
  });

  return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
}, [filteredRecords]);

function toggleDateGroup(date) {
  setOpenDates((previous) => ({
    ...previous,
    [date]: !previous[date],
  }));
}

  function playSound() {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const a = new Ctx();
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.setValueAtTime(520, a.currentTime);
      g.gain.setValueAtTime(0.04, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.08); o.onended = () => a.close();
    } catch {}
  }
  function playCoinClinkSound() {
  if (!soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audio = new AudioContextClass();
    const master = audio.createGain();
    master.gain.setValueAtTime(0.16, audio.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 1.25);
    master.connect(audio.destination);

    const playClink = (time, frequency, volume) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.45, time + 0.035);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(time);
      oscillator.stop(time + 0.24);
    };

    const now = audio.currentTime;
    const clinks = [
      [0.00, 1180, 0.08],
      [0.05, 1620, 0.055],
      [0.11, 910, 0.06],
      [0.19, 1350, 0.045],
      [0.31, 1880, 0.04],
      [0.43, 1120, 0.035],
      [0.58, 1540, 0.03],
    ];

    clinks.forEach(([delay, frequency, volume]) => {
      playClink(now + delay, frequency, volume);
    });

    setTimeout(() => audio.close(), 1500);
  } catch {}
}

async function addRecord(e) {
  e.preventDefault();
  if (!user) return alert("Please sign in first.");
  const amount = Number(form.amount);
  if (!amount || amount <= 0) return alert("Please enter a valid amount.");

  const payload = toRecordPayload({ ...form, amount, note: form.note.trim() }, user.id);
  const { data, error } = await supabase
    .from("records")
    .insert(payload)
    .select("id,type,amount,category,method,note,date,created_at")
    .single();

  if (error) return alert(error.message);

  setRecords((p) => [normalizeRecord(data), ...p]);
  setForm((p) => ({ ...p, amount: "", note: "" }));
  setSyncStatus("Record added to cloud");

  playCoinClinkSound();
  setCoinRainTrigger(Date.now());
}

  function fillCalculation() {
    try {
      const total = calculate(calculationText);
      setCalculationResult(total);
      setForm((p) => ({ ...p, amount: total.toFixed(2) }));
    } catch { alert("Invalid calculation. Example: 3.50 + 12.90 + 2*5.40"); }
  }

  async function updateRecord(recordId, field, value) {
    const current = records.find((r) => r.id === recordId);
    if (!current) return;
    const updates = field === "type"
      ? { type: value, category: categoriesFor(value)[0], method: methodsFor(value)[0] }
      : { [field]: field === "amount" ? Number(value) : value };
    const { error } = await supabase.from("records").update(updates).eq("id", recordId);
    if (error) return alert(error.message);
    setRecords((p) => p.map((r) => (r.id === recordId ? { ...r, ...updates } : r)));
    setSyncStatus("Record synced");
  }

  async function deleteRecord(recordId) {
  const { error } = await supabase
    .from("records")
    .delete()
    .eq("id", recordId);

  if (error) {
    alert(error.message);
    return;
  }

  setRecords((p) => p.filter((r) => r.id !== recordId));
  setDeleteConfirm(null);
  setSyncStatus("Record deleted from cloud");
}

  function exportCsv() {
    const q = String.fromCharCode(34);
    const rows = records.map((r) => [r.date, r.type, r.category, recordMethod(r), r.amount, q + String(r.note || "").replaceAll(q, q + q) + q].join(","));
    const blob = new Blob([["Date,Type,Category,Method,Amount,Note", ...rows].join(String.fromCharCode(10))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finance-records-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
      const lines = String(e.target.result || "").split(/\r?\n/).slice(1).filter(Boolean);
        const imported = lines.map((line) => {
          const match = line.match(/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),(.*)$/);
          if (!match) return null;
          const [, date, type, category, method, amount, note] = match;
          return { date: date.trim(), type: type.trim(), category: category.trim(), method: method.trim(), amount: Number(amount), note: note.replace(/^"|"$/g, "").trim() };
        }).filter(Boolean);
        if (!imported.length) return alert("No valid records found in CSV.");
        const payloads = imported.map((record) => toRecordPayload(record, user.id));
        const { data, error } = await supabase.from("records").insert(payloads).select("id,type,amount,category,method,note,date,created_at");
        if (error) return alert(error.message);
        setRecords((p) => [...(data || []).map(normalizeRecord), ...p]);
        setSyncStatus(`Imported ${data?.length || 0} records to cloud`);
      } catch {
        alert("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

return (
  <div onClickCapture={(e) => e.target.closest("button,select") && playSound()} className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
    <CoinRainEffect trigger={coinRainTrigger} />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-medium text-slate-300">Personal Finance Dashboard</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">记账可视化软件</h1><p className="mt-2 text-sm text-slate-300">记录收入与支出，自动生成统计、分类比例、每日趋势和预算使用情况。</p></div>
          <div className="flex flex-wrap gap-3"><button onClick={() => setSoundEnabled((v) => !v)} className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600">{soundEnabled ? "🔊" : "🔇"} Sound</button><button onClick={exportCsv} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900">⬇ Export CSV</button><label className="cursor-pointer rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600">⬆ Import CSV<input type="file" accept=".csv" className="hidden" onChange={importCsv} /></label><button onClick={signOut} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900">Sign out</button></div>
        </header>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">Signed in as <b>{user?.email}</b> · {dataLoading ? "Syncing..." : syncStatus || "Cloud ready"}</div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
  <div>
    <p className="font-bold text-slate-800">Balance Alert Limit</p>
    <p className="text-xs text-slate-500">Total Balance and Filtered Balance will turn red below this value.</p>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-slate-500">RM</span>
    <input
      type="number"
      min="0"
      step="100"
      value={balanceLimit}
      onChange={(e) => setBalanceLimit(e.target.value)}
      className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-right font-bold outline-none"
    />
  </div>
</div>

        <section className="grid gap-4 md:grid-cols-3"><StatCard title="Total Income" value={money(income)} icon="📈" desc="Overall records" /><StatCard title="Total Expense" value={money(expense)} icon="📉" desc="Overall records" /><BalanceCard title="Balance" value={income - expense} desc="Overall cash flow" limit={balanceLimit} /></section>

<section className="grid gap-6 lg:grid-cols-[380px_1fr]">
  <div className="space-y-6">
    <Card>
            <h2 className="text-xl font-bold">＋ Add Record</h2>
            <form onSubmit={addRecord} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1"><button type="button" onClick={() => setForm((p) => ({ ...p, type: "expense" }))} className={`rounded-xl px-3 py-2 text-sm font-semibold ${form.type === "expense" ? "bg-white shadow-sm" : "text-slate-500"}`}>Expense</button><button type="button" onClick={() => setForm((p) => ({ ...p, type: "income" }))} className={`rounded-xl px-3 py-2 text-sm font-semibold ${form.type === "income" ? "bg-white shadow-sm" : "text-slate-500"}`}>Income</button></div>
              <label className="block"><span className="text-sm font-medium text-slate-600">Amount</span><input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} type="number" min="0" step="0.01" className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none" /></label>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-sm font-bold text-slate-700">小计算器</p><textarea value={calculationText} onChange={(e) => setCalculationText(e.target.value)} rows={3} placeholder="3.50 + 12.90 + 2*5.40" className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" /><div className="mt-3 flex items-center justify-between gap-2"><span className="text-sm text-slate-600">{calculationResult !== null ? `Total: ${money(calculationResult)}` : "支持 + - * / 和括号"}</span><button type="button" onClick={fillCalculation} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">Calculate & Fill</button></div></div>
              <label className="block"><span className="text-sm font-medium text-slate-600">Category</span><select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none">{categoriesFor(form.type).map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Method</span><select value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none">{methodsFor(form.type).map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Date</span><DateInput value={form.date} onChange={(date) => setForm((p) => ({ ...p, date }))} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Note</span><input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none" /></label>
              <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Add Record</button>
    </form>
    </Card>

    <TodaySummaryCard stats={todaySummaryStats} />

    <CustomPersonalCard
      text={customCardText}
      setText={setCustomCardText}
      image={customCardImage}
      setImage={setCustomCardImage}
    />
  </div>

  <div className="space-y-6">
            <Card><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-xl font-bold">Filters</h2><div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:justify-end"><select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"><option value="all">全部</option><option value="month">按月份</option><option value="year">按年份</option><option value="recent30">最近 30 天</option><option value="recent7">最近 7 天</option><option value="recent3">最近 3 天</option></select>{filterMode === "month" && <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" />}{filterMode === "year" && <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" />}<input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search category, method or note" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" /></div></div></Card>
            <section className={`grid gap-4 ${showBudget ? "md:grid-cols-4" : "md:grid-cols-3"}`}><StatCard title="Filtered Income" value={money(filteredIncome)} icon="📈" desc={`Current filter: ${filterLabel}`} /><StatCard title="Filtered Expense" value={money(filteredExpense)} icon="📉" desc={`Current filter: ${filterLabel}`} /><BalanceCard title="Filtered Balance" value={filteredIncome - filteredExpense} desc={`Current filter: ${filterLabel}`} limit={balanceLimit} />{showBudget && <BudgetCard totalBudget={totalBudget} used={budgetUsed} budgets={budgets} setBudgets={updateBudgets} spentMap={spentMap} />}</section>
            <section className="grid gap-6 xl:grid-cols-3"><ForecastCard stats={forecast.stats} data={forecast.data} month={forecastMonth} /><HeatmapCard days={heatmapDays} label={filterLabel} /><TopExpensesCard
  records={topExpenses}
  label={filterLabel}
  category={topExpenseCategory}
  setCategory={setTopExpenseCategory}
/></section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Card><h2 className="text-xl font-bold">Daily Income vs Expense</h2><p className="mt-1 text-sm text-slate-500">Current range: {filterLabel}</p><div className="mt-4 h-64">{dailyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Legend /><Bar dataKey="income" name="Income" fill="#22c55e" /><Bar dataKey="expense" name="Expense" fill="#ef4444" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No data.</div>}</div><div className="mt-5 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="mb-2 flex justify-between gap-2"><p className="text-sm font-bold text-slate-700">消费趋势图</p><select value={trendCategory} onChange={(e) => setTrendCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option value="all">全部分类</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div><div className="h-36">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip content={<TrendTooltip records={filteredRecords} category={trendCategory} />} /><Legend /><Line type="monotone" dataKey="expense" name="Expense" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No expense trend data.</div>}</div><div className="mt-4 border-t border-slate-200 pt-3"><p className="mb-2 text-sm font-bold text-slate-700">Filtered Balance Trend</p><div className="h-36">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Legend /><Line connectNulls type="monotone" dataKey="balanceGreen" name="Balance > RM1500" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} /><Line connectNulls type="monotone" dataKey="balanceRed" name="Balance ≤ RM1500" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No balance trend data.</div>}</div></div></div></Card>
              <Card><h2 className="text-xl font-bold">Expense by Category</h2><p className="mt-1 text-sm text-slate-500">点击分类查看记录；Method Ratio 显示全部支出方式比例。</p><div className="mt-4 h-60"><MiniPie data={categoryData} emptyText="No expense data." onClick={(entry) => setSelectedPieCategory(entry.name)} selectedName={selectedPieCategory} /></div><div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-sm font-bold text-slate-700">{selectedPieCategory ? `${selectedPieCategory} records` : "Category records"}</p><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{selectedCategoryRecords.length ? selectedCategoryRecords.map((r) => <div key={r.id} className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100"><div><p className="font-semibold">{r.date}</p><p className="text-slate-500">{recordMethod(r)} · {r.note || "No note"}</p></div><p className="font-bold text-red-600">{money(r.amount)}</p></div>) : <div className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">点击 pie chart 的某个分类后，这里会显示对应记录。</div>}</div></div><div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="mb-2 flex justify-between"><p className="text-sm font-bold text-slate-700">Method Ratio</p><p className="text-xs text-slate-500">所有支出方式比例</p></div><div className="h-60"><MiniPie data={methodData} emptyText="No method data." /></div></div></Card>
            </section>
          </div>
        </section>

       <Card>
  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
    <div>
      <h2 className="text-xl font-bold">Transaction Records</h2>
      <p className="mt-1 text-sm text-slate-500">
        Showing {filteredRecords.length} records for {filterLabel} · Click a date to expand records
      </p>
    </div>
    {totalBudget > 0 && filteredExpense > totalBudget && (
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        ⚠ Expense exceeded budget by {money(filteredExpense - totalBudget)}.
      </div>
    )}
  </div>

  <div className="mt-5 space-y-3">
    {groupedTransactionRecords.length === 0 && (
      <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-400 ring-1 ring-slate-100">
        No records found.
      </div>
    )}

    {groupedTransactionRecords.map((group) => {
      const isOpen = openDates[group.date] ?? false;
      const dayBalance = group.income - group.expense;

      return (
        <div key={group.date} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => toggleDateGroup(group.date)}
            className="flex w-full flex-col gap-3 bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {isOpen ? "−" : "+"}
              </span>
              <div>
                <p className="font-mono text-sm font-bold text-slate-900">{group.date}</p>
                <p className="text-xs text-slate-500">
                  {group.records.length} record{group.records.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs md:min-w-[360px]">
              <div className="rounded-xl bg-green-50 px-3 py-2 text-right font-bold text-green-700">
                +{money(group.income)}
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2 text-right font-bold text-red-700">
                -{money(group.expense)}
              </div>
              <div className={`rounded-xl px-3 py-2 text-right font-bold ${dayBalance >= 0 ? "bg-slate-100 text-slate-900" : "bg-red-100 text-red-700"}`}>
                {money(dayBalance)}
              </div>
            </div>
          </button>

          {isOpen && (
            <div className="overflow-x-auto px-4 pb-4">
              <table className="mt-3 w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Type</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Category</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Method</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Note</th>
                    <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {group.records.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                        <EditableCell value={record.date} field="date" recordType={record.type} onSave={(v) => updateRecord(record.id, "date", v)} />
                      </td>

                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${record.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {record.type === "income" ? "▲ Income" : "▼ Expense"}
                        </span>
                      </td>

                      <td className="py-3 pr-4 font-medium text-slate-800">
                        <EditableCell value={record.category} field="category" recordType={record.type} onSave={(v) => updateRecord(record.id, "category", v)} />
                      </td>

                      <td className="py-3 pr-4 text-slate-600">
                        <EditableCell value={recordMethod(record)} field="method" recordType={record.type} onSave={(v) => updateRecord(record.id, "method", v)} />
                      </td>

                      <td className={`py-3 pr-4 font-bold ${record.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        <EditableCell value={record.amount} field="amount" recordType={record.type} onSave={(v) => updateRecord(record.id, "amount", v)} />
                      </td>

                      <td className="py-3 pr-4 text-slate-500">
                        <EditableCell value={record.note || ""} field="note" recordType={record.type} onSave={(v) => updateRecord(record.id, "note", v)} />
                      </td>

                      <td className="py-3">
                        {deleteConfirm === record.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => deleteRecord(record.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">Cancel</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(record.id)}
                            className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    })}
  </div>

  {filteredRecords.length > 0 && (
    <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-slate-500">Total ({filteredRecords.length} records)</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-600">+{money(filteredIncome)}</span>
          <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">-{money(filteredExpense)}</span>
          <span className={`rounded-xl px-3 py-2 text-xs font-bold ${filteredIncome - filteredExpense >= 0 ? "bg-white text-slate-900" : "bg-red-100 text-red-700"}`}>
            = {money(filteredIncome - filteredExpense)}
          </span>
        </div>
      </div>
    </div>
  )}
</Card>

        <footer className="pb-6 text-center text-xs text-slate-400">记账可视化软件 · Data synced with Supabase cloud · {records.length} total records</footer>
      </div>
    </div>
  );
}
