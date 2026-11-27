# MH Finance App — Phase 4 Stage 1 Preview Test (2026-11-14, Asia/Kuala_Lumpur)

**TEST ONLY:** All actions must use MH Finance Test, fake test accounts and fictional amounts. NEVER use Production credentials or real finance records.
Stage 1 is based on full Stage 0 baseline branch `integration/phase4-stage0-verified-baseline-2026-11-14` (commit `edcf713779b83810cbf7cea2303beae6ba28fdbf`).
Stage 1 must NOT be merged into `main` or deployed to Production without separate explicit release approval, a fully verified independent encrypted Production backup and restore test.

## Existing features to retain
Income / Expense CRUD, cents keypad, RM input, custom categories/methods, Transfer conservation + History and Undo, Opening Balance, Recycle Bin, Monthly Budget snapshots, Forecast and Expected Income, Month Comparison, Savings Goals, Quick Notes, Excel/CSV, Chinese/English, Android/Windows, pagination, RLS and sync.

## 04 Budget burn-rate forecast
1. Log in to the Stage 1 Preview with a fake Test account. Confirm TEST MODE.
2. Click Monthly Budget icon within **Filtered Expense** (do not change global homepage Filter).
3. Select a current natural calendar month and use **Budget details** to save fictional category budgets, e.g., Food RM600.
4. Create fake expenses in that category for the selected month. Open **Burn Rate Forecast** tab.
5. Compare actual spent, monthly average projection, last-7-days projection, possible overspend, daily safe allowance and risk indicator. Expected month-average = spent / days elapsed × days in month.
6. Switch to previous month, then future month; historical month must show actual spending rather than a fabricated prediction, and future must say the estimate is unavailable.
7. Change normal Dashboard filter; Monthly Budget predictions remain tied to selected natural budget month, not Dashboard filter.
8. Before saving a budget draft, enter a value in Budget details then visit Forecast and return. Unsaved draft must not be silently saved or overwritten. Values should not affect other months.

## 08 Advanced filters with cloud favorites
1. Open Transaction Records > Advanced Search. Choose a custom date range, Income/Expense, multiple Categories and Methods, minimum/maximum RM amounts, keyword and global sort by amount.
2. Click Apply. Results must include exactly matching fake rows, globally sorted (not grouped), and **only** the Records list changes; homepage charts/totals retain the original Dashboard Filter.
3. Edit a fake transaction using the desktop/mobile records editor, then confirm it appears or disappears as filters demand. Delete a fake row, verify it moves to Recycle Bin.
4. Give a search a name and select **Save to cloud**. Close, refresh, reopen; the favorite must still exist and apply the saved criteria.
5. Sign into the same TEST user on a second device: favorite list must match after sync. Sign into a different TEST user: other user's favorites must not appear.
6. Two devices save different favorites with stale settings: the older change must be rejected, with reload/review; avoid silent overwrite.
7. Delete only a favorite; verify no financial rows are deleted.
8. Check nonexistent date (e.g., 2026-02-29), min > max and invalid amount formats are rejected. Review-status filtering is Stage 2 scope and not included yet.

## 16 Finance Wrapped
1. In Finance Intelligence select **Finance Wrapped**. Switch between Monthly, Custom Quarter (any three consecutive months, including cross-year) and Yearly.
2. Navigate all 10 story pages with Previous/Next; verify Income, Expense, Net, Categories, Methods, highest expense, top notes and period-over-period difference against saved fake records.
3. Check **Budget performance**: only saved historical month snapshots count as confirmed. Missing historical snapshots must be flagged, not backfilled from today's default budget.
4. Deleted/trashed Expense and Transfers must not be counted as spent.
5. Toggle **Hide RM amounts**. Confirm shared visuals do not reveal amounts. Save summary as PNG to your device with and without privacy mode.
6. Changing the Dashboard date filter must not affect the selected Wrapped period. Activity Wrapped is planned for Stage 3, not implemented here.

## 18 What-if Simulator
1. Open **What-if Simulator**. Try 3, 6, 12 and 24 months.
2. Use sliders and numeric inputs: extra monthly income RM300, monthly spending reduction RM200 and extra monthly spending RM100 imply an improvement of RM400/month. Six months = RM2,400 extra difference in illustrative linear model.
3. Observe two projection lines and sample count from the prior 90 days. Graphs must remain legible on Android and Windows.
4. Save up to three named scenarios on the current Test device and compare lines for scenarios with matching duration; each saved scenario also shows its own final result.
5. Refresh: presets saved on this device remain. Change Test users: one user's device presets must not appear in the other's account.
6. Reverse planning: additional RM10,000 over 12 months needs at least RM833.34/month (rounded upward in sen).
7. Confirm simulation never creates real Income, Expense, Transfer, Expected Income or Budget changes.

## Standard safety regression
- RM input `100` -> RM100.00, Cents `2455` -> RM24.55, calculator arithmetic correct.
- BANK -> TNG RM100 lowers BANK and raises TNG while total Balance stays unchanged.
- Undo, soft delete, Recycle Bin Restore, Budget month independence, Expected Income forecast-only, Opening Balance and Savings Goals remain unchanged.
- CSV Import preview before confirmation and idempotent retry; Excel Export round-trip check; language toggle.
- Fake-test two devices: record edits conflict safely; two distinct test users never see each other's private data.
- If the Preview fails to show TEST MODE or fails to load a complete snapshot, stop. Never retry with Production credentials.

## Release gates
- GitHub Actions tests/build/audit must pass for the **exact final Stage 1 commit**.
- Vercel Preview must be READY and point to that same exact SHA, `target=null`.
- Isolated MH Finance Test must expose `user_settings.saved_filters` JSONB with owner RLS, version-guarded updates.
- Windows/Android/two-device/manual acceptance remains **PENDING** until actually performed.
- No production schema or database changes, no main merge, no Production deployment.
- Any future Production release requires separately approved migration review, independent encrypted full backup + verified restoration, complete regression and manual acceptance, and explicit main/production approvals.
