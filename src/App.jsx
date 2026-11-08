import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, hasSupabaseEnv, isTestEnvironment } from "./supabaseClient";
import { parseEditedAmount, splitRecordStatus, loadEveryOwnedRow } from "./financeData";
import { localDateMY, localMonthMY, localYearMY, shiftCalendarDay, calendarDaysRange, previousCalendarDays, calendarMonthDays, requireCalendarDate } from "./financeCalendar";
import { normalizeBudgetsInput } from "./financeInsights.js";
import FinanceTransferPanel from "./FinanceTransferPanel.jsx";
import FinanceBudgetPanel from "./FinanceBudgetPanel.jsx";
import FinanceForecastPanel from "./FinanceForecastPanel.jsx";
import FinanceCsvImportPanel from "./FinanceCsvImportPanel.jsx";
import FinanceExcelExportPanel from "./FinanceExcelExportPanel.jsx";
import { CoinRainEffect, IncomeCoinSpinEffect } from "./FinanceVisualEffects.jsx";
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
const BASE_METHODS = ["TNG", "CASH", "BANK", "GRAB PAY"];
const EXPENSE_METHODS = BASE_METHODS;
const INCOME_METHODS = BASE_METHODS;
const DEFAULT_BUDGETS = { 饮食: "600", 教育: "", 住房: "", 日用: "", 交通: "300", 娱乐: "200", 运动: "", 医疗: "", 美容: "150" };
const DEFAULT_CUSTOM_OPTIONS = {
  expenseCategories: [],
  incomeCategories: [],
  expenseMethods: [],
  incomeMethods: [],
};

const ADD_CATEGORY_VALUE = "__add_category__";
const ADD_METHOD_VALUE = "__add_method__";
const DELETE_CATEGORY_VALUE = "__delete_category__";
const DELETE_METHOD_VALUE = "__delete_method__";
const COLORS = ["#6366f1", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#a855f7", "#eab308", "#64748b", "#ec4899"];

const today = localDateMY;
const monthNow = localMonthMY;
const yearNow = localYearMY;
const makeId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const pad = (n) => String(n).padStart(2, "0");
const money = (v) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(v || 0));
const categoriesFor = (t) => (t === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);
const methodsFor = (t) => (t === "expense" ? EXPENSE_METHODS : INCOME_METHODS);
const recordMethod = (r) => r.method || methodsFor(r.type)[0];
function normalizeMethodForBalance(method) {
  const raw = String(method || "").trim();
  const upper = raw.toUpperCase();

  if (upper === "BANK IN") return "BANK";
  if (upper === "ONLINE BANK IN") return "BANK";
  if (upper === "DEBIT CARD") return "BANK";

  if (upper === "BANK") return "BANK";
  if (upper === "TNG") return "TNG";
  if (upper === "CASH") return "CASH";
  if (upper === "GRAB PAY") return "GRAB PAY";

  return raw;
}
function uniqueOptions(baseOptions, customOptions = []) {
  return Array.from(new Set([...(baseOptions || []), ...(customOptions || [])].filter(Boolean)));
}
const CATEGORY_ICONS = {
  饮食: "🍜",
  教育: "📚",
  住房: "🏠",
  日用: "🧴",
  交通: "🚗",
  娱乐: "🎮",
  运动: "🏃",
  医疗: "💊",
  美容: "💄",
  Salary: "💼",
  Allowance: "🎁",
  "Part-time": "🧰",
  Gift: "🎉",
  Others: "✨",
};

const formatCategoryLabel = (category) => `${CATEGORY_ICONS[category] || "🏷️"} ${category}`;

const recordTypeStyle = (type) =>
  type === "income"
    ? {
        badge: "bg-green-100 text-green-700 ring-green-200",
        row: "hover:bg-green-50/60",
        amount: "text-green-700",
        sign: "+",
        label: "💚 Income",
      }
    : {
        badge: "bg-red-100 text-red-700 ring-red-200",
        row: "hover:bg-red-50/60",
        amount: "text-red-700",
        sign: "-",
        label: "🔥 Expense",
      };

const daysInMonth = calendarMonthDays;
const addDays = shiftCalendarDay;
const dateRange = calendarDaysRange;
const recentStart = previousCalendarDays;

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
function parseMoneyInput(value) {
  const raw = String(value ?? "").trim();

  if (!raw) return 0;

  if (raw.includes(".")) {
    return Number(raw);
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw) / 100;
  }

  return Number(raw);
}

function normalizeMoneyNumbersInExpression(expression) {
  return String(expression || "").replace(/\d+(\.\d+)?/g, (match) => {
    if (match.includes(".")) return match;
    return String(Number(match) / 100);
  });
}
function formatMoneyTyping(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return "0.00";

  return (Number(digits) / 100).toFixed(2);
}

