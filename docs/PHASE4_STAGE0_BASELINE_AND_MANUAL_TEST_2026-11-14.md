# MH Finance App — Phase 4 Stage 0: full-test baseline & manual acceptance

Review date: 2026-11-14 (Asia/Kuala_Lumpur). **PREVIEW / TEST ONLY.**
This Stage 0 records a code baseline and test plan. It does **not** authorize any Production deployment or production database migration.

## 0.1 Exact starting point and composition

- Source: `perf/finance-on-demand-panels-2026-11-14` at `d28ce2991ff5d225e7359df33e777d49116401c9`, Draft PR #30.
- Its ancestry includes `ui/modal-motion-month-compare-savings-2026-11-14` at `1a6135be1888f8cdf64820977cd8232198c6696c`, Draft PR #29, and full combined `integration/finance-complete-test-2026-11-12-v2` at `26ce90707bc30f8e140ca43cb0e06880f39c7319` (Draft PR #28).
- PR #30 changes: CSV / Excel panels loaded on demand and unreferenced dead pie code removed; finance handlers are unchanged.
- Locked Stage 0 verification branch: `integration/phase4-stage0-verified-baseline-2026-11-14`.
- The baseline includes existing safe record/transfer CRUD, Recycle Bin, Budget, Forecast, Opening Balance, Quick Notes, Month Comparison, Savings Goals, bilingual UI, charts, modal motion and separate CSV/Excel import/export.
- **Phase 4 feature development has NOT begun:** bills, review inbox, burn-rate predictor, advanced favorites, reconciliation, activity mode, activity Wrapped, what-if simulator, drag-transfer UI, financial bot, city XP.

## 0.2 Non-production safety gate

- Test Supabase project ID: `qrkaxxdwqgffhkalvtby`. Production Supabase project ID: `hlkciowyusbhwcwjzfsr`.
- `src/supabaseClient.js` requires the exact Test URL: `https://qrkaxxdwqgffhkalvtby.supabase.co`; on any other URL the client remains `null` (fail closed).
- Vercel Preview deployments must have `target=null` and must use the reviewed Stage 0 commit SHA, not just a newer-looking URL.
- Live Test metadata: `records`, `transfers`, `user_settings`, `monthly_budgets`, `finance_import_items` exist and RLS is enabled.
- The scoped RLS expressions for SELECT/INSERT/UPDATE use `(select auth.uid()) = user_id`; UPDATE also has WITH CHECK.
- Read-only simulated unrelated authenticated identity has `0` visible Test `user_settings` rows. This is **not** a replacement for two real Test users on different devices.
- Existing Test-only `user_settings` fields: `opening_balances` and `savings_goals`.
- Security advisor still reports `Leaked Password Protection Disabled` (WARN). No changes made. Performance advisor reports an unused import-related index (INFO); do not remove it as part of Stage 0.
- No SQL mutation, Production environment modification, true financial record mutation or production deploy.

## 0.3 Automation baseline

- PR #30 source CI at SHA `d28ce2991ff5d225e7359df33e777d49116401c9`: GitHub Actions `43585853645`, **110/110 tests passed**, Vite build passed, 0 production dependency audit advisories.
- Stage 0 adds `tests/phase4-stage0-baseline.test.mjs` to guard major integrated modules, test-only client URL, RM precision, transfer conservation, monthly budget, quick notes and savings calculations.
- Review the latest GitHub Actions run on the Stage 0 branch for **actual final counts**. Do not reuse the source branch count as the final count.
- Builds/tests use fabricated financial inputs. Passing them does not prove full authenticated Android/Windows end-to-end functionality.

## 0.4 Human acceptance — use independent TEST accounts and fabricated values ONLY

### A. Environment and authentication
1. Open the exact Stage 0 READY Preview URL; confirm `TEST MODE / 测试环境` and no Production branding.
2. Sign in to a dedicated TEST account; if authentication fails, stop and report the error. Never sign in with Production credentials.
3. Switch the whole interface to Chinese and English, refresh and re-check. No logout should be required to change language.
4. Inspect Android portrait and Windows desktop: buttons, charts, popovers and vertical scrolling must remain readable.

