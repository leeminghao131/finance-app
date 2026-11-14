import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, hasSupabaseEnv, isTestEnvironment } from "./supabaseClient";
import { parseEditedAmount } from "./financeData";
import { localDateMY, localMonthMY, localYearMY, shiftCalendarDay, calendarDaysRange, previousCalendarDays, calendarMonthDays, requireCalendarDate } from "./financeCalendar";
import { normalizeBudgetsInput } from "./financeInsights.js";
import FinanceTransferPanel from "./FinanceTransferPanel.jsx";
import FinanceBudgetPanel from "./FinanceBudgetPanel.jsx";
import FinanceForecastPanel from "./FinanceForecastPanel.jsx";
import FinanceOpeningBalancePanel from "./FinanceOpeningBalancePanel.jsx";
import FinanceMonthComparison from "./FinanceMonthComparison.jsx";
import FinanceQuickNotes from "./FinanceQuickNotes.jsx";
import FinanceSavingsGoals from "./FinanceSavingsGoals.jsx";
import FinanceAdvancedFilters from "./FinanceAdvancedFilters.jsx";
import FinanceAdvancedResults from "./FinanceAdvancedResults.jsx";
import FinanceInsightsDock from "./FinanceInsightsDock.jsx";
import {validateSavedFilters,filterFinanceRecordsAdvanced} from "./financeStage1Analytics.js";
import {validateSavingsGoals,calculateSavingsAvailable} from "./financePlanning.js";
import { openingTotal, calculateMethodBalances } from "./financeOpeningBalance.js";
import FinanceOverlay from "./FinanceOverlay.jsx";
import FinanceMobileRecords from "./FinanceMobileRecords.jsx";
import FinanceTrendSummaryTooltip from "./FinanceTrendSummaryTooltip.jsx";
import FinanceExpandedTrendOverlay from "./FinanceExpandedTrendOverlay.jsx";
import FinanceCategoryBubbleChart from "./FinanceCategoryBubbleChart.jsx";
import FinanceMethodDonutChart from "./FinanceMethodDonutChart.jsx";
import "./financeUi.css";
// Load import/export tools only when opened; keep spreadsheet parsing out of the dashboard bundle.
const FinanceCsvImportPanel = React.lazy(() => import("./FinanceCsvImportPanel.jsx"));
const FinanceExcelExportPanel = React.lazy(() => import("./FinanceExcelExportPanel.jsx"));
import { normalizeRecord, normalizeTransfer, toRecordPayload } from "./financeRecords.js";
import { fetchFinanceSnapshot } from "./financeCloudService.js";
import { getRecordRequestId, confirmRecordRequest, getTransferRequestId, confirmTransferRequest } from "./financeSaveIdempotency.js";
import { CoinRainEffect, IncomeCoinSpinEffect } from "./FinanceVisualEffects.jsx";
import { FinanceLanguageProvider, FinanceLanguageButton, localizedFinanceAlert, localizedFinanceConfirm } from "./FinanceLanguageLayer.jsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
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

function formatMoneyTyping(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return "0.00";

  return (Number(digits) / 100).toFixed(2);
}

function formatCalculatorTyping(value) {
  // The calculator uses normal RM arithmetic; cents conversion belongs only to Amount keypad.
  return String(value ?? "").replaceAll("×", "*").replaceAll("x", "*")
    .replaceAll("X", "*").replaceAll("÷", "/").replaceAll("，", "+")
    .replaceAll("、", "+").replaceAll(",", "+");
}
function calculate(text) {
  const expression = String(text || "")
    .replaceAll("×", "*").replaceAll("x", "*").replaceAll("X", "*")
    .replaceAll("÷", "/").replaceAll("，", "+").replaceAll("、", "+")
    .replaceAll(",", "+").replaceAll(" ", "").replace(/[\t\n\r]/g, "");

  if (!expression || !Array.from(expression).every((c) => "0123456789+-*/().".includes(c))) {
    throw new Error("Invalid");
  }

  const value = Function(`"use strict"; return (${expression});`)();
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new Error("Invalid");
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
function StatCard({ title, value, icon, desc, action }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
        </div>
        {action || <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl">{icon}</div>}
      </div>
    </Card>
  );
}

function BalanceCard({ title, value, desc, limit, methodBalances = [], openingBalanceControl = null }) {
  const safeLimit = Number(limit || 0);
  const low = value < safeLimit;
  const [open, setOpen] = useState(false);
  const methodTriggerRef = useRef(null);

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

        {(showMethodBreakdown || openingBalanceControl) && (
          <div className="flex w-[112px] shrink-0 flex-col items-stretch gap-2">
            {showMethodBreakdown && (
                      <button
                        type="button"
                        ref={methodTriggerRef}
                        onClick={() => setOpen(true)}
                         aria-label="Open Method Balance" aria-haspopup="dialog" aria-expanded={open}
                        className="mh-modal-trigger min-h-9 w-full rounded-xl bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                      >
                        Methods
                      </button>
                    )}
            {openingBalanceControl}
          </div>
        )}
      </div>

      {showMethodBreakdown && (
        <FinanceOverlay open={open} title="Method Balance" onClose={() => setOpen(false)} widthClass="max-w-xl" triggerRef={methodTriggerRef}>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
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

                    <p className="mt-1 text-xs text-slate-500">Opening {money(item.openingBalance)}</p>
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
        </FinanceOverlay>
      )}
    </Card>
  );
}