function formatCalculatorTyping(value) {
  const text = String(value ?? "")
    .replaceAll("×", "*")
    .replaceAll("x", "*")
    .replaceAll("X", "*")
    .replaceAll("÷", "/")
    .replaceAll("，", "+")
    .replaceAll("、", "+")
    .replaceAll(",", "+");

  const parts = text.match(/(\d[\d.]*)|[+\-*/()]/g) || [];

  if (!parts.length) return "0.00";

  return parts
    .map((part) => {
      if (/^\d[\d.]*$/.test(part)) return formatMoneyTyping(part);
      return ` ${part} `;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
function calculate(text) {
  const expression = String(text || "")
    .replaceAll("×", "*").replaceAll("x", "*").replaceAll("X", "*")
    .replaceAll("÷", "/").replaceAll("，", "+").replaceAll("、", "+")
    .replaceAll(",", "+").replaceAll(" ", "").replace(/[\t\n\r]/g, "");

  if (!expression || !Array.from(expression).every((c) => "0123456789+-*/().".includes(c))) {
    throw new Error("Invalid");
  }

  const moneyExpression = normalizeMoneyNumbersInExpression(expression);
  const value = Function(`"use strict"; return (${moneyExpression});`)();

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

function BalanceCard({ title, value, desc, limit, methodBalances = [] }) {
  const safeLimit = Number(limit || 0);
  const low = value < safeLimit;
  const [open, setOpen] = useState(false);

  const showMethodBreakdown = title === "Balance" && methodBalances.length > 0;

  return (
    <Card className={low ? "bg-red-50 ring-red-300" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${low ? "text-red-700" : "text-slate-500"}`}>
            {title}
          </p>

          <p className={`mt-2 text-2xl font-bold ${low ? "text-red-700" : "text-slate-900"}`}>
            {money(value)}
          </p>

          <p className={`mt-1 text-sm ${low ? "text-red-700" : "text-slate-500"}`}>
            {low ? `⚠ Balance below ${money(safeLimit)}` : desc}
          </p>
        </div>

        {showMethodBreakdown && (
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
          >
            {open ? "Hide" : "Methods"}
          </button>
        )}
      </div>

      {showMethodBreakdown && open && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Method Balance</p>
              <p className="text-xs text-slate-500">
                Transfer only moves money between methods.
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-2 py-1 text-base">🏦</div>
          </div>

          <div className="space-y-2">
            {methodBalances.map((item) => (
              <div
                key={item.method}
                className="rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.method}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      Income {money(item.income)} · Expense {money(item.expense)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      In {money(item.transferIn)} · Out {money(item.transferOut)}
                    </p>
                  </div>

                  <p
                    className={`whitespace-nowrap font-bold ${
                      item.balance < 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {money(item.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />;
}

function BudgetCard({ totalBudget, used, budgets, setBudgets, spentMap, expenseCategoryOptions }) {
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
            {expenseCategoryOptions.map((category) => {
              const budget = Number(budgets[category] || 0);
              const spent = Number(spentMap[category] || 0);
              const categoryUsed = budget > 0 ? (spent / budget) * 100 : 0;
              const warn = categoryUsed >= 75;
              return (
                <div key={category} className={`rounded-2xl p-3 ring-1 ${warn ? "bg-red-50 ring-red-200" : "bg-slate-50 ring-slate-200"}`}>
                  <div className="flex items-center justify-between gap-3"><p className={`font-bold ${warn ? "text-red-700" : "text-slate-800"}`}>{formatCategoryLabel(category)}</p><p className={`text-sm font-bold ${warn ? "text-red-700" : "text-slate-500"}`}>Used {categoryUsed.toFixed(0)}%</p></div>
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

function TopExpensesCard({ records, label, category, setCategory, expenseCategoryOptions }) {
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
          {expenseCategoryOptions.map((item) => (
            <option key={item} value={item}>{formatCategoryLabel(item)}</option>
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
                <p className="font-bold text-slate-900">{formatCategoryLabel(record.category)} · {recordMethod(record)}</p>
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
function TransferCard({
  transferForm,
  setTransferForm,
  methodOptions,
  transfers,
  onTransfer,
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Money Transfer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Move money between methods. This will not count as income or expense.
          </p>
        </div>
        <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xl">🔁</div>
      </div>

      <form onSubmit={onTransfer} className="mt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">From Method</span>
            <select
              value={transferForm.fromMethod}
              onChange={(event) =>
                setTransferForm((previous) => ({
                  ...previous,
                  fromMethod: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            >
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-600">To Method</span>
            <select
              value={transferForm.toMethod}
              onChange={(event) =>
                setTransferForm((previous) => ({
                  ...previous,
                  toMethod: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            >
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Amount</span>
          <input
            value={transferForm.amount}
            onChange={(event) =>
              setTransferForm((previous) => ({
                ...previous,
                amount: formatMoneyTyping(event.target.value),
              }))
            }
            type="text"
            inputMode="numeric"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Date</span>
          <DateInput
            value={transferForm.date}
            onChange={(date) =>
              setTransferForm((previous) => ({
                ...previous,
                date,
              }))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Note</span>
          <input
            value={transferForm.note}
            onChange={(event) =>
              setTransferForm((previous) => ({
                ...previous,
                note: event.target.value,
              }))
            }
            placeholder="Example: Top up TNG"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Transfer Money
        </button>
      </form>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">Recent Transfers</p>
          <p className="text-xs font-semibold text-slate-400">
            {transfers.length} records
          </p>
        </div>

        <div className="max-h-56 space-y-2 overflow-y-auto">
          {transfers.length ? (
            transfers.slice(0, 5).map((transfer) => (
              <div
                key={transfer.id}
                className="rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {transfer.fromMethod} → {transfer.toMethod}
                    </p>
                    <p className="text-xs text-slate-500">
                      {transfer.date} · {transfer.note || "No note"}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-bold text-blue-700">
                    {money(transfer.amount)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500 ring-1 ring-slate-100">
              No transfer records yet.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
function MethodBalanceCard({ balances }) {
  const totalBalance = balances.reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Method Balance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shows where your money is now. Transfers affect this card only.
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xl">🏦</div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
        <p className="text-xs font-semibold text-slate-300">Total Method Balance</p>
        <p className="mt-1 text-2xl font-bold">{money(totalBalance)}</p>
      </div>

      <div className="mt-4 space-y-2">
        {balances.length ? (
          balances.map((item) => (
            <div
              key={item.method}
              className="rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{item.method}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Income {money(item.income)} · Expense {money(item.expense)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Transfer in {money(item.transferIn)} · Transfer out {money(item.transferOut)}
                  </p>
                </div>

                <p
                  className={`whitespace-nowrap font-bold ${
                    item.balance < 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {money(item.balance)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500 ring-1 ring-slate-100">
            No method balance data.
          </div>
        )}
      </div>
    </Card>
  );
}
function EditableCell({ value, field, recordType, onSave, categoryOptionsFor, methodOptionsFor }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    // A cloud refresh must never erase a value that the user is actively typing.
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const savingRef = useRef(false);
  function commit() {
    if (savingRef.current) return;
    savingRef.current = true;
    setEditing(false);
    if (String(draft) !== String(value ?? "")) {
      onSave(draft);
    }
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer rounded px-1 py-0.5 hover:bg-slate-100"
        onClick={() => { savingRef.current = false; setEditing(true); }}
      >
      {value ? (
  field === "category"
    ? formatCategoryLabel(value)
    : field === "amount"
      ? Number(value).toFixed(2)
      : value
) : (
  <span className="italic text-slate-400">—</span>
)}
      </span>
    );
  }

if (field === "category" || field === "method") {
  const baseList = field === "category" ? categoryOptionsFor(recordType) : methodOptionsFor(recordType);
  const list = value ? uniqueOptions(baseList, [value]) : baseList;

    return (
      <select
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className="rounded border border-slate-300 px-1 py-0.5 text-xs outline-none"
      >
{list.map((x) => (
  <option key={x} value={x}>
    {field === "category" ? formatCategoryLabel(x) : x}
  </option>
))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={field === "date" ? "date" : "text"}
      inputMode={field === "amount" ? "decimal" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="rounded border border-slate-300 px-1 py-0.5 text-xs outline-none"
    />
  );
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
    version: Number(row.version || 1),
    updated_at: row.updated_at || row.created_at,
    deleted_at: row.deleted_at || null,
  };
}
function normalizeTransfer(row) {
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
          <p className="mt-3 text-sm text-slate-600">This unapproved development build only allows the isolated MH Finance Test database. The live Finance App database is blocked. Please check the Preview environment variables.</p>
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
  const [localToday, setLocalToday] = useState(today());
  const [dataLoading, setDataLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [records, setRecords] = useState([]);
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [deletedTransfers, setDeletedTransfers] = useState([]);
  const [undoTransfer, setUndoTransfer] = useState(null);
  const [monthRows, setMonthRows] = useState([]);
  const [budgetMonth, setBudgetMonth] = useState(monthNow());
  const [forecastPlans, setForecastPlans] = useState([]);
  const [undoDeleted, setUndoDeleted] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [settingsVersion, setSettingsVersion] = useState(null);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const budgetsRef = useRef(DEFAULT_BUDGETS);
  const settingsVersionRef = useRef(null);
  const settingsQueueRef = useRef(Promise.resolve());
  const budgetSaveTimerRef = useRef(null);
  const recordsLoadCounterRef = useRef(0);
  const liveUserIdRef = useRef(null);
  const undoTimeoutRef = useRef(null);
  const undoTransferTimeoutRef = useRef(null);
  const pendingTransfersRef = useRef(new Set());
  const transferCreationPendingRef = useRef(false);
  const pendingRecordsRef = useRef(new Set());
  const reloadDebounceRef = useRef(null);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [customOptions, setCustomOptions] = useState(DEFAULT_CUSTOM_OPTIONS);
  const [form, setForm] = useState({ type: "expense", amount: "0.00", category: "饮食", method: "TNG", note: "", date: today() });
  const [transferForm, setTransferForm] = useState({
  fromMethod: "BANK",
  toMethod: "TNG",
  amount: "0.00",
  note: "",
  date: today(),
});
  const [deleteOptionPanel, setDeleteOptionPanel] = useState({ kind: "", type: "" });
  const [calculationText, setCalculationText] = useState("0.00");
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
  const [incomeCoinTrigger, setIncomeCoinTrigger] = useState(0);
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
    // Refresh date-sensitive views at local midnight even if the tab stays open.
    let lastDay = today();
    const checkDate = () => {
      const next = today();
      if (next === lastDay) return;
      const prior = lastDay;
      lastDay = next;
      setLocalToday(next);
      setForm((v) => v.date === prior ? { ...v, date: next } : v);
      setTransferForm((v) => v.date === prior ? { ...v, date: next } : v);
      setSelectedMonth((v) => v === prior.slice(0,7) ? next.slice(0,7) : v);
      setBudgetMonth((v) => v === prior.slice(0,7) ? next.slice(0,7) : v);
      setSelectedYear((v) => v === prior.slice(0,4) ? next.slice(0,4) : v);
    };
    const id = window.setInterval(checkDate, 30000);
    window.addEventListener("focus", checkDate);
    document.addEventListener("visibilitychange", checkDate);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", checkDate);
      document.removeEventListener("visibilitychange", checkDate);
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setAuthLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setSyncStatus(error.message);
      liveUserIdRef.current = data.session?.user?.id || null;
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setAuthLoading(false);
    }).catch((error) => {
      if (mounted) { setSyncStatus(error.message); setAuthLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      liveUserIdRef.current = nextSession?.user?.id || null;
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (user) {
      liveUserIdRef.current = user.id;
      setInitialDataReady(false);
      loadCloudData();
    } else {
      recordsLoadCounterRef.current += 1;
      liveUserIdRef.current = null;
      settingsVersionRef.current = null;
      budgetsRef.current = DEFAULT_BUDGETS;
      setInitialDataReady(false);
      setRecords([]);
      setDeletedRecords([]);
      setTransfers([]);
      setDeletedTransfers([]);
      setMonthRows([]);
      setForecastPlans([]);
      setUndoTransfer(null);
      setBudgets(DEFAULT_BUDGETS);
      setCustomOptions(DEFAULT_CUSTOM_OPTIONS);
      setUndoDeleted(null);
      setSettingsVersion(null);
    }
    return () => {
      recordsLoadCounterRef.current += 1;
      clearTimeout(reloadDebounceRef.current);
      clearTimeout(budgetSaveTimerRef.current);
      clearTimeout(undoTimeoutRef.current);
      clearTimeout(undoTransferTimeoutRef.current);
    };
  }, [user?.id]);

  // Realtime is a change notification; always refetch verified pages after a change.
  // Reconnect/focus reconciliation covers missed events during sleep or network loss.
  useEffect(() => {
    if (!user || !supabase) return;
    const accountId = user.id;
    const scheduleRefresh = () => {
      if (liveUserIdRef.current !== accountId) return;
      clearTimeout(reloadDebounceRef.current);
      reloadDebounceRef.current = setTimeout(() => {
        if (liveUserIdRef.current === accountId) loadCloudData({ background: true });
      }, 350);
    };
    const channel = supabase.channel("finance-updates-" + accountId);
    for (const table of ["records", "transfers", "user_settings", "monthly_budgets"]) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table, filter: "user_id=eq." + accountId,
      }, scheduleRefresh);
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleRefresh();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncStatus("Live sync interrupted — reconnecting; refresh when online.");
      }
    });
    const onFocus = () => scheduleRefresh();
    const onOnline = () => scheduleRefresh();
    const onVisibility = () => { if (!document.hidden) scheduleRefresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) scheduleRefresh();
    }, 120000);
    return () => {
      clearTimeout(reloadDebounceRef.current);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => localStorage.setItem(SOUND_KEY, String(soundEnabled)), [soundEnabled]);
  useEffect(() => {
  localStorage.setItem(BALANCE_LIMIT_KEY, String(balanceLimit || "1500"));
}, [balanceLimit]);
  useEffect(() => {
  localStorage.setItem(CUSTOM_CARD_TEXT_KEY, customCardText);
}, [customCardText]);

useEffect(() => {
  try {
    if (customCardImage) {
      localStorage.setItem(CUSTOM_CARD_IMAGE_KEY, customCardImage);
    } else {
      localStorage.removeItem(CUSTOM_CARD_IMAGE_KEY);
    }
  } catch {
    localStorage.removeItem(CUSTOM_CARD_IMAGE_KEY);
    setCustomCardImage("");
    alert("Image is too large to save. Please upload a smaller image.");
  }
}, [customCardImage]);

useEffect(() => {
  setForm((previous) => {
    const categoryList = categoryOptionsFor(previous.type);
    const methodList = methodOptionsFor(previous.type);

    return {
      ...previous,
      category: categoryList.includes(previous.category) ? previous.category : categoryList[0],
      method: methodList.includes(previous.method) ? previous.method : methodList[0],
    };
  });
}, [form.type, customOptions]);

  async function loadCloudData({ background = false } = {}) {
    const accountId = user?.id;
    if (!accountId || !supabase) return;
    const requestId = ++recordsLoadCounterRef.current;
    const isCurrent = () => requestId === recordsLoadCounterRef.current && liveUserIdRef.current === accountId;
    if (!background) setInitialDataReady(false);
    setDataLoading(true);
    setSyncProgress("");
    setSyncStatus(background ? "Refreshing finance data..." : "Loading complete cloud data...");
    try {
      const progress = (loaded, total, table) => {
        if (isCurrent()) setSyncProgress(table + ": " + loaded + " / " + total);
      };
      const recordRows = await loadEveryOwnedRow(
        supabase, "records",
        "id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at",
        accountId, progress
      );
      if (!isCurrent()) return;
      const transferRows = await loadEveryOwnedRow(
        supabase, "transfers",
        "id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at",
        accountId, progress
      );
      if (!isCurrent()) return;
      const { data: settingsRow, error: settingsError } = await supabase
        .from("user_settings")
        .select("category_budgets,custom_options,version,forecast_plans")
        .eq("user_id", accountId)
        .maybeSingle();
      if (settingsError) throw settingsError;
      if (!isCurrent()) return;
      const { data: savedMonths, error: monthError } = await supabase
        .from("monthly_budgets")
        .select("user_id,month,category_budgets,version,updated_at")
        .eq("user_id",accountId)
        .order("month",{ascending:false})
        .limit(1000);
      if (monthError) throw monthError;
      if ((savedMonths || []).length === 1000) throw new Error("Monthly budget history reached the read cap; refusing incomplete results.");
      if (!isCurrent()) return;
      const byNewest = (a, b) => String(b.date || "").localeCompare(String(a.date || ""))
        || new Date(b.created_at || 0) - new Date(a.created_at || 0);
      const { active, deleted } = splitRecordStatus(recordRows.slice().sort(byNewest).map(normalizeRecord));
      // A complete, count-checked snapshot replaces all three states together.
      setRecords(active);
      setDeletedRecords(deleted);
      const {active:activeTransfers,deleted:trashTransfers} = splitRecordStatus(transferRows.slice().sort(byNewest).map(normalizeTransfer));
      setTransfers(activeTransfers);
      setDeletedTransfers(trashTransfers);
      setMonthRows(savedMonths || []);
      const nextBudgets = settingsRow?.category_budgets
        ? { ...DEFAULT_BUDGETS, ...settingsRow.category_budgets }
        : DEFAULT_BUDGETS;
      budgetsRef.current = nextBudgets;
      setBudgets(nextBudgets);
      setCustomOptions(settingsRow?.custom_options
        ? { ...DEFAULT_CUSTOM_OPTIONS, ...settingsRow.custom_options }
        : DEFAULT_CUSTOM_OPTIONS);
      setForecastPlans(Array.isArray(settingsRow?.forecast_plans) ? settingsRow.forecast_plans : []);
      const version = settingsRow ? Number(settingsRow.version || 1) : null;
      settingsVersionRef.current = version;
      setSettingsVersion(version);
      setSyncStatus("Cloud synced — all records loaded");
      setSyncProgress("");
      setInitialDataReady(true);
      setDataLoading(false);
    } catch (error) {
      if (!isCurrent()) return;
      setSyncStatus("Cloud sync failed: " + (error.message || "unknown error") + ". No partial totals were applied.");
      setSyncProgress("");
      setDataLoading(false);
    }
  }

  // Settings writes are serialized, version-checked, and patch only one field.
  // This prevents a budget update from overwriting someone else's custom-options edits.
  function queueSettingsField(column, value) {
    const accountId = user?.id;
    if (!accountId) return Promise.resolve(false);
    settingsQueueRef.current = settingsQueueRef.current.catch(() => false).then(async () => {
      if (liveUserIdRef.current !== accountId) return false;
      const currentVersion = settingsVersionRef.current;
      let request;
      if (currentVersion === null) {
        request = supabase.from("user_settings").insert({ user_id: accountId, [column]: value });
      } else {
        request = supabase.from("user_settings")
          .update({ [column]: value })
          .eq("user_id", accountId)
          .eq("version", currentVersion);
      }
      try {
        const { data, error } = await request.select("version").maybeSingle();
        if (liveUserIdRef.current !== accountId) return false;
        if (error) throw error;
        if (!data) {
          setSyncStatus("Settings conflict — another device updated settings; reloading.");
          await loadCloudData({ background: true });
          alert("Settings were changed on another device. Your change was not saved. Latest settings have been loaded.");
          return false;
        }
        const nextVersion = Number(data.version);
        settingsVersionRef.current = nextVersion;
        setSettingsVersion(nextVersion);
        setSyncStatus("Settings synced");
        return true;
      } catch (error) {
        setSyncStatus("Settings not saved: " + error.message + ". Please retry.");
        return false;
      }
    });
    return settingsQueueRef.current;
  }

  function saveBudgets(nextBudgets) {
    queueSettingsField("category_budgets", nextBudgets);
  }

  function saveCustomOptions(nextOptions) {
    queueSettingsField("custom_options", nextOptions);
  }


  async function saveMonthlyBudget(month, nextBudgets, expectedVersion) {
    if (!user) return false;
    const accountId = user.id;
    let budgetsToSave;
    try {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid budget month.");
      budgetsToSave = normalizeBudgetsInput(nextBudgets);
      const query = expectedVersion == null
        ? supabase.from("monthly_budgets").insert({
            user_id: accountId, month, category_budgets: budgetsToSave,
          })
        : supabase.from("monthly_budgets").update({
            category_budgets: budgetsToSave,
          }).eq("user_id", accountId).eq("month", month).eq("version", expectedVersion);
      const {data,error} = await query.select("user_id,month,category_budgets,version,updated_at").maybeSingle();
      if (error) throw error;
      if (liveUserIdRef.current !== accountId) return false;
      if (!data) {
        setSyncStatus("Monthly budget conflict; no other device's budget was overwritten.");
        alert("This month budget was changed on another device. Reopen this month after refreshing.");
        await loadCloudData({background:true});
        return false;
      }
      setMonthRows(current => [data, ...current.filter(row=>row.month!==month)]);
      setSyncStatus("Saved monthly budget " + month);
      return true;
    } catch(e) {
      setSyncStatus("Budget not saved: " + e.message);
      alert("Budget not saved. It may have been changed on another device: " + e.message);
      await loadCloudData({background:true});
      return false;
    }
  }

  async function saveTemplateBudget(nextBudgets) {
    const clean = normalizeBudgetsInput(nextBudgets);
    const ok = await queueSettingsField("category_budgets",clean);
    if(ok) {budgetsRef.current = clean;setBudgets(clean);}
    else alert("Default budget template was not saved. Please refresh and try again.");
    return ok;
  }

  async function saveExpectedIncomePlans(nextPlans) {
    try {
      if (!Array.isArray(nextPlans) || nextPlans.length>200) throw new Error("Too many planned income entries.");
      const normalized = nextPlans.map(plan => ({
        id:String(plan.id),
        date:requireCalendarDate(plan.date),
        amount:parseEditedAmount(plan.amount),
        note:String(plan.note||"").trim().slice(0,300),
      }));
      // Existing past-dated plans may remain visible/removable; they are excluded from future forecasts.
      const ok=await queueSettingsField("forecast_plans",normalized);
      if (ok) setForecastPlans(normalized);
      else alert("Expected income was not saved. Refresh and try again.");
      return ok;
    } catch(e) {alert(e.message);return false;}
  }

  function addCustomOption(kind, type) {
  const isCategory = kind === "category";
  const label = isCategory ? "category" : "method";
  const input = window.prompt(`Enter new ${type} ${label}:`);
  const newValue = String(input || "").trim();

  if (!newValue) return null;

  if ([ADD_CATEGORY_VALUE, ADD_METHOD_VALUE, DELETE_CATEGORY_VALUE, DELETE_METHOD_VALUE].includes(newValue)) {
    alert("This name is not allowed.");
    return null;
  }

  if (!isCategory) {
    const currentMethods = uniqueOptions(customOptions.expenseMethods, customOptions.incomeMethods);
    const allMethods = uniqueOptions(BASE_METHODS, currentMethods);

    if (allMethods.includes(newValue)) {
      return newValue;
    }

    const nextOptions = {
      ...customOptions,
      expenseMethods: uniqueOptions(customOptions.expenseMethods, [newValue]),
      incomeMethods: uniqueOptions(customOptions.incomeMethods, [newValue]),
    };

    setCustomOptions(nextOptions);
    saveCustomOptions(nextOptions);

    return newValue;
  }

  const key = type === "expense" ? "expenseCategories" : "incomeCategories";
  const baseList = categoriesFor(type);
  const currentList = customOptions[key] || [];
  const allList = uniqueOptions(baseList, currentList);

  if (allList.includes(newValue)) {
    return newValue;
  }

  const nextOptions = {
    ...customOptions,
    [key]: [...currentList, newValue],
  };

  setCustomOptions(nextOptions);
  saveCustomOptions(nextOptions);

  if (type === "expense") {
    updateBudgets((previous) => ({
      ...previous,
      [newValue]: previous[newValue] || "",
    }));
  }

  return newValue;
}
  function customOptionKey(kind, type) {
  const isCategory = kind === "category";

  if (type === "expense") {
    return isCategory ? "expenseCategories" : "expenseMethods";
  }

  return isCategory ? "incomeCategories" : "incomeMethods";
}

function deleteCustomOption(kind, type, value) {
  if (kind === "method") {
    const nextOptions = {
      ...customOptions,
      expenseMethods: (customOptions.expenseMethods || []).filter((item) => item !== value),
      incomeMethods: (customOptions.incomeMethods || []).filter((item) => item !== value),
    };

    setCustomOptions(nextOptions);
    saveCustomOptions(nextOptions);

    setForm((previous) => {
      if (previous.method !== value) return previous;

      const nextMethods = uniqueOptions(
        BASE_METHODS,
        uniqueOptions(nextOptions.expenseMethods, nextOptions.incomeMethods)
      );

      return { ...previous, method: nextMethods[0] || "TNG" };
    });

    setSyncStatus("Method deleted");
    return;
  }

  const key = customOptionKey(kind, type);
  const currentList = customOptions[key] || [];

  const nextOptions = {
    ...customOptions,
    [key]: currentList.filter((item) => item !== value),
  };

  setCustomOptions(nextOptions);
  saveCustomOptions(nextOptions);

  if (kind === "category" && type === "expense") {
    updateBudgets((previous) => {
      const nextBudgets = { ...previous };
      delete nextBudgets[value];
      return nextBudgets;
    });
  }

  setForm((previous) => {
    if (previous.type !== type) return previous;

    const baseList = categoriesFor(type);
    const nextList = uniqueOptions(baseList, nextOptions[key]);

    if (previous.category === value) {
      return { ...previous, category: nextList[0] || "" };
    }

    return previous;
  });

  setSyncStatus("Category deleted");
}

function renderDeleteCustomOptionPanel(kind, type) {
  if (deleteOptionPanel.kind !== kind || deleteOptionPanel.type !== type) {
    return null;
  }

  const key = kind === "category" ? customOptionKey(kind, type) : null;
  const list = kind === "category"
    ? customOptions[key] || []
    : uniqueOptions(customOptions.expenseMethods, customOptions.incomeMethods);
  const label = kind === "category" ? "category" : "method";

  return (
    <div className="mt-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-600">
          Delete custom {type} {label}
        </p>
        <button
          type="button"
          onClick={() => setDeleteOptionPanel({ kind: "", type: "" })}
          className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200"
        >
          Close
        </button>
      </div>

      {list.length ? (
        <div className="flex flex-wrap gap-2">
          {list.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                const confirmed = window.confirm(`Delete "${item}" from custom ${label} list? Existing records will not be deleted.`);
                if (confirmed) deleteCustomOption(kind, type, item);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200"
            >
              <span>{kind === "category" ? formatCategoryLabel(item) : item}</span>
              <span className="text-red-600">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-100">
          No custom {label} to delete.
        </p>
      )}
    </div>
  );
}
  function updateBudgets(updater) {
    const next = typeof updater === "function" ? updater(budgetsRef.current) : updater;
    budgetsRef.current = next;
    setBudgets(next);
    clearTimeout(budgetSaveTimerRef.current);
    budgetSaveTimerRef.current = setTimeout(() => {
      budgetSaveTimerRef.current = null;
      saveBudgets(next);
    }, 500);
  }
const expenseCategoryOptions = useMemo(
  () => uniqueOptions(EXPENSE_CATEGORIES, customOptions.expenseCategories),
  [customOptions.expenseCategories]
);

const incomeCategoryOptions = useMemo(
  () => uniqueOptions(INCOME_CATEGORIES, customOptions.incomeCategories),
  [customOptions.incomeCategories]
);

const customMethodOptions = useMemo(
  () => uniqueOptions(customOptions.expenseMethods, customOptions.incomeMethods),
  [customOptions.expenseMethods, customOptions.incomeMethods]
);

const expenseMethodOptions = useMemo(
  () => uniqueOptions(EXPENSE_METHODS, customMethodOptions),
  [customMethodOptions]
);

const incomeMethodOptions = useMemo(
  () => uniqueOptions(INCOME_METHODS, customMethodOptions),
  [customMethodOptions]
);

const categoryOptionsFor = (type) => (type === "expense" ? expenseCategoryOptions : incomeCategoryOptions);
const methodOptionsFor = () => expenseMethodOptions;
  const filteredRecords = useMemo(() => filterRecords(records, filterMode, selectedMonth, selectedYear, keyword), [records, filterMode, selectedMonth, selectedYear, keyword]);
  const expenseRecords = filteredRecords.filter((r) => r.type === "expense");
  const income = sumType(records, "income");
  const expense = sumType(records, "expense");
  const filteredIncome = sumType(filteredRecords, "income");
  const filteredExpense = sumType(filteredRecords, "expense");
  const filterLabel = filterMode === "all" ? "全部" : filterMode === "month" ? selectedMonth : filterMode === "year" ? selectedYear : filterMode === "recent30" ? "最近 30 天" : filterMode === "recent7" ? "最近 7 天" : "最近 3 天";
  const chartLabel = (d) => filterMode === "month" ? d.slice(8) : filterMode === "all" ? d : d.slice(5);
  const categoryData = useMemo(() => group(expenseRecords, (r) => r.category), [expenseRecords]);
  const methodData = useMemo(() => group(expenseRecords, (r) => recordMethod(r)), [expenseRecords]);
const accountMethodOptions = useMemo(() => {
  const defaultMethods = ["TNG", "CASH", "BANK", "GRAB PAY"];
  const normalizedCustomMethods = (customMethodOptions || [])
    .map(normalizeMethodForBalance)
    .filter(Boolean);

  return uniqueOptions(defaultMethods, normalizedCustomMethods);
}, [customMethodOptions]);

const methodBalances = useMemo(() => {
  const map = {};

  const ensureMethod = (method) => {
    const normalizedMethod = normalizeMethodForBalance(method);
    if (!normalizedMethod) return null;

    if (!map[normalizedMethod]) {
      map[normalizedMethod] = {
        method: normalizedMethod,
        income: 0,
        expense: 0,
        transferIn: 0,
        transferOut: 0,
        balance: 0,
      };
    }

    return map[normalizedMethod];
  };

  accountMethodOptions.forEach(ensureMethod);

  records.forEach((record) => {
    const row = ensureMethod(recordMethod(record));
    if (!row) return;

    const amount = Number(record.amount || 0);

    if (record.type === "income") {
      row.income += amount;
    } else {
      row.expense += amount;
    }
  });

  transfers.forEach((transfer) => {
    const amount = Number(transfer.amount || 0);

    const fromRow = ensureMethod(transfer.fromMethod);
    const toRow = ensureMethod(transfer.toMethod);

    if (fromRow) fromRow.transferOut += amount;
    if (toRow) toRow.transferIn += amount;
  });

  return Object.values(map)
    .map((row) => ({
      ...row,
      balance: row.income - row.expense + row.transferIn - row.transferOut,
    }))
    .filter(
      (row) =>
        row.income !== 0 ||
        row.expense !== 0 ||
        row.transferIn !== 0 ||
        row.transferOut !== 0 ||
        accountMethodOptions.includes(row.method)
    )
    .sort((a, b) => {
      const aIndex = accountMethodOptions.indexOf(a.method);
      const bIndex = accountMethodOptions.indexOf(b.method);

      if (aIndex === -1 && bIndex === -1) return a.method.localeCompare(b.method);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
}, [accountMethodOptions, records, transfers]);
  const spentMap = useMemo(() => {
  const map = Object.fromEntries(expenseCategoryOptions.map((c) => [c, 0]));
  expenseRecords.forEach((r) => {
    map[r.category] = (map[r.category] || 0) + Number(r.amount || 0);
  });
  return map;
}, [expenseRecords, expenseCategoryOptions]);
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
}, [records, localToday]);
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
 function playAudioEffect(src, volume = 0.75) {
  if (!soundEnabled) return;

  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

function playCoinRainSound() {
  playAudioEffect("/coin-rain.mp3", 0.75);
}

function playIncomeCoinSound() {
  playAudioEffect("/coin-spin.mp3", 0.85);
}

async function addRecord(e) {
  e.preventDefault();
  if (!user) return alert("Please sign in first.");

 const amount = parseMoneyInput(form.amount);
  if (!amount || amount <= 0) return alert("Please enter a valid amount.");

  const payload = toRecordPayload(
    { ...form, amount, note: form.note.trim() },
    user.id
  );

  const { data, error } = await supabase
    .from("records")
    .insert(payload)
    .select("id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at")
    .single();

  if (error) return alert(error.message);

  const insertedRecord = normalizeRecord(data);

  setRecords((p) => [insertedRecord, ...p]);
  setForm((p) => ({ ...p, amount: "0.00", note: "", date: today() }));
  setSyncStatus("Record added to cloud");

if (insertedRecord.type === "expense") {
  playCoinRainSound();
  setCoinRainTrigger(Date.now());
} else if (insertedRecord.type === "income") {
  playIncomeCoinSound();
  setIncomeCoinTrigger(Date.now());
}
}
  async function addTransfer(event) {
    event.preventDefault();
    if (!user) {alert("Please sign in first.");return;}
    if (transferCreationPendingRef.current) return;
    const amount = parseMoneyInput(transferForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount*100))) {
      alert("Please enter a valid positive transfer amount."); return;
    }
    if (transferForm.fromMethod === transferForm.toMethod) {
      alert("From Method and To Method cannot be the same."); return;
    }
    try {requireCalendarDate(transferForm.date);} catch(e){alert(e.message);return;}

    transferCreationPendingRef.current = true;
    try {
      const payload = {
        user_id:user.id,from_method:transferForm.fromMethod,to_method:transferForm.toMethod,
        amount,note:String(transferForm.note||"").trim(),date:transferForm.date,
      };
      const {data,error}=await supabase.from("transfers")
        .insert(payload)
        .select("id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at")
        .single();
      if (error) throw error;
      setTransfers(rows => [normalizeTransfer(data),...rows]);
      setTransferForm(previous => ({
        ...previous,amount:"0.00",note:"",date:today(),
      }));
      setSyncStatus("Transfer added to cloud");
    }catch(error){
      setSyncStatus("Transfer could not be saved: "+error.message);
      alert(error.message);
    }finally{
      transferCreationPendingRef.current = false;
    }
  }

  async function updateTransfer(transferId, edit) {
    const current = transfers.find(r=>r.id===transferId);
    if (!current || !user || pendingTransfersRef.current.has(transferId)) return false;
    let payload;
    try {
      const amount=parseEditedAmount(edit.amount);
      requireCalendarDate(edit.date);
      if (!edit.fromMethod || !edit.toMethod || edit.fromMethod===edit.toMethod) {
        throw new Error("From and To methods must be different.");
      }
      payload={
        from_method:edit.fromMethod,to_method:edit.toMethod,
        amount, date:edit.date,note:String(edit.note||"").trim(),
      };
    } catch(e) {alert(e.message);return false;}
    const fromBalance=methodBalances.find(x=>x.method===normalizeMethodForBalance(edit.fromMethod))?.balance??0;
    if (fromBalance < payload.amount) {
      setSyncStatus("Notice: the recorded source balance is below the transfer amount; opening balances may not be included.");
    }
    pendingTransfersRef.current.add(transferId);
    try {
      const {data,error}=await supabase.from("transfers")
        .update(payload)
        .eq("id",transferId).eq("user_id",user.id)
        .eq("version",current.version).is("deleted_at",null)
        .select("id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if(error)throw error;
      if(!data){
        setSyncStatus("Transfer conflict — latest cloud data loaded; edit not applied.");
        await loadCloudData({background:true});
        alert("The transfer changed on another device. Your edit was not saved.");
        return false;
      }
      const edited=normalizeTransfer(data);
      setTransfers(rows=>rows.map(r=>r.id===transferId?edited:r));
      setSyncStatus("Transfer updated");
      return true;
    }catch(e){setSyncStatus("Transfer update failed: "+e.message);alert(e.message);return false;}
    finally{pendingTransfersRef.current.delete(transferId);}
  }

  async function deleteTransfer(transferId) {
    const current=transfers.find(r=>r.id===transferId);
    if(!current || !user || pendingTransfersRef.current.has(transferId))return false;
    pendingTransfersRef.current.add(transferId);
    try {
      const {data,error}=await supabase.from("transfers")
        .update({deleted_at:new Date().toISOString()})
        .eq("id",transferId).eq("user_id",user.id)
        .eq("version",current.version).is("deleted_at",null)
        .select("id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if(error)throw error;
      if(!data){await loadCloudData({background:true});alert("Transfer changed on another device; nothing deleted.");return false;}
      const deleted=normalizeTransfer(data);
      setTransfers(rows=>rows.filter(r=>r.id!==transferId));
      setDeletedTransfers(rows=>[deleted,...rows.filter(r=>r.id!==transferId)]);
      setUndoTransfer(deleted);
      clearTimeout(undoTransferTimeoutRef.current);
      undoTransferTimeoutRef.current=setTimeout(()=>setUndoTransfer(null),10000);
      setSyncStatus("Transfer moved to Recycle Bin");
      return true;
    }catch(e){setSyncStatus("Transfer delete failed: "+e.message);alert(e.message);return false;}
    finally{pendingTransfersRef.current.delete(transferId);}
  }

  async function restoreTransfer(transferId) {
    const current=deletedTransfers.find(r=>r.id===transferId);
    if(!current || !user || pendingTransfersRef.current.has(transferId))return false;
    pendingTransfersRef.current.add(transferId);
    try{
      const {data,error}=await supabase.from("transfers")
        .update({deleted_at:null})
        .eq("id",transferId).eq("user_id",user.id)
        .eq("version",current.version).not("deleted_at","is",null)
        .select("id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if(error)throw error;
      if(!data){await loadCloudData({background:true});alert("Transfer changed on another device; please refresh.");return false;}
      const restored=normalizeTransfer(data);
      setDeletedTransfers(rows=>rows.filter(r=>r.id!==transferId));
      setTransfers(rows=>[restored,...rows]);
      if(undoTransfer?.id===transferId)setUndoTransfer(null);
      setSyncStatus("Transfer restored");
      return true;
    }catch(e){setSyncStatus("Transfer restore failed: "+e.message);alert(e.message);return false;}
    finally{pendingTransfersRef.current.delete(transferId);}
  }

  function fillCalculation() {
    try {
      const total = calculate(calculationText);
      setCalculationResult(total);
      setForm((p) => ({ ...p, amount: total.toFixed(2) }));
    } catch { alert("Invalid calculation. Example: 3.50 + 12.90 + 2*5.40"); }
  }

  async function updateRecord(recordId, field, value) {
    const current = records.find((row) => row.id === recordId);
    if (!current || !user) return;
    if (pendingRecordsRef.current.has(recordId)) return;
    let updates;
    try {
      updates = field === "type"
        ? { type: value, category: categoryOptionsFor(value)[0], method: methodOptionsFor(value)[0] }
        : { [field]: field === "amount" ? parseEditedAmount(value) : value };
      if (field === "date") requireCalendarDate(value);
      if (field === "amount" && current.amount === updates.amount) return;
    } catch (error) {
      alert(error.message);
      return;
    }
    pendingRecordsRef.current.add(recordId);
    try {
      const { data, error } = await supabase.from("records")
        .update(updates)
        .eq("id", recordId)
        .eq("user_id", user.id)
        .eq("version", current.version)
        .is("deleted_at", null)
        .select("id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setSyncStatus("Conflict: this record changed on another device. Nothing overwritten.");
        await loadCloudData({ background: true });
        alert("This record was changed on another device. Your edit was not saved; latest cloud data has been loaded.");
        return;
      }
      const result = normalizeRecord(data);
      setRecords((previous) => previous.map((row) => row.id === recordId ? result : row));
      setSyncStatus("Record synced");
    } catch (error) {
      setSyncStatus("Record edit not saved: " + error.message);
      alert(error.message);
    } finally {
      pendingRecordsRef.current.delete(recordId);
    }
  }

  async function deleteRecord(recordId) {
    const current = records.find((row) => row.id === recordId);
    if (!current || !user || pendingRecordsRef.current.has(recordId)) return;
    pendingRecordsRef.current.add(recordId);
    try {
      const { data, error } = await supabase.from("records")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", recordId).eq("user_id", user.id)
        .eq("version", current.version).is("deleted_at", null)
        .select("id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await loadCloudData({ background: true });
        alert("Delete cancelled: the record changed on another device.");
        return;
      }
      const removed = normalizeRecord(data);
      setRecords((previous) => previous.filter((row) => row.id !== recordId));
      setDeletedRecords((previous) => [removed, ...previous]);
      setDeleteConfirm(null);
      setUndoDeleted(removed);
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => setUndoDeleted(null), 10000);
      setSyncStatus("Record moved to Recycle Bin — can be restored anytime.");
    } catch (error) {
      setSyncStatus("Delete failed: " + error.message);
      alert(error.message);
    } finally {
      pendingRecordsRef.current.delete(recordId);
    }
  }

  async function restoreRecord(recordId) {
    const current = deletedRecords.find((row) => row.id === recordId);
    if (!current || !user || pendingRecordsRef.current.has(recordId)) return;
    pendingRecordsRef.current.add(recordId);
    try {
      const { data, error } = await supabase.from("records")
        .update({ deleted_at: null })
        .eq("id", recordId).eq("user_id", user.id)
        .eq("version", current.version).not("deleted_at", "is", null)
        .select("id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await loadCloudData({ background: true });
        alert("Restore could not be completed: this record changed on another device. Latest data loaded.");
        return;
      }
      const restored = normalizeRecord(data);
      setDeletedRecords((previous) => previous.filter((row) => row.id !== recordId));
      setRecords((previous) => [restored, ...previous]);
      if (undoDeleted?.id === recordId) setUndoDeleted(null);
      setSyncStatus("Record restored from Recycle Bin");
    } catch (error) {
      setSyncStatus("Restore failed: " + error.message);
      alert(error.message);
    } finally {
      pendingRecordsRef.current.delete(recordId);
    }
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
  if (!initialDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5 text-slate-900">
        <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold">Verifying your finance records</h1>
          <p className="mt-3 text-sm text-slate-600">{syncStatus || "Loading..."}</p>
          {syncProgress && <p className="mt-2 text-sm font-semibold text-blue-700">{syncProgress}</p>}
          <p className="mt-2 text-xs text-slate-500">Totals remain hidden until all cloud records are loaded and checked.</p>
          <button onClick={() => loadCloudData()} className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Retry loading</button>
          <button onClick={signOut} className="ml-3 rounded-xl border border-slate-200 px-4 py-2 text-sm">Sign out</button>
        </div>
      </div>
    );
  }
const addRecordTheme =
  form.type === "income"
    ? {
        card: "bg-green-50/50 ring-green-200",
        header: "from-green-600 to-emerald-600",
        active: "bg-green-600 text-white shadow-sm",
        inactive: "text-slate-500 hover:bg-green-50 hover:text-green-700",
        button: "bg-green-600 hover:bg-green-700",
        title: "＋ Add Income",
        subtitle: "Recording money coming in",
        icon: "💰",
      }
    : {
        card: "bg-red-50/50 ring-red-200",
        header: "from-red-600 to-orange-600",
        active: "bg-red-600 text-white shadow-sm",
        inactive: "text-slate-500 hover:bg-red-50 hover:text-red-700",
        button: "bg-red-600 hover:bg-red-700",
        title: "− Add Expense",
        subtitle: "Recording money spent",
        icon: "💸",
      };
return (
  <div onClickCapture={(e) => e.target.closest("button,select") && playSound()} className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
<CoinRainEffect trigger={coinRainTrigger} />
<IncomeCoinSpinEffect trigger={incomeCoinTrigger} />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-medium text-slate-300">Personal Finance Dashboard</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">记账可视化软件</h1><p className="mt-2 text-sm text-slate-300">记录收入与支出，自动生成统计、分类比例、每日趋势和预算使用情况。</p></div>
          <div className="flex flex-wrap gap-3"><button onClick={() => setSoundEnabled((v) => !v)} className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600">{soundEnabled ? "🔊" : "🔇"} Sound</button><button type="button" disabled={!initialDataReady || dataLoading} onClick={() => { setExportOpen((v) => !v); setImportOpen(false); }} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50">⬇ Export Excel</button><button type="button" disabled={!initialDataReady || dataLoading} onClick={() => { setImportOpen((v) => !v); setExportOpen(false); }} className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600 disabled:opacity-50">⬆ Import CSV</button><button onClick={signOut} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900">Sign out</button></div>
        </header>
        {importOpen && <FinanceCsvImportPanel
          supabase={supabase} user={user}
          existingRecords={[...records,...deletedRecords]}
          onClose={() => setImportOpen(false)}
          onImported={() => loadCloudData({background:true})}
        />}
        {exportOpen && <FinanceExcelExportPanel
          records={records} deletedRecords={deletedRecords}
          transfers={transfers} deletedTransfers={deletedTransfers}
          monthRows={monthRows} budgetTemplate={budgets}
          forecastPlans={forecastPlans} dataReady={initialDataReady}
          dataLoading={dataLoading} onClose={() => setExportOpen(false)}
        />}
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          Signed in as <b>{user?.email}</b> · {dataLoading ? "Syncing..." : syncStatus || "Cloud ready"}
          {syncProgress && <span className="ml-2 font-semibold text-blue-700">{syncProgress}</span>}
        </div>
        {isTestEnvironment && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <span className="mr-2">🧪 TEST MODE / 测试环境</span>
            Only fake transactions. This development build cannot connect to the production database.
          </div>
        )}
        {undoDeleted && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-200">
            <span><b>Moved to Recycle Bin:</b> {undoDeleted.category} · {money(undoDeleted.amount)}</span>
            <button type="button" onClick={() => restoreRecord(undoDeleted.id)} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800">Undo</button>
          </div>
        )}
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

        <section className="grid gap-4 md:grid-cols-3"><StatCard title="Total Income" value={money(income)} icon="📈" desc="Overall records" /><StatCard title="Total Expense" value={money(expense)} icon="📉" desc="Overall records" /><BalanceCard
  title="Balance"
  value={income - expense}
  desc="Overall cash flow"
  limit={balanceLimit}
  methodBalances={methodBalances}
/></section>

<section className="grid gap-6 lg:grid-cols-[380px_1fr]">
  <div className="space-y-6">
<Card className={`overflow-hidden ${addRecordTheme.card}`}>
  <div className={`-mx-5 -mt-5 mb-5 bg-gradient-to-r ${addRecordTheme.header} px-5 py-4 text-white`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{addRecordTheme.title}</h2>
        <p className="mt-1 text-sm text-white/80">{addRecordTheme.subtitle}</p>
      </div>
      <div className="rounded-2xl bg-white/20 px-3 py-2 text-2xl">{addRecordTheme.icon}</div>
    </div>
  </div>
            <form onSubmit={addRecord} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1"><button
  type="button"
  onClick={() => setForm((p) => ({ ...p, type: "expense" }))}
  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${form.type === "expense" ? "bg-red-600 text-white shadow-sm" : "text-slate-500 hover:bg-red-50 hover:text-red-700"}`}
>
  💸 Expense
</button>

<button
  type="button"
  onClick={() => setForm((p) => ({ ...p, type: "income" }))}
  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${form.type === "income" ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:bg-green-50 hover:text-green-700"}`}
>
  💰 Income
</button></div>
<label className="block">
  <span className="text-sm font-medium text-slate-600">Amount</span>
  <input
    value={form.amount}
    onChange={(event) =>
      setForm((previous) => ({
        ...previous,
        amount: formatMoneyTyping(event.target.value),
      }))
    }
    type="text"
    inputMode="numeric"
    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
  />
</label>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-sm font-bold text-slate-700">小计算器</p><textarea
  value={calculationText}
  onChange={(event) => setCalculationText(formatCalculatorTyping(event.target.value))}
  rows={3}
  placeholder="350 + 1290 + 2450"
  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
/><div className="mt-3 flex items-center justify-between gap-2"><span className="text-sm text-slate-600">{calculationResult !== null ? `Total: ${money(calculationResult)}` : "支持 + - * / 和括号"}</span><button type="button" onClick={fillCalculation} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">Calculate & Fill</button></div></div>
           
<label className="block">
  <span className="text-sm font-medium text-slate-600">Category</span>
  <select
    value={form.category}
    onChange={(event) => {
      const value = event.target.value;

      if (value === ADD_CATEGORY_VALUE) {
        const added = addCustomOption("category", form.type);
        if (added) setForm((previous) => ({ ...previous, category: added }));
        setDeleteOptionPanel({ kind: "", type: "" });
        return;
      }

      if (value === DELETE_CATEGORY_VALUE) {
        setDeleteOptionPanel({ kind: "category", type: form.type });
        return;
      }

      setForm((previous) => ({ ...previous, category: value }));
      setDeleteOptionPanel({ kind: "", type: "" });
    }}
    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
  >
    {categoryOptionsFor(form.type).map((category) => (
      <option key={category} value={category}>
        {formatCategoryLabel(category)}
      </option>
    ))}
    <option value={ADD_CATEGORY_VALUE}>＋ Add new category...</option>
    <option value={DELETE_CATEGORY_VALUE}>🗑 Delete custom category...</option>
  </select>

  {renderDeleteCustomOptionPanel("category", form.type)}
</label>
              <label className="block">
  <span className="text-sm font-medium text-slate-600">Method</span>
  <select
    value={form.method}
    onChange={(event) => {
      const value = event.target.value;

      if (value === ADD_METHOD_VALUE) {
        const added = addCustomOption("method", form.type);
        if (added) setForm((previous) => ({ ...previous, method: added }));
        setDeleteOptionPanel({ kind: "", type: "" });
        return;
      }

      if (value === DELETE_METHOD_VALUE) {
        setDeleteOptionPanel({ kind: "method", type: form.type });
        return;
      }

      setForm((previous) => ({ ...previous, method: value }));
      setDeleteOptionPanel({ kind: "", type: "" });
    }}
    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
  >
    {methodOptionsFor(form.type).map((method) => (
      <option key={method} value={method}>
        {method}
      </option>
    ))}
    <option value={ADD_METHOD_VALUE}>＋ Add new method...</option>
    <option value={DELETE_METHOD_VALUE}>🗑 Delete custom method...</option>
  </select>

  {renderDeleteCustomOptionPanel("method", form.type)}
</label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Date</span><DateInput value={form.date} onChange={(date) => setForm((p) => ({ ...p, date }))} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Note</span><input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none" /></label>
              <button className={`w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${addRecordTheme.button}`}>
  {form.type === "income" ? "Add Income" : "Add Expense"}
</button>
    </form>
    </Card>

    <TodaySummaryCard stats={todaySummaryStats} />

<FinanceTransferPanel
  transferForm={transferForm}
  setTransferForm={setTransferForm}
  methodOptions={uniqueOptions(accountMethodOptions, transfers.flatMap(row => [row.fromMethod,row.toMethod]))}
  transfers={transfers}
  deletedTransfers={deletedTransfers}
  undoTransfer={undoTransfer}
  onTransfer={addTransfer}
  onUpdateTransfer={updateTransfer}
  onDeleteTransfer={deleteTransfer}
  onRestoreTransfer={restoreTransfer}
/>

  </div>

  <div className="space-y-6">
            <Card><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-xl font-bold">Filters</h2><div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:justify-end"><select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"><option value="all">全部</option><option value="month">按月份</option><option value="year">按年份</option><option value="recent30">最近 30 天</option><option value="recent7">最近 7 天</option><option value="recent3">最近 3 天</option></select>{filterMode === "month" && <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" />}{filterMode === "year" && <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" />}<input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search category, method or note" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none" /></div></div></Card>
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard title="Filtered Income" value={money(filteredIncome)} icon="📈" desc={"Current filter: " + filterLabel} />
              <StatCard title="Filtered Expense" value={money(filteredExpense)} icon="📉" desc={"Current filter: " + filterLabel} />
              <BalanceCard title="Filtered Balance" value={filteredIncome - filteredExpense} desc={"Current filter: " + filterLabel} limit={balanceLimit} />
            </section>
            <FinanceBudgetPanel
              records={records}
              budgetMonth={budgetMonth}
              setBudgetMonth={setBudgetMonth}
              monthRows={monthRows}
              budgetTemplate={budgets}
              categories={expenseCategoryOptions}
              onSaveMonthly={saveMonthlyBudget}
              onSaveTemplate={saveTemplateBudget}
            />
            <section className="grid gap-6 xl:grid-cols-2">
              <FinanceForecastPanel
                records={records}
                selectedMonth={forecastMonth}
                asOfDate={localToday}
                plannedIncomes={forecastPlans}
                onSavePlans={saveExpectedIncomePlans}
              />
              <div className="space-y-6">
                <HeatmapCard days={heatmapDays} label={filterLabel} />
                <TopExpensesCard
                  records={topExpenses} label={filterLabel}
                  category={topExpenseCategory} setCategory={setTopExpenseCategory}
                  expenseCategoryOptions={expenseCategoryOptions}
                />
              </div>
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Card><h2 className="text-xl font-bold">Daily Income vs Expense</h2><p className="mt-1 text-sm text-slate-500">Current range: {filterLabel}</p><div className="mt-4 h-64">{dailyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Legend /><Bar dataKey="income" name="Income" fill="#22c55e" /><Bar dataKey="expense" name="Expense" fill="#ef4444" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No data.</div>}</div><div className="mt-5 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="mb-2 flex justify-between gap-2"><p className="text-sm font-bold text-slate-700">消费趋势图</p><select
  value={trendCategory}
  onChange={(e) => setTrendCategory(e.target.value)}
  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
>
  <option value="all">全部分类</option>
  {expenseCategoryOptions.map((category) => (
    <option key={category} value={category}>
      {formatCategoryLabel(category)}
    </option>
  ))}
</select></div><div className="h-36">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip content={<TrendTooltip records={filteredRecords} category={trendCategory} />} /><Legend /><Line type="monotone" dataKey="expense" name="Expense" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No expense trend data.</div>}</div><div className="mt-4 border-t border-slate-200 pt-3"><p className="mb-2 text-sm font-bold text-slate-700">Filtered Balance Trend</p><div className="h-36">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Legend /><Line connectNulls type="monotone" dataKey="balanceGreen" name="Balance > RM1500" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} /><Line connectNulls type="monotone" dataKey="balanceRed" name="Balance ≤ RM1500" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No balance trend data.</div>}</div></div></div></Card>
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
                        <EditableCell value={record.date} field="date" recordType={record.type} onSave={(v) => updateRecord(record.id, "date", v)}
categoryOptionsFor={categoryOptionsFor}
  methodOptionsFor={methodOptionsFor} />
                      </td>

                      <td className="py-3 pr-4">
<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${recordTypeStyle(record.type).badge}`}>
  {recordTypeStyle(record.type).label}
</span>
                      </td>

                      <td className="py-3 pr-4 font-medium text-slate-800">
                        <EditableCell value={record.category} field="category" recordType={record.type} onSave={(v) => updateRecord(record.id, "category", v)}
categoryOptionsFor={categoryOptionsFor}
  methodOptionsFor={methodOptionsFor} />
                      </td>

                      <td className="py-3 pr-4 text-slate-600">
                        <EditableCell value={recordMethod(record)} field="method" recordType={record.type} onSave={(v) => updateRecord(record.id, "method", v)}
categoryOptionsFor={categoryOptionsFor}
  methodOptionsFor={methodOptionsFor} />
                      </td>

<td className={`py-3 pr-4 font-bold ${recordTypeStyle(record.type).amount}`}>
  <span className="mr-1">{recordTypeStyle(record.type).sign}</span>
  <EditableCell
    value={record.amount}
    field="amount"
    recordType={record.type}
    onSave={(v) => updateRecord(record.id, "amount", v)}
    categoryOptionsFor={categoryOptionsFor}
    methodOptionsFor={methodOptionsFor}
  />
</td>

                      <td className="py-3 pr-4 text-slate-500">
                        <EditableCell value={record.note || ""} field="note" recordType={record.type} onSave={(v) => updateRecord(record.id, "note", v)} categoryOptionsFor={categoryOptionsFor}
  methodOptionsFor={methodOptionsFor} />
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
                            className="rounded-lg px-2 py-1 text-xs font-bold text-red-700 opacity-100 transition hover:bg-red-50 md:text-slate-400 md:opacity-0 md:hover:text-red-600 md:group-hover:opacity-100"
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

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Recycle Bin / 回收站</h2>
              <p className="mt-1 text-sm text-slate-500">
                {deletedRecords.length} saved deleted records · Deleted entries are excluded from all balances and reports.
              </p>
            </div>
            <button type="button" onClick={() => setTrashOpen((value) => !value)}
              aria-expanded={trashOpen}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
              {trashOpen ? "Hide Recycle Bin" : "Open Recycle Bin"}
            </button>
          </div>
          {trashOpen && (
            <div className="mt-4 space-y-2">
              {deletedRecords.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">The Recycle Bin is empty.</p>
              ) : deletedRecords.slice().sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)).map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{record.category} · {money(record.amount)}</p>
                    <p className="text-xs text-slate-500">{record.date} · {record.type} · {recordMethod(record)} · {record.note || "No note"}</p>
                    <p className="mt-1 text-xs text-slate-400">Deleted {new Date(record.deleted_at).toLocaleString("en-MY")}</p>
                  </div>
                  <button type="button" onClick={() => restoreRecord(record.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">Records remain recoverable after 10 seconds, after closing this tab, and across devices. There is no permanent delete button.</p>
        </Card>

        <footer className="pb-6 text-center text-xs text-slate-400">记账可视化软件 · Data synced with Supabase cloud · {records.length} total records</footer>
      </div>
    </div>
  );
}