### B. Record input, validation, recycle
5. Add a **fake** Expense using normal RM mode: typing `100` must display/save **RM100.00**, not RM1.00.
6. Add a fake Expense using Cents Keypad: typing `2455` must save **RM24.55**, not RM2455.00.
7. Open Calculator, calculate `3.50 + 12.90 + 2 × 5.40 = 27.20`. Verify the amount matches.
8. Create fake Income and Expense with distinct test Notes, edit each transaction's date, type, category, method, note and amount. Refresh and verify no amount scale drift or unexpected field changes.
9. Delete a fake Expense, check 10-second Undo; delete again, refresh, then Recycle Bin > Restore. Confirm original ID and amount return and totals update correctly.

### C. Accounts, transfers, budget and forecast
10. Set fake Opening Balance values in the test account, refresh, and check overall Balance and each Method Balance. Do not expect a known absolute balance if the test account already contains other fixtures.
11. Add a fake `BANK -> TNG RM100.00` transfer. BANK decreases RM100, TNG increases RM100 and combined Total Balance is unchanged. Verify Transfer History filters and edit/delete/undo/restore with separate fake transfers.
12. Save different category budgets for two calendar months. Change the Dashboard Filter: it must not modify any month's Budget Snapshot. Verify 75% and 100% warnings using fake expenses.
13. In Expected Income, enter a fake future plan. The Forecast may change but real Income, Balance and Transaction Records must NOT gain an income row.

### D. Analytics, settings, import/export
14. Choose two arbitrary, even cross-year months in Monthly Financial Comparison and compare figures against fabricated records. Change Dashboard Filter and verify comparison stays unchanged.
15. Select a Category with at least seven distinct fake Note values and confirm Top-7 compact chips appear inline; tapping one fills **Note only**, never auto-saves.
16. Create a fake Savings Goal. Its saved amount/progress should use shared **Total Balance minus current natural month's budget**, clamped at zero. New Goal / Edit use floating modal and do not save real Income/Expense.
17. Verify Category Bubble, Method Donut, Spending Trend, Balance Trend, Heatmap, Top Expenses, enlarged charts and their amount labels on Windows and Android.
18. Open CSV Import: the on-demand module may show Loading momentarily. Preview a fake CSV; before Confirm, no record is inserted. Re-import the exact same fake file to verify safe duplicate skip. Never import real bank statements to Test.
19. Open Excel Export and generate the workbook; verify expected sheets and record/transfer totals. This is **not** a complete database backup. Confirm reopening CSV/Excel after lazy load works.

### E. Sync, ownership, failure handling
20. Same fake TEST user on two devices: add/edit a fake record on one device, allow sync on the other. Refresh and compare exactly.
21. Edit the same fake row on both devices without refreshing: a stale update must give a conflict and not silently overwrite the newer version.
22. Two different TEST users: check that neither can view the other's transactions, savings, custom category/method names or settings.
23. Disconnect internet while attempting a fake save: no ambiguous success message and no invisible duplicate transaction on retry.
24. Confirm there is **no Android Gadget**, no Phase 4 bill notification, no travel auto-tagging, no 4-corner drag transfer, no city XP yet — these are future scope and should not be mistaken for Stage 0 regressions.

## 0.5 Acceptance / blocking criteria

- Automatic tests / build / audit: exact Stage 0 final SHA must be all green.
- Preview: READY, exact SHA, not Production, independent TEST Supabase guard in inspected source.
- Human Windows / Android / same-user sync / separate-user RLS: **Pending until the owner actually performs these steps**.
- Any incorrect RM scaling, transfer total change, cross-account data leak, missing/partial cloud snapshot, repeat save, or wrong Preview DB connection is a blocker.
- Production is **strictly frozen**. Before release: separate, encrypted, complete, independently restorable Production backup and recovery demonstration, schema compatibility and RLS review, manual acceptance, then separate permissions for migration/merge/deploy.
- Git rollback restores code only. Never use it as a database recovery procedure.

## 0.6 Baseline change scope & rollback

- From PR #30, the Stage 0 branch only adds a read-only automated test and this review/acceptance document.
- All finance core modules, versioning, Supabase code, CRUD, existing user settings and database remain unchanged.
- If the Stage 0 Preview does not work, return to the exact PR #30 READY Preview and investigate; do not deploy Production.