function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />;
}

function HeatmapCard({ days, label }) {
  const max = Math.max(1, ...days.map((d) => d.amount));
  return (
    <Card>
      <h2 className="text-xl font-bold">Spending Heatmap / 消费热力图</h2>
      <p className="mt-1 text-sm text-slate-500">颜色越深 = 那天花费越高 · {label}</p>
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))" }}>
        {days.map((d) => {
          const intensity = d.amount > 0 ? 0.18 + (d.amount / max) * 0.72 : 0.06;
          return <div key={d.date} title={`${d.date}: ${money(d.amount)}`} className="rounded-xl p-2 text-center text-xs font-bold ring-1 ring-slate-100" style={{ backgroundColor: `rgba(239, 68, 68, ${intensity})`, color: d.amount > 0 ? "#7f1d1d" : "#64748b" }}><p>{d.date.slice(8)}</p><p className="mt-1 break-words text-[11px] font-bold leading-tight tabular-nums" style={{ overflowWrap: "anywhere" }}>{d.amount > 0 ? money(d.amount).replace("MYR", "RM") : "-"}</p></div>;
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {records.length ? records.map((record, index) => (
          <div key={record.id} className="flex min-w-0 flex-col justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="break-words font-bold text-slate-900">{formatCategoryLabel(record.category)} · {recordMethod(record)}</p>
                <p className="break-words text-xs text-slate-500">{record.date} · {record.note ? <span data-i18n-ignore>{record.note}</span> : "No note"}</p>
              </div>
            </div>
            <p className="break-words text-right font-bold tabular-nums text-red-600">{money(record.amount)}</p>
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
        data-i18n-ignore={field === "note" ? "" : undefined}
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
      onFocus={(event) => { if (field === "amount") event.target.select(); }}
      title={field === "amount" ? "Enter normal RM amount: 100 means RM100.00" : undefined}
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
        {rows.length ? rows.map((r) => <div key={r.id} className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100"><div className="flex justify-between gap-2"><div><p className="font-semibold text-slate-800">{r.category}</p><p className="text-xs text-slate-500">{recordMethod(r)} · {r.note ? <span data-i18n-ignore>{r.note}</span> : "No note"}</p></div><p className="font-bold text-blue-600">{money(r.amount)}</p></div></div>) : <p className="text-xs text-slate-500">No records.</p>}
      </div>
    </div>
  );
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
          <div className="mb-3 flex justify-end"><FinanceLanguageButton /></div>
          <h1 className="text-2xl font-bold text-red-700">Supabase is not configured</h1>
          <p className="mt-3 text-sm text-slate-600">This unapproved development build only allows the isolated MH Finance Test database. The live Finance App database is blocked. Please check the Preview environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex justify-end"><FinanceLanguageButton /></div>
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

function FinanceVisualizerAppContent() {
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
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const recordsTriggerRef = useRef(null);
  const budgetTriggerRef = useRef(null);
  const spendingTrendTriggerRef = useRef(null);
  const balanceTrendTriggerRef = useRef(null);
  const [budgetDraftDirty, setBudgetDraftDirty] = useState(false);
  const [forecastPlans, setForecastPlans] = useState([]);
  const [openingBalances, setOpeningBalances] = useState({});
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [advancedFilter, setAdvancedFilter] = useState(null);
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
  const recordCreationPendingRef = useRef(false);
  const confirmedCustomOptionsRef = useRef(DEFAULT_CUSTOM_OPTIONS);
  const pendingRecordsRef = useRef(new Set());
  const reloadDebounceRef = useRef(null);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [customOptions, setCustomOptions] = useState(DEFAULT_CUSTOM_OPTIONS);
  const [form, setForm] = useState({ type: "expense", amount: "", category: "饮食", method: "TNG", note: "", date: today() });
  const [transferForm, setTransferForm] = useState({
  fromMethod: "BANK",
  toMethod: "TNG",
  amount: "0.00",
  note: "",
  date: today(),
});
  const [deleteOptionPanel, setDeleteOptionPanel] = useState({ kind: "", type: "" });
  const [calculationText, setCalculationText] = useState("");
  const [amountEntryMode, setAmountEntryMode] = useState("rm");
  const [calculationResult, setCalculationResult] = useState(null);
  const [filterMode, setFilterMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(monthNow());
  const [selectedYear, setSelectedYear] = useState(yearNow());
  const [keyword, setKeyword] = useState("");
  const [selectedPieCategory, setSelectedPieCategory] = useState(null);
  const [trendCategory, setTrendCategory] = useState("all");
  const [expandedTrend, setExpandedTrend] = useState(null);
  const [topExpenseCategory, setTopExpenseCategory] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(SOUND_KEY) !== "false");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [coinRainTrigger, setCoinRainTrigger] = useState(0);
  const [incomeCoinTrigger, setIncomeCoinTrigger] = useState(0);
  const [openDates, setOpenDates] = useState({});
  // Custom card content is private to the signed-in account on this browser.
  // Preserve legacy global keys without reading, deleting or assigning them
  // to another account; never leak user A's card to user B.
  const [personalCard, setPersonalCard] = useState({ owner: null, text: "", image: "" });
  const customCardText = personalCard.owner === user?.id ? personalCard.text : "";
  const customCardImage = personalCard.owner === user?.id ? personalCard.image : "";
  const setCustomCardText = value => setPersonalCard(previous => ({
    owner: user?.id || null,
    text: typeof value === "function" ? value(previous.owner === user?.id ? previous.text : "") : value,
    image: previous.owner === user?.id ? previous.image : "",
  }));
  const setCustomCardImage = value => setPersonalCard(previous => ({
    owner: user?.id || null,
    text: previous.owner === user?.id ? previous.text : "",
    image: typeof value === "function" ? value(previous.owner === user?.id ? previous.image : "") : value,
  }));
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
      setOpeningBalances({});
      setSavingsGoals([]);
      setSavedFilters([]);
      setAdvancedFilter(null);
      setUndoTransfer(null);
      setBudgets(DEFAULT_BUDGETS);
      confirmedCustomOptionsRef.current = DEFAULT_CUSTOM_OPTIONS;
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
    if (!user?.id) {
      setPersonalCard({owner:null,text:"",image:""});
      return;
    }
    const id = user.id;
    try {
      setPersonalCard({
        owner:id,
        text:localStorage.getItem(CUSTOM_CARD_TEXT_KEY + ":" + id) || "",
        image:localStorage.getItem(CUSTOM_CARD_IMAGE_KEY + ":" + id) || "",
      });
    } catch {
      setPersonalCard({owner:id,text:"",image:""});
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || personalCard.owner !== user.id) return;
    try {
      localStorage.setItem(CUSTOM_CARD_TEXT_KEY + ":" + user.id, personalCard.text);
      if (personalCard.image)
        localStorage.setItem(CUSTOM_CARD_IMAGE_KEY + ":" + user.id, personalCard.image);
      else
        localStorage.removeItem(CUSTOM_CARD_IMAGE_KEY + ":" + user.id);
    } catch {
      // Never remove a previously persisted card on a quota failure.
      localizedFinanceAlert("Card content could not be stored on this device. Please use a smaller image.");
    }
  }, [user?.id, personalCard]);

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
    const accountId=user?.id;
    if(!accountId||!supabase)return;
    const requestId=++recordsLoadCounterRef.current;
    const isCurrent=()=>requestId===recordsLoadCounterRef.current&&liveUserIdRef.current===accountId;
    if(!background)setInitialDataReady(false);
    setDataLoading(true);setSyncProgress("");
    setSyncStatus(background?"Refreshing finance data...":"Loading complete cloud data...");
    try {
      const snapshot=await fetchFinanceSnapshot(supabase,accountId,(loaded,total,table)=>{
        if(isCurrent())setSyncProgress(table+": "+loaded+" / "+total);
      });
      if(!isCurrent())return;
      setRecords(snapshot.records);
      setDeletedRecords(snapshot.deletedRecords);
      setTransfers(snapshot.transfers);
      setDeletedTransfers(snapshot.deletedTransfers);
      setMonthRows(snapshot.monthRows);
      const settingsRow=snapshot.settingsRow;
      const nextBudgets=settingsRow?.category_budgets
        ? {...DEFAULT_BUDGETS,...settingsRow.category_budgets}
        : DEFAULT_BUDGETS;
      budgetsRef.current=nextBudgets;setBudgets(nextBudgets);
      const loadedOptions = settingsRow?.custom_options
        ? {...DEFAULT_CUSTOM_OPTIONS,...settingsRow.custom_options}
        : DEFAULT_CUSTOM_OPTIONS;
      confirmedCustomOptionsRef.current = loadedOptions;
      setCustomOptions(loadedOptions);
      setForecastPlans(Array.isArray(settingsRow?.forecast_plans)?settingsRow.forecast_plans:[]);
      setOpeningBalances(settingsRow?.opening_balances || {});
      setSavingsGoals(validateSavingsGoals(settingsRow?.savings_goals || []));
      setSavedFilters(validateSavedFilters(settingsRow?.saved_filters || []));
      const version=settingsRow?Number(settingsRow.version||1):null;
      settingsVersionRef.current=version;setSettingsVersion(version);
      setSyncStatus("Cloud synced — all records loaded");
      setSyncProgress("");setInitialDataReady(true);setDataLoading(false);
    }catch(error){
      if(!isCurrent())return;
      // A failed background refresh means the cached figures may be stale.
      // Hide the dashboard rather than presenting previous totals as verified.
      setInitialDataReady(false);
      setSyncStatus("Cloud sync failed: "+(error.message||"unknown error")+". Totals hidden until cloud data is verified.");
      setSyncProgress("");setDataLoading(false);
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
          localizedFinanceAlert("Settings were changed on another device. Your change was not saved. Latest settings have been loaded.");
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

  async function saveOpeningBalances(next) {
    const ok = await queueSettingsField("opening_balances", next);
    if (ok && liveUserIdRef.current === user?.id) setOpeningBalances(next);
    return ok;
  }

  async function saveSavingsGoals(next, expectedSnapshot) {
    if (JSON.stringify(savingsGoals) !== expectedSnapshot) return false;
    const verified = validateSavingsGoals(next);
    const accountId = user?.id;
    const ok = await queueSettingsField("savings_goals", verified);
    if (ok && liveUserIdRef.current === accountId) setSavingsGoals(verified);
    return ok;
  }

  async function saveSavedFilters(next, expectedSnapshot) {
    if (JSON.stringify(savedFilters) !== expectedSnapshot) return false;
    const verified = validateSavedFilters(next);
    const accountId = user?.id;
    const ok = await queueSettingsField("saved_filters", verified);
    if (ok && liveUserIdRef.current === accountId) setSavedFilters(verified);
    return ok;
  }

  function saveBudgets(nextBudgets) {
    queueSettingsField("category_budgets", nextBudgets);
  }

  async function saveCustomOptions(nextOptions) {
    const accountId = user?.id;
    const ok = await queueSettingsField("custom_options", nextOptions);
    if (liveUserIdRef.current !== accountId) return false;
    if (ok) {
      confirmedCustomOptionsRef.current = nextOptions;
      return true;
    }
    setCustomOptions(current => current === nextOptions ? confirmedCustomOptionsRef.current : current);
    localizedFinanceAlert("Custom categories/methods were not saved. Please retry after synchronization.");
    return false;
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
        localizedFinanceAlert("This month budget was changed on another device. Reopen this month after refreshing.");
        await loadCloudData({background:true});
        return false;
      }
      setMonthRows(current => [data, ...current.filter(row=>row.month!==month)]);
      setSyncStatus("Saved monthly budget " + month);
      return true;
    } catch(e) {
      setSyncStatus("Budget not saved: " + e.message);
      localizedFinanceAlert("Budget not saved. It may have been changed on another device: " + e.message);
      await loadCloudData({background:true});
      return false;
    }
  }

  async function saveTemplateBudget(nextBudgets) {
    const clean = normalizeBudgetsInput(nextBudgets);
    const ok = await queueSettingsField("category_budgets",clean);
    if(ok) {budgetsRef.current = clean;setBudgets(clean);}
    else localizedFinanceAlert("Default budget template was not saved. Please refresh and try again.");
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
      else localizedFinanceAlert("Expected income was not saved. Refresh and try again.");
      return ok;
    } catch(e) {localizedFinanceAlert(e.message);return false;}
  }

  function addCustomOption(kind, type) {
  const isCategory = kind === "category";
  const label = isCategory ? "category" : "method";
  const input = window.prompt(`Enter new ${type} ${label}:`);
  const newValue = String(input || "").trim();

  if (!newValue) return null;

  if ([ADD_CATEGORY_VALUE, ADD_METHOD_VALUE, DELETE_CATEGORY_VALUE, DELETE_METHOD_VALUE].includes(newValue)) {
    localizedFinanceAlert("This name is not allowed.");
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
                const confirmed = localizedFinanceConfirm(`Delete "${item}" from custom ${label} list? Existing records will not be deleted.`);
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
  const advancedResults = useMemo(() => {
    if (!advancedFilter) return {rows:null,error:""};
    try { return {rows:filterFinanceRecordsAdvanced(records.map(row=>({...row,method:recordMethod(row)})),advancedFilter),error:""}; }
    catch (error) { return {rows:[],error:error.message}; }
  },[records,advancedFilter]);
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

const methodBalances = useMemo(() => calculateMethodBalances(
  records.map(row => ({...row, method: recordMethod(row)})),
  transfers, accountMethodOptions, openingBalances, normalizeMethodForBalance
), [accountMethodOptions, openingBalances, records, transfers]);
  const openingBalanceTotal = useMemo(() => openingTotal(openingBalances), [openingBalances]);
  const totalBalance = openingBalanceTotal + income - expense;
  // Savings Goals reserve the current natural month's budget, not the Dashboard filter.
  // Saved month snapshot wins; only months without one use the default template.
  const savingsBudgetMonth = localMonthMY();
  const savingsBudgetCategories = monthRows.find(row => row.month === savingsBudgetMonth)?.category_budgets ?? budgets;
  const savingsCalculation = useMemo(() => {
    try { return { data: calculateSavingsAvailable(totalBalance, savingsBudgetCategories) }; }
    catch (error) { return { error: error.message || "Savings calculation unavailable." }; }
  }, [totalBalance, savingsBudgetCategories]);
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
  if (!user) return localizedFinanceAlert("Please sign in first.");
  if (recordCreationPendingRef.current) return;
  recordCreationPendingRef.current = true;
  try {
    let amount;
    try { amount = parseEditedAmount(form.amount); }
    catch(error) { localizedFinanceAlert(error.message); return; }
    const payload = toRecordPayload(
      { ...form, amount, note: form.note.trim() },
      user.id
    );
    const requestId = await getRecordRequestId(user.id, payload, sessionStorage, crypto);
    const columns = "id,type,amount,category,method,note,date,created_at,updated_at,version,deleted_at";
    let { data, error } = await supabase
      .from("records")
      .insert({ ...payload, client_request_id: requestId })
      .select(columns)
      .single();
    if (error?.code === "23505") {
      // The first attempt may have committed before the HTTP response was lost.
      // Recover that SAME row by its stable request ID, never insert another.
      const resolved = await supabase.from("records").select(columns)
        .eq("user_id", user.id).eq("client_request_id", requestId).maybeSingle();
      if (resolved.error) throw resolved.error;
      if (resolved.data) { data = resolved.data; error = null; }
    }
    if (error) throw error;
    if (!data) throw new Error("The database did not acknowledge this record.");
    if (data.deleted_at) throw new Error("A prior matching transaction is in the Recycle Bin. Review before retrying.");
    if (liveUserIdRef.current !== user.id) return;
    confirmRecordRequest(user.id, requestId, sessionStorage);
    const insertedRecord = normalizeRecord(data);
    setRecords((p) => p.some(row => row.id === insertedRecord.id) ? p : [insertedRecord, ...p]);
    setForm((p) => ({ ...p, amount: amountEntryMode === "rm" ? "" : "0.00", note: "", date: today() }));
    setSyncStatus("Record added to cloud");
    if (insertedRecord.type === "expense") {
      playCoinRainSound();
      setCoinRainTrigger(Date.now());
    } else if (insertedRecord.type === "income") {
      playIncomeCoinSound();
      setIncomeCoinTrigger(Date.now());
    }
  } catch (error) {
    // A network timeout may happen after a server-side insert. Do not claim
    // either success or failure, and never clear the form on an unknown result.
    if (liveUserIdRef.current === user.id) {
      setSyncStatus("Record save not confirmed — refresh cloud records before retrying.");
      localizedFinanceAlert("Record save was not confirmed. Check the refreshed transaction list before trying again. " + (error?.message || ""));
    }
  } finally {
    recordCreationPendingRef.current = false;
  }
}
  async function addTransfer(event) {
    event.preventDefault();
    if (!user) {localizedFinanceAlert("Please sign in first.");return;}
    if (transferCreationPendingRef.current) return;
    const amount = parseMoneyInput(transferForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount*100))) {
      localizedFinanceAlert("Please enter a valid positive transfer amount."); return;
    }
    if (transferForm.fromMethod === transferForm.toMethod) {
      localizedFinanceAlert("From Method and To Method cannot be the same."); return;
    }
    try {requireCalendarDate(transferForm.date);} catch(e){localizedFinanceAlert(e.message);return;}

    transferCreationPendingRef.current = true;
    try {
      const payload = {
        user_id:user.id,from_method:transferForm.fromMethod,to_method:transferForm.toMethod,
        amount,note:String(transferForm.note||"").trim(),date:transferForm.date,
      };
      const requestId=await getTransferRequestId(user.id,payload,sessionStorage,crypto);
      const columns="id,from_method,to_method,amount,note,date,created_at,updated_at,version,deleted_at";
      let {data,error}=await supabase.from("transfers")
        .insert({...payload,client_request_id:requestId})
        .select(columns)
        .single();
      if(error?.code==="23505") {
        const found=await supabase.from("transfers").select(columns)
          .eq("user_id",user.id).eq("client_request_id",requestId).maybeSingle();
        if(found.error) throw found.error;
        if(found.data){data=found.data;error=null;}
      }
      if(error) throw error;
      if(!data) throw new Error("Transfer save was not acknowledged by the cloud.");
      if(data.deleted_at) throw new Error("Previous transfer is in the Recycle Bin; verify before retrying.");
      if(liveUserIdRef.current !== user.id) return;
      confirmTransferRequest(user.id,requestId,sessionStorage);
      const added=normalizeTransfer(data);
      setTransfers(rows => rows.some(row=>row.id===added.id)?rows:[added,...rows]);
      setTransferForm(previous => ({
        ...previous,amount:"0.00",note:"",date:today(),
      }));
      setSyncStatus("Transfer added to cloud");
    }catch(error){
      setSyncStatus("Transfer save not confirmed — verify Transfer History before retrying.");
      localizedFinanceAlert("Transfer save not confirmed. Check Transfer History before retrying. "+(error?.message||""));
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
    } catch(e) {localizedFinanceAlert(e.message);return false;}
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
        localizedFinanceAlert("The transfer changed on another device. Your edit was not saved.");
        return false;
      }
      const edited=normalizeTransfer(data);
      setTransfers(rows=>rows.map(r=>r.id===transferId?edited:r));
      setSyncStatus("Transfer updated");
      return true;
    }catch(e){setSyncStatus("Transfer update failed: "+e.message);localizedFinanceAlert(e.message);return false;}
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
      if(!data){await loadCloudData({background:true});localizedFinanceAlert("Transfer changed on another device; nothing deleted.");return false;}
      const deleted=normalizeTransfer(data);
      setTransfers(rows=>rows.filter(r=>r.id!==transferId));
      setDeletedTransfers(rows=>[deleted,...rows.filter(r=>r.id!==transferId)]);
      setUndoTransfer(deleted);
      clearTimeout(undoTransferTimeoutRef.current);
      undoTransferTimeoutRef.current=setTimeout(()=>setUndoTransfer(null),10000);
      setSyncStatus("Transfer moved to Recycle Bin");
      return true;
    }catch(e){setSyncStatus("Transfer delete failed: "+e.message);localizedFinanceAlert(e.message);return false;}
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
      if(!data){await loadCloudData({background:true});localizedFinanceAlert("Transfer changed on another device; please refresh.");return false;}
      const restored=normalizeTransfer(data);
      setDeletedTransfers(rows=>rows.filter(r=>r.id!==transferId));
      setTransfers(rows=>[restored,...rows]);
      if(undoTransfer?.id===transferId)setUndoTransfer(null);
      setSyncStatus("Transfer restored");
      return true;
    }catch(e){setSyncStatus("Transfer restore failed: "+e.message);localizedFinanceAlert(e.message);return false;}
    finally{pendingTransfersRef.current.delete(transferId);}
  }

  function fillCalculation() {
    try {
      const total = calculate(calculationText);
      setCalculationResult(total);
      setForm((p) => ({ ...p, amount: total.toFixed(2) }));
    } catch { localizedFinanceAlert("Invalid calculation. Example: 3.50 + 12.90 + 2*5.40"); }
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
      localizedFinanceAlert(error.message);
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
        localizedFinanceAlert("This record was changed on another device. Your edit was not saved; latest cloud data has been loaded.");
        return;
      }
      const result = normalizeRecord(data);
      setRecords((previous) => previous.map((row) => row.id === recordId ? result : row));
      setSyncStatus("Record synced");
    } catch (error) {
      setSyncStatus("Record edit not saved: " + error.message);
      localizedFinanceAlert(error.message);
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
        localizedFinanceAlert("Delete cancelled: the record changed on another device.");
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
      localizedFinanceAlert(error.message);
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
        localizedFinanceAlert("Restore could not be completed: this record changed on another device. Latest data loaded.");
        return;
      }
      const restored = normalizeRecord(data);
      setDeletedRecords((previous) => previous.filter((row) => row.id !== recordId));
      setRecords((previous) => [restored, ...previous]);
      if (undoDeleted?.id === recordId) setUndoDeleted(null);
      setSyncStatus("Record restored from Recycle Bin");
    } catch (error) {
      setSyncStatus("Restore failed: " + error.message);
      localizedFinanceAlert(error.message);
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
const balanceAlertLimitLabel = "RM" + Number(balanceLimit || 1500).toLocaleString("en-MY", { maximumFractionDigits: 2 });
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
  <div onClickCapture={(e) => e.target.closest("button,select") && playSound()} className="mh-ui min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8">
<CoinRainEffect trigger={coinRainTrigger} />
<IncomeCoinSpinEffect trigger={incomeCoinTrigger} />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-medium text-slate-300">Personal Finance Dashboard</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">记账可视化软件</h1><p className="mt-2 text-sm text-slate-300">记录收入与支出，自动生成统计、分类比例、每日趋势和预算使用情况。</p></div>
          <div className="flex flex-wrap gap-3"><button onClick={() => setSoundEnabled((v) => !v)} className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600">{soundEnabled ? "🔊" : "🔇"} Sound</button><FinanceLanguageButton /><button type="button" disabled={!initialDataReady || dataLoading} onClick={() => { setExportOpen((v) => !v); setImportOpen(false); }} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50">⬇ Export Excel</button><button type="button" disabled={!initialDataReady || dataLoading} onClick={() => { setImportOpen((v) => !v); setExportOpen(false); }} className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white ring-1 ring-slate-600 disabled:opacity-50">⬆ Import CSV</button><button onClick={signOut} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900">Sign out</button></div>
        </header>
        <React.Suspense fallback={<div role="status" className="rounded-2xl bg-white p-4 text-sm text-slate-600">Loading...</div>}>
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
          forecastPlans={forecastPlans} openingBalances={openingBalances} dataReady={initialDataReady}
          dataLoading={dataLoading} onClose={() => setExportOpen(false)}
        />}
        </React.Suspense>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          Signed in as <b data-i18n-ignore>{user?.email}</b> · {dataLoading ? "Syncing..." : syncStatus || "Cloud ready"}
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
  value={totalBalance}
  desc="Including Opening Balance"
  limit={balanceLimit}
  methodBalances={methodBalances}
  openingBalanceControl={<FinanceOpeningBalancePanel
    methods={methodBalances.map(row=>row.method)} balances={openingBalances}
    disabled={!initialDataReady || dataLoading} onSave={saveOpeningBalances} />}
