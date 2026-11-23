# PR #70 — Stage 2 / P1 Financial Consistency (2026-11-23, MYT)

## Source and scope
Baseline: **PR #69** head `76470442684b8bbcae5e78e50fda1b58e575217d`, intentionally not `main`.
New branch: `fix/pr69-p1-finance-consistency-2026-11-23`. Development and Vercel **Preview/Test** only, no production database or environment modifications.
Seven P1 items only: #01, #03, #04, #05, #06, #08, #22. No new unrelated features, visual redesign, data migration, live imports, real Income/Expense or historical amount changes.

## Individual changes and safety constraints

### #01 — Assistant Forecast includes Claim
- `financeAssistantRules.js`: passes the **same** verified Claim cash movement array, Malaysia as-of date, selected forecast month and current opening balance into existing `calculateCashForecast` as the Dashboard.
- `App.jsx`: supplies this data read-only in `FinanceRuleAssistant` context.
- Expected Income remains **forecast-only**, never written as real Income, and Claim remains separate from personal Income/Expense.

### #03 — Future trend has no false actual RM0
- `FinanceExpandedTrendOverlay.jsx`: unavailable actual balance remains `null`, uses neutral appearance, explicitly shows unknown/no low-balance alert; for future dates it does not present future-dated saved entries as **actual cash movement**.
- Existing actual historical money and threshold computation untouched.

### #04 — Reconciliation date cutoff
- `App.jsx`: read-back validation uses only remote transaction and transfer rows through the **same `localToday` cutoff** as the pre-submit Dashboard method balance, including same Claim movement cutoff.
- Existing CAS, owner check, verified snapshot, server idempotency and Transfer writes are unchanged.
- Future-dated rows are retained in history; none is deleted or modified.

### #05 — Old overdue bills remain actionable
- `financeStage2.js`: optional sixth argument `includeOldestOverdue=false`; when opted-in, includes the **oldest unresolved prior-due entry for each active bill** outside the historical window, while keeping the existing normal-window rows. Paid-linked, skipped and not-yet-due snoozed entries are not resurrected.
- `FinanceStage2Hub.jsx`, `FinanceRecurringBills.jsx` and Assistant's bill answer opt in. Calendar rendering keeps its original bounded behavior.
- Expanded the pure occurrence search bound from 520 to 10000 to handle weekly plans started more than ten years ago without saving or changing any past transaction. At most one old overdue entry per bill is surfaced at a time, avoiding thousands of notification cards.
- Existing 160 confirmations per bill limit is a **separate P2 item** and was not modified.

### #06 — Malaysia midnight and rolling ranges
- `App.jsx`: Today, recent 3/7/30-day dates, Dashboard summaries, Heatmap, trend data use the existing `localToday` state and memo dependencies. It already updates on a 30-second timer and focus/visibility changes.
- History, saved dates, calendar source and budget month logic remain unchanged.

### #08 — Excel current ledger vs selected-month movement
- `financeExcel.js`: preserves all source rows (including explicit future-dated entries) in Excel.
- Adds an accurately named global **as-of export date ledger balance**, computed from opening balances + all dated actual Income/Expense + separate Claim cash events up to export date, excluding future-dated rows.
- Adds **selected-scope net cash movement through export date**, excludes Opening Balance, plus future-dated row count and Malaysia cutoff date. Distinguishes this from total exported Income/Expense, which includes all explicitly selected rows.
- Workbook sheets, cash precision checks, original FX, transfers and budget/expected income intact. Not a Supabase recovery backup; never mutates DB.

### #22 — Cross-table snapshot drift protection (read-only)
- NEW `financeSnapshotConsistency.js` performs a **second revision-only read** (`id,version`) of all six finance data tables, each still using existing complete, owner-scoped, paginated two-pass fetching; re-reads Settings and monthly budgets.
- `financeCloudService.js` verifies revision signature equality and exact settings/budget snapshot equality **before** returning rows to UI; if changed, retries a complete snapshot once; on continuing drift, throws and existing UI hides totals.
- No stored procedures, SQL migrations, Auth/RLS changes, mutation calls or changes to `loadEveryOwnedRow`.
- This is **not** a PostgreSQL transaction-level atomic snapshot: a true atomic read over all tables would require reviewed backend changes and separate approval. The extra read-only validation increases network requests and can increase sync latency with very large histories. Stability has priority over falsely reporting totals.
- Existing P0 multi-device/version checks from PR69 remain in place.

## Tests
- Existing tests updated only where they previously asserted obsolete literal labels / call syntax. No protections removed.
- NEW `tests/finance-p1-financial-regression-2026-11-23.test.mjs`: claim-inclusive prediction vs actual forecast, missing future balance, cutoff parity, overdue >70 days and weekly >10 years, MY midnight, Excel exact sen totals and future-dated source retention.
- NEW `tests/finance-p1-cloud-consistency-2026-11-23.test.mjs`: six-table revision signature changes, Settings/monthly budgets mutation, full read/retry/fail-closed mock.
- Full GitHub Actions / Vite / dependency audits must be confirmed on the **exact final commit SHA** before declaring automated pass. UI browser checks are not substituted by source tests.

## Mandatory manual acceptance (still pending until actually performed)
1. Test accounts only: use synthetic RM values; compare Assistant vs Cash Flow Forecast for month end including advances and reimbursements, while Income/Expense remain unchanged.
2. Future-dated saved Income + Expense: chart no actual RM0 and no low-balance alert.
3. Source/target method balances with future transfers: simulated reconciliation correctly matches current-day balances; no inadvertent Transfer writes while checking.
4. A >70-day unresolved bill stays on alert; completed skipped/paid bills stay dismissed; selecting a calendar date shows only that date. Test oldest weekly bill started >10 years ago.
5. After MY midnight, 3/7/30-day filters, today's summary and Heatmap refresh without manual reload; months and budgets unaffected.
6. Excel all/month: source sheet includes future rows but current ledger balance excludes them, Claim cash correct, period net excludes opening, verify workbook and Chinese strings.
7. Two Test devices with simultaneous writes during cloud load: no partial totals displayed, retry bounded, latency acceptable on Android/Windows and a large fictitious dataset.
8. Confirm original CRUD, Transfers, budgets, future expected Income, FX, charts, undo/recycle, CSV Import, Excel Export and language switching still function normally.

## Release, isolation and rollback
- Must remain Draft, no merge to main, no Production deployment or migration.
- Actual Supabase Test database and Vercel Preview **only**; source code now reads more data but never writes historical rows in tests.
- Original PR69 head remains rollback baseline. Git rollback does not undo DB changes, which were deliberately not performed here.
- Production release requires independent, encrypted, restorable backup and verified restoration, mobile+PC acceptance, and user's separate explicit authorization.
