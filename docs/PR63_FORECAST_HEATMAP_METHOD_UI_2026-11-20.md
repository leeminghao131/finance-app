# 2026-11-20 · PR #64 · Forecast, Heatmap day drill-down and Method Ratio accessibility

## Origin and baseline
User screenshots from PR #63 Preview show Cash Flow Forecast graph area blank despite populated forecast summary (including current ledger, expected future income, projected expense, forecast balance). Method Ratio's right-hand payment method detail cards render as translucent pale grey with low-contrast text. User requests click-any-day on Spending Heatmap to open a floating window listing that day's Income and Expense details.

Base: PR #63 exact commit `4cc2485a089cf9f7edb351e3a8493e5e130bcc7a`. Child branch only; no modification to `main` or Production.

## Exact changes
1. Forecast display only: `FinanceForecastPanel.jsx` switches remaining Recharts <ResponsiveContainer>/<LineChart> to existing `FinanceNativeChart` with `kind="forecast"` and **existing** `data.timeline`. In `financeChartPlot.js`, pure drawing field selector adds `["actual","forecast"]`; `FinanceNativeChart.jsx` adds a bright-silver Actual ledger line and dashed azure Forecast line, high-contrast legends and read-only date/RM hover detail. Null future actual is never converted into a fake real balance; actual/forecast values remain from `calculateCashForecast` unchanged. Projected income remains forecast-only.
2. Heatmap read-only drill-down: `HeatmapCard` retains `heatmapDays` (same filter/color amounts) and converts each date cell to a keyboard-accessible button. It mounts a separate `FinanceHeatmapDayDetails.jsx` through existing `FinanceOverlay` (not a persistent dashboard card), with daily Income, Expense, net total, category, original payment method, notes, and recorded transaction amounts. Date detail source is `periodRecords`, covering the full selected time period **without category/text narrowing**. This intentional choice shows **all income and expense** on the selected day even when the heatmap itself is category-filtered; the UI states this explicitly. Transfer entries, expected future income and soft-deleted entries are not counted. `financeHeatmapDetails.css` provides high-contrast metal styling and mobile single-column scroll.
3. Method Ratio styling: `FinanceMethodDonutChart.jsx` adds only a `mh-method-detail` class to existing legend buttons. `financeNativeCharts.css` overrides previously translucent white `bg-white/60` with an opaque navy/steel background, brighter text, clearer cyan amounts, golden borders and accessible focus. Method percentages and actual RM amounts are untouched.

## Safety
No edits to `calculateCashForecast`, `addRecord`, `updateRecord`, `deleteRecord`, `loadCloudData`, `importCsv`, transfers, budgets, SQL, Auth, RLS, Supabase credentials, Environment Variables or any user's saved financial data. CSS and read-only components only, plus pure chart coordinate field mapping.
Preview remains linked to isolated MH Finance Test database, no production secrets or real records.

## Verification and remaining QA
Run locked-install GitHub full safety tests (including synthetic forecast income isolation and native SVG geometry), Vite build and two audits against exact final SHA.
User manual Windows/Android Preview QA is REQUIRED: Forecast 7/30/60 trailing expense, month-end/30 days/90 days, actual and future dashed line; Heatmap dates containing only income, only expense, both, and no records; keyboard Enter/Space, tap, Escape and close/reopen; right method legend normal and highlighted modes, including long custom methods; Chinese/English; smooth scroll. No claims of real-device success without screenshot/test.

Rollback: close this draft PR; keep PR #63 unchanged. Do not merge to main or deploy Production without separate explicit approval, production encrypted backup and restore verification.