/></section>

<section className="grid gap-6 lg:grid-cols-[380px_1fr]">
  <div className="space-y-6">
<Card className={`overflow-hidden ${addRecordTheme.card}`}>
  <div className={`-mx-5 -mt-5 mb-5 bg-gradient-to-r ${addRecordTheme.header} px-5 py-4 text-white`}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-bold">{addRecordTheme.title}</h2>
        <p className="mt-1 text-sm text-white/80">{addRecordTheme.subtitle}</p>
        <button type="button" ref={recordsTriggerRef} onClick={() => setRecordsOpen(true)}
          aria-haspopup="dialog" aria-expanded={recordsOpen}
          className="mh-modal-trigger mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span aria-hidden="true">📋</span><span>Transaction Records</span>
        </button>
      </div>
      <div className="shrink-0 rounded-2xl bg-white/20 px-3 py-2 text-2xl">{addRecordTheme.icon}</div>
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
  <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-600">
    <span>Amount (RM)</span>
    <span className="inline-flex rounded-lg bg-slate-100 p-1 text-xs" role="group" aria-label="Amount input mode">
      <button type="button" aria-pressed={amountEntryMode === "rm"}
        onClick={() => {
          if (amountEntryMode !== "rm") setForm(previous => ({ ...previous, amount: "" }));
          setAmountEntryMode("rm");
        }}
        className={`rounded-md px-2 py-1 font-semibold ${amountEntryMode === "rm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
        RM typing
      </button>
      <button type="button" aria-pressed={amountEntryMode === "cents"}
        onClick={() => {
          setAmountEntryMode("cents");
          setForm(previous => ({
            ...previous,
            amount: Number.isFinite(Number(previous.amount)) ? Number(previous.amount).toFixed(2) : previous.amount,
          }));
        }}
        className={`rounded-md px-2 py-1 font-semibold ${amountEntryMode === "cents" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
        Cents keypad
      </button>
    </span>
  </span>
  <input
    value={form.amount}
    onChange={(event) =>
      setForm((previous) => ({
        ...previous,
        amount: amountEntryMode === "cents" ? formatMoneyTyping(event.target.value) : event.target.value,
      }))
    }
    type="text"
    inputMode={amountEntryMode === "cents" ? "numeric" : "decimal"}
    onFocus={event => { if (amountEntryMode === "rm" && event.target.value) event.target.select(); }}
    title={amountEntryMode === "cents" ? "2455 means RM24.55" : "100 means RM100.00"}
    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
  />
  <span className="mt-1 block text-xs text-slate-500">
    {amountEntryMode === "cents" ? "Cents keypad: 2455 → RM24.55" : "Normal RM: 100 → RM100.00 · 24.55 → RM24.55"}
  </span>
</label>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-sm font-bold text-slate-700">小计算器</p><textarea
  value={calculationText}
  onChange={(event) => setCalculationText(formatCalculatorTyping(event.target.value))}
  rows={3}
  placeholder="3.50 + 12.90 + 2*5.40"
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
<FinanceQuickNotes records={records} type={form.type} category={form.category}
  onChoose={note=>setForm(previous=>({...previous,note}))} />
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
              <StatCard title="Filtered Expense" value={money(filteredExpense)} icon="📉" desc={"Current filter: " + filterLabel}
                action={<button type="button" ref={budgetTriggerRef} aria-label="Open Monthly Budget" aria-haspopup="dialog"
                  aria-expanded={budgetOpen} title="Monthly Budget / 分类预算"
                  onClick={() => setBudgetOpen(true)}
                  className="mh-modal-trigger flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                    📊
                </button>}
              />
              <BalanceCard title="Filtered Balance" value={filteredIncome - filteredExpense} desc={"Period net change (Opening Balance excluded): " + filterLabel} limit={balanceLimit} />
            </section>
            <FinanceOverlay open={budgetOpen} title="Monthly Budget / 分类预算"
              onClose={() => {
                if (budgetDraftDirty && !localizedFinanceConfirm("Discard unsaved budget changes?")) return;
                setBudgetDraftDirty(false);
                setBudgetOpen(false);
              }}
              widthClass="max-w-3xl" triggerRef={budgetTriggerRef}>
              <FinanceBudgetPanel
                embedded
                records={records}
                budgetMonth={budgetMonth}
                setBudgetMonth={setBudgetMonth}
                monthRows={monthRows}
                budgetTemplate={budgets}
                categories={expenseCategoryOptions}
                onSaveMonthly={saveMonthlyBudget}
                onSaveTemplate={saveTemplateBudget}
                onDirtyChange={setBudgetDraftDirty}
              />
            </FinanceOverlay>
            <section className="grid items-start gap-4">
              <FinanceForecastPanel
                records={records}
                selectedMonth={forecastMonth}
                asOfDate={localToday}
                plannedIncomes={forecastPlans}
                openingBalanceTotal={openingBalanceTotal}
                onSavePlans={saveExpectedIncomePlans}
              />
              <HeatmapCard days={heatmapDays} label={filterLabel} />
              <div className="min-w-0">
                <TopExpensesCard
                  records={topExpenses} label={filterLabel}
                  category={topExpenseCategory} setCategory={setTopExpenseCategory}
                  expenseCategoryOptions={expenseCategoryOptions}
                />
              </div>
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Card><h2 className="text-xl font-bold">Daily Income vs Expense</h2><p className="mt-1 text-sm text-slate-500">Current range: {filterLabel}</p><div className="mt-4 h-64">{dailyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Legend /><Bar isAnimationActive={false} dataKey="income" name="Income" fill="#22c55e" /><Bar isAnimationActive={false} dataKey="expense" name="Expense" fill="#ef4444" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No data.</div>}</div><div className="mt-5 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="mb-2 flex justify-between gap-2"><p className="text-sm font-bold text-slate-700">消费趋势图</p><select
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
</select></div><div className="mh-modal-trigger h-36 cursor-zoom-in rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
  ref={spendingTrendTriggerRef} role="button" tabIndex={0} aria-label="Expand Spending Trend" title="Click to expand Spending Trend"
  onClick={() => setExpandedTrend("expense")}
  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedTrend("expense"); } }}>
  {trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip content={<FinanceTrendSummaryTooltip kind="expense" />} /><Legend /><Line isAnimationActive={false} type="monotone" dataKey="expense" name="Expense" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No expense trend data.</div>}</div><div className="mt-4 border-t border-slate-200 pt-3"><p className="mb-2 text-sm font-bold text-slate-700">Filtered Balance Trend</p><div className="mh-modal-trigger h-36 cursor-zoom-in rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
  ref={balanceTrendTriggerRef} role="button" tabIndex={0} aria-label="Expand Filtered Balance Trend" title="Click to expand Balance Trend"
  onClick={() => setExpandedTrend("balance")}
  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedTrend("balance"); } }}>
  {trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip content={<FinanceTrendSummaryTooltip kind="balance" />} /><Legend /><Line isAnimationActive={false} connectNulls type="monotone" dataKey="balanceGreen" name={`Balance > ${balanceAlertLimitLabel}`} stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} /><Line isAnimationActive={false} connectNulls type="monotone" dataKey="balanceRed" name={`Balance ≤ ${balanceAlertLimitLabel}`} stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">No balance trend data.</div>}</div></div></div></Card>
              <Card>
                <h2 className="text-xl font-bold">Expense by Category</h2>
                <div className="mt-4 min-w-0">
                  <FinanceCategoryBubbleChart data={categoryData} emptyText="No expense data." />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="mb-2 flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">Method Ratio</p>
                    <p className="text-xs text-slate-500">所有支出方式比例</p>
                  </div>
                  <div className="mt-3 min-w-0">
                    <FinanceMethodDonutChart data={methodData} emptyText="No method data." />
                  </div>
                </div>
              </Card>
            </section>
            <FinanceExpandedTrendOverlay
              open={expandedTrend !== null}
              triggerRef={expandedTrend === "balance" ? balanceTrendTriggerRef : spendingTrendTriggerRef}
              kind={expandedTrend || "expense"}
              onKindChange={setExpandedTrend}
              onClose={() => setExpandedTrend(null)}
              data={trendData}
              dailyData={dailyData}
              records={filteredRecords}
              category={trendCategory}
              alertLimit={balanceLimit}
              filterLabel={filterLabel}
            />
          </div>
        </section>

       <FinanceOverlay open={recordsOpen} title="Transaction Records"
         onClose={() => { setRecordsOpen(false); setDeleteConfirm(null); }} widthClass="max-w-6xl" showTitle={false} triggerRef={recordsTriggerRef}>
       <Card>
  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
    <div>
      <h2 className="text-xl font-bold">Transaction Records</h2>
      <p className="mt-1 text-sm text-slate-500">
        {advancedFilter
          ? "Showing "+(advancedResults.rows?.length||0)+" advanced-search records · global sort"
          : "Showing "+filteredRecords.length+" records for "+filterLabel+" · Click a date to expand records"}
      </p>
    </div>

  </div>

  <FinanceAdvancedFilters
    active={advancedFilter} onApply={setAdvancedFilter}
    savedFilters={savedFilters} onSave={saveSavedFilters}
    categoryOptions={[...new Set([...expenseCategoryOptions,...incomeCategoryOptions])]}
    methodOptions={accountMethodOptions}
    disabled={!initialDataReady||dataLoading}
  />
  {advancedFilter && (advancedResults.error
    ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{advancedResults.error}</p>
    : <FinanceAdvancedResults rows={advancedResults.rows} EditableCell={EditableCell}
        onUpdate={updateRecord} onDelete={deleteRecord}
        categoryOptionsFor={categoryOptionsFor} methodOptionsFor={methodOptionsFor}/>)}
  {!advancedFilter && <div className="mt-5 space-y-3">
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

            <div className="mh-day-totals grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 md:min-w-[360px]">
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
            <div className="hidden overflow-x-auto px-4 pb-4 md:block">
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
          {isOpen && (
            <div className="px-3 pb-4 md:hidden">
              <FinanceMobileRecords
                records={group.records}
                categoryOptionsFor={categoryOptionsFor}
                methodOptionsFor={methodOptionsFor}
                onUpdate={updateRecord}
                onDelete={deleteRecord}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>}

  {!advancedFilter && filteredRecords.length > 0 && (
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
                    <p className="text-xs text-slate-500">{record.date} · {record.type} · {recordMethod(record)} · {record.note ? <span data-i18n-ignore>{record.note}</span> : "No note"}</p>
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
       </FinanceOverlay>

        <FinanceInsightsDock
          records={records} monthRows={monthRows} budgetTemplate={budgets}
          totalBalance={totalBalance} userId={user?.id}
          disabled={!initialDataReady||dataLoading}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <FinanceMonthComparison records={records} />
          <FinanceSavingsGoals goals={savingsGoals} onSave={saveSavingsGoals}
            disabled={!initialDataReady || dataLoading}
            savingsAvailability={savingsCalculation.data}
            calculationError={savingsCalculation.error}
            budgetMonth={savingsBudgetMonth} />
        </div>

        <footer className="pb-6 text-center text-xs text-slate-400">记账可视化软件 · Data synced with Supabase cloud · {records.length} total records</footer>
      </div>
    </div>
  );
}


export default function FinanceVisualizerApp() {
  return <FinanceLanguageProvider><FinanceVisualizerAppContent /></FinanceLanguageProvider>;
}
