# PR #72 — Stage 4 (P3) — Time-Accurate Charts, Account Alerts, Complete Heatmap
Date: 2026-11-23 · timezone Asia/Kuala_Lumpur

## Baseline and authorization
- Exact baseline: previous **PR #71 head** `7ac60e296f5892425affb07f5fcb3f8853cab09c` (parent branch `fix/pr70-p2-business-edge-cases-2026-11-23`).
- Isolated TEST-only branch `fix/pr71-p3-chart-heatmap-account-ui-2026-11-23`. Draft PR; no main merge, Production deployment, Supabase schema migration, Auth/RLS or data modification.
- Exactly four previously audited P3 issues addressed: #10 true calendar time spacing, #11 0-RM bars, #14 per-user alert threshold, #17 Year/All Heatmap completeness.
- Existing P0, P1 and P2 code is retained.

## #10 — Real calendar time on financial trend lines
- `src/financeChartPlot.js` introduces `chartDayFractions`: strict YYYY-MM-DD + calendar-valid UTC epoch days, **monotonically increasing**. X coordinates now proportional to actual elapsed calendar days, NOT just evenly spaced observed record indices.
- Mixed/invalid/repeated/unsorted date rows safely fall back to prior index positions, not silently reorder any source data or dates. The chart remains a **read-only** projection.
- `chartTimeTickIndices` places mobile and desktop date labels by available pixel width, preserves first+last date, prevents overlapping text on narrow Android displays.
- `FinanceNativeChart.jsx` uses the same time-coordinate mapping for visible lines, threshold crossings, dates and **interactive hit zone midpoints**. The selected row remains the actual original row; null actual future balances still have gaps, forecasts remain separate dotted lines.
- `FinanceNativeMultiSeriesChart.jsx` retains its existing categorical/monthly chart layout; no change to financial formulas.

## #11 — Zero-value bar appearance
- Pure `chartHasVisibleBar` validates whether a value is finite and not zero. Both `FinanceNativeChart.jsx` (daily Income/Expense) and `FinanceNativeMultiSeriesChart.jsx` (Income/Expense/Net in comparisons) do **not** emit a bar for RM0.
- Nonzero positive and negative values remain visible, tooltips and accessibility hit zones remain available, no balance/expense calculations touched.
- Existing min-height for nonzero tiny bars is retained to keep genuine small expenses visible.

## #14 — Per-account local Balance Alert Limit
- NEW `src/financeBalanceAlertPreference.js`: stores a valid nonnegative RM alert amount under a key that includes the signed-in Supabase user ID. User A/B thresholds cannot mix.
- `src/App.jsx` always shows the current account's value or default RM1500 while the account is changing, and saves only if the state owner matches the live signed-in account. Failed/invalid/blank inputs do NOT overwrite the last good setting; RM0 is valid.
- **Legacy shared** `finance-balance-limit-v3` is **not read, migrated, deleted, overwritten or assigned** to a user; ownership of that shared browser preference cannot be proved. User may need to re-enter their own preferred threshold once per account in the Test Preview. Existing global key remains recoverable unchanged.
- This is a local browser UI preference only, **not a new cloud setting**. It is intentionally not synchronized across phone/computer; adding account-scoped cloud synchronization would require separately approved scope/data review. Other preferences, budgets, Account Settings and cloud sync untouched.

## #17 — Full Year / All Spending Heatmap
- Existing `src/App.jsx` removed the arbitrary `.slice(-35)` of dated records. **No dates or source rows are deleted or modified.**
- NEW `src/financeHeatmapScope.js` calculates Year bounds covering all twelve calendar months, and All bounds covering the exact earliest-to-latest calendar months represented by selected records (including months with no activity).
- HeatmapCard renders **one 28–31-day calendar page at a time**, with previous/next month buttons and a bounded native month picker, showing page number and complete year/all range. This preserves phone responsiveness and avoids huge permanent cards for several years' history.
- Within the visible month, **every calendar date is clickable**, including zero-spending dates with income only. Clicking still opens the existing floating `FinanceHeatmapDayDetails` showing actual Income/Expense detail for the date.
- Existing normal month and recent 3/7/30-day views continue using their original date generation and layout. Owner or filter switch closes any old selected-day popup.
- Heat intensities normalize within the visible month to keep small months readable; payment totals and account arithmetic unchanged.

## Files (P3 ONLY)
- Modified `src/App.jsx`, `src/FinanceNativeChart.jsx`, `src/FinanceNativeMultiSeriesChart.jsx`, `src/financeChartPlot.js`.
- New pure helper modules `src/financeBalanceAlertPreference.js`, `src/financeHeatmapScope.js`.
- New `tests/finance-p3-ui-account-heatmap-2026-11-23.test.mjs` (10 targeted tests).
- Four existing UI tests updated **only** to match the new Heatmap pagination/formatting while retaining original visual amount, daily details and Top 5 assertions.
- No finance CRUD, cloud-loading, RLS, import/export, budgets, forecasting mathematics, pricing APIs or database migrations touched.

## Automated test coverage
- True 1-day vs 10-day distance ratio; duplicate/invalid date fallback; mobile non-overlapping tick labels; threshold crossing with null future actual.
- Positive/negative vs zero/missing bar behavior, including both drawing components.
- Account A/B alert independence, RMB0 valid, invalid form value fail-closed, legacy preference untouched and no database writes.
- Full 12-month year including Leap Day February 29; All range over 8+ years without dropping first months; every visible zero-spending day rendered; previous/next bounds and default month; original records immutable.
- Existing 367 historical tests retain P0/P1/P2/regression coverage. Full Vite Build and both npm audits must be verified against the **exact final Commit SHA** before reporting success.

## Manual acceptance still required
1. Android and Windows Test Preview, with virtual data, date gaps of 1/10 days: visually inspect real-proportion line, no overlap/cut-off, click/tap correct date and expanded overlay. Zoom / screen width 320–1440px.
2. Zero-income and zero-expense days: no fake small colored bar, axis/date tooltip still available. Negative net monthly bar still visible.
3. Switch between two separate Test Supabase accounts on same browser: distinct thresholds; test RM0, defaults, reload, signout while input in progress; ensure old global legacy key is unchanged; on another device the local preference is separate by design.
4. Year full Jan–Dec with no-transaction months, leap year February, All earliest-to-latest years, zero-only calendar dates with income, monthly navigation and daily details popup, mobile scroll stable.
5. Regress Income, Expense, Transfer, Claim, budgets, Expected Income, foreign currency editing, CSV import, Excel export, reconciliation, Undo/Recycle Bin and cloud synchronization.
6. No user-visible Work/Browser full E2E or physical Android test has been executed by GitHub CI, and CI success is NOT a promise of zero bugs.

## Strict safety / rollback
- No writes to Supabase (Test or Production), no users' actual financial records read, no historical RM or category keys changed, no migrations and no external paid APIs.
- GitHub main and Vercel Production stay at the prior production commit; only a TEST Preview is permitted. Original PR71 SHA remains rollback baseline.
- Production release remains blocked pending separate user authorization, encrypted verified full-production backup with restore test, reviewed migrations if any, and real Windows/Android end-to-end acceptance.
