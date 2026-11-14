# MH Finance App · Performance audit and low-risk optimization

Date: 2026-11-14 (Asia/Kuala_Lumpur)

## Starting point
- Manually accepted testing baseline reported by the owner: `ui/modal-motion-month-compare-savings-2026-11-14`, commit `1a6135be1888f8cdf64820977cd8232198c6696c` (Draft PR #29).
- **Not** Production or `main`. No production release authorization.
- Verified GitHub source, 35 `src/` files, source file sizes, package manifest, CI build output and existing UI/component dependency graph.
- All existing financial calculations and cloud CRUD/sync/auth paths are high-risk; audit did not authorize rewriting or deleting these modules.

## Findings
1. `src/App.jsx` eagerly imported `FinanceExcelExportPanel.jsx`, which imported `financeExcel.js`, which imported the entire `xlsx` library. As a result the Home/Dashboard JavaScript included spreadsheet file-generation code even before the export feature was opened.
2. `FinanceCsvImportPanel.jsx` was also eagerly included before any CSV import was requested.
3. The legacy `MiniPie` in `src/App.jsx` has no call sites: the live category and payment-method charts use `FinanceCategoryBubbleChart` and `FinanceMethodDonutChart`. The old helper, its palette and Recharts imports were dead source.
4. The Dashboard still uses Recharts for active read-only graphs. It is deliberately **not** removed or rewritten, as doing so risks changing verified visualizations.
5. Source file size `src/App.jsx` alone is not proportional to delivered bundle size: Vite strips unused code and reduces imports. Do not pursue broad App.jsx rewrites merely to shorten source.

## Safe changes
- `src/App.jsx`: change only the Excel Export and CSV Import panel module imports into `React.lazy` imports; wrap the unchanged conditional JSX props in `React.Suspense`. This keeps workbook verification and CSV duplicate/retry protection unchanged. Use already-translated `Loading...` fallback.
- `src/App.jsx`: remove the unreferenced `MiniPie` helper, its one-use palette and `PieChart`, `Pie`, `Cell` imports. No live chart props, component implementations, filters, or calculations changed.
- `tests/finance-on-demand-panels.test.mjs`: add structural checks for lazy-loading, Excel safety, import cloud refresh, and unchanged feature presence.
- **No changes** to `addRecord`, `updateRecord`, `deleteRecord`, `importCsv`, `saveBudgets`, `loadCloudData`, services, database files, Supabase client, settings, Amount parsing, RLS, Auth, or Vercel environment variables.
- Work only on `perf/finance-on-demand-panels-2026-11-14`, Draft PR #30 targeting a non-main QA branch.

## Build measurements
GitHub Actions baseline `43571579605` on PR #29:
- One `index` JavaScript chunk: **1,341.98 kB** minified, **407.71 kB gzip**.
- CSS: 28.67 kB minified, 6.55 kB gzip.
- 107 tests passed.

Initial optimized Actions build `43585478365` on performance commit `b0a3b7be677bc81a303dd14941f0f42371c3dce6`:
- Startup `index` JavaScript chunk: **837.68 kB** minified, **243.23 kB gzip**; approximately **40.3% less gzip**.
- On-demand Excel export chunk: **494.36 kB** minified, **161.26 kB gzip**.
- On-demand CSV import chunk: **11.13 kB** minified, **4.33 kB gzip**.
- CSS unchanged.
- 110 tests passed, 0 failed; Vite Build passed; production-dependency audit 0 reported advisories.

**Interpretation:** This is a reduction in the **initial main JavaScript payload**, not the total bytes eventually downloaded by someone who opens Export Excel and Import CSV. Excel functionality still downloads when used. Actual network speed, parsing time, memory and Android usability have not been benchmarked on the user's physical devices.

## Remaining acceptance
- CI/build must be rerun against the final audit/documentation SHA.
- Manual Windows and Android checks against **the new Preview SHA** are still pending; the user's previous manual acceptance applies only to the unchanged PR #29 baseline.
- Open Export Excel, ensure on-demand loading/round-trip workbook checks and download work, close/reopen and switch languages; open Import CSV, verify preview, duplicate handling and idempotent retries using synthetic records; verify no loading stalls offline; check regular Dashboard behavior and all other controls.
- Login, income/expense edits, transfers, budget, forecast, opening balances, savings goals, bilingual text, charts, recycle bin and synchronization should remain unchanged.
- Do not merge to `main` / deploy Production without explicit separate approvals, fully restorable encrypted backup and complete acceptance.

## Rollback
- The source baseline is commit `1a6135be1888f8cdf64820977cd8232198c6696c`. If the new Preview exhibits problems, use the previously READY Preview while keeping Production untouched.
- A Git rollback changes code only; it never restores database state. No SQL writes were performed during this optimization.
