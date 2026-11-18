# MH Finance App · PR #52 Integrity Fixes · 2026-11-18

## Safety baseline
- Starting point: PR #52 branch `ui/hover-notifications-assistant-mobile-drawer-pr51-2026-11-18`, **exact commit `c504c91708b3ed6427ff0ed2224ec8ae93816659`**.
- All changes in new `fix/pr52-finance-integrity-complete-2026-11-18`. Do not merge to `main` or deploy Production.
- Never executed Supabase SQL writes, Auth/config changes, RLS changes, migrations, Production environment changes or live finance record edits.
- The TEST deployment uses `src/supabaseClient.js` fail-closed project guard; use **fake records only**.

## Delivered code changes and intended data invariants

| Item | Corrected behavior | Files | Data impact |
|---|---|---|---|
| Per-goal savings progress | Show **each goal's existing `saved`** versus target, with editable manual savings progress. Shared available funds remain only a read-only aggregate estimate. | `FinanceSavingsGoals.jsx` | No record writes; only existing explicit settings save when owner presses Save |
| Budget double reserve | Shared available savings deducts the **unspent** portion of the current natural month's category budgets, not the full budget already partly spent. Expenses without budgets are not double-deducted; over-budget category reserve clamps at zero. | `financePlanning.js`, `App.jsx` | Read-only calculation |
| Future-dated ledger records | Main Total Income/Expense, Balance and Method Balances display only transactions with date `<= localToday`; future entries remain in the full ledger and analysis. Forecast continues to use its as-of-date actual balance. Future Money Transfers do not prematurely alter Method Balances. | `App.jsx` | Read-only calculation; no saved dates changed |
| Actual historical balance trend | Begin with opening balance and earlier records prior to the chosen period; independent of category/keyword search. Future dates have no actual plotted balance. Filtered Balance *card* remains period net movement as before. | `App.jsx` | Read-only chart |
| Category deletion | Remove only the user custom option, **never delete its saved budget-template key**, monthly snapshots or historical records. | `App.jsx` | The existing authorized custom-option deletion behaves as selected; budgets untouched |
| Budget write reliability | Auto-template updates stay in an unsaved draft and are not presented as a saved cloud template before acknowledgement. Failure shows status and Retry; a retry refuses to overwrite a newer confirmed template from another device. Existing monthly budget revision checks and editor draft remain unchanged. | `App.jsx` | No silent overwrite; server version guard preserved |
| Complete browser Excel export | Preserve existing sheets and append Cloud Settings JSON, Savings Goals, Recurring Bills, Activities, Activity Links, Review Decisions, Account Checks, Saved Filters and Custom Options. Metadata fragments are <= 25k UTF-16 units, preserve emoji and cannot execute Excel formulas; read-back check includes every cell. | `financeExcel.js`, `FinanceExcelExportPanel.jsx`, `App.jsx` | Read-only; NOT a full recoverable Supabase database/Auth/RLS backup; device-local image/preferences excluded |
| Category comparison consistency | Selected-side category/keyword scope uses matching records, opposite transaction type uses **complete same-period baseline**. Add explicit explanation to Filtered Income/Expense cards. | `financeDashboardCategoryFilter.js`, `App.jsx` | Read-only analytics |
| Today Summary | Label period's income-minus-expense as **今日净收支 / Today Net**, never account balance. | `App.jsx` | Text only |
| Bilingual UI | Add translations for new calculations, sheet names, budget and chart explanation. Do not translate input values or DB keys. | `financeLanguage.js` | Display only |
| Cloud fetch speed | Fetch four independent owned tables in parallel. Each `loadEveryOwnedRow` still performs two complete count-checked, paginated reads and `validateFinanceSnapshotRows` must pass before displaying totals. | `financeCloudService.js` | Read-only; no sampling, record omission or cache substitutions |

## Automated verification
- GitHub Actions `44337534714`, exact SHA `d21382f6b07ddf9285521fb6d4366334320ecd3d`: **269 / 269** synthetic + structural regression tests PASS; Vite production bundle build PASS; shipped/browser dependency audit **0 reported vulnerabilities**.
- Full npm toolchain audit **FAILS with 12 HIGH / 0 critical** inherited dev/build issues. Most originate from `picomatch` GHSA-fc5q-39xc-vjpf, without a verified compatible patched release at the time of this run. The strict gate is intentionally not bypassed.
- Later final commit(s) and Preview must be verified separately before treating final SHA as tested.
- Tests were run in GitHub CI with mock/fictional records. Windows/Android hands-on workflows, Test Account A/B authorization, actual network loss, real browser Excel download/open, and measured large-record sync latency **remain pending manual validation**.

## Security and release blockers still pending
1. **Full upstream dependency vulnerability remediation** — cannot truthfully claim 0 HIGH until compatible fixes exist and the full npm audit passes. No unsafe `npm audit fix --force`, Tailwind v4 rewrite, Vite downgrade or disabled gate.
2. **Supabase Leaked Password Protection** — both TEST and Production Supabase security advisors report WARN. The connected tools expose read-only advisors but no authorized Auth setting edit. Do not silently alter production login behavior. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
3. **Human Windows/Android acceptance** — verify the new manual goal-saved editor, present balance vs future dates, the Excel extra metadata, current budget save/retry, category+keyword comparisons, mobile drawer/popup and bilingual display.
4. **Encrypted, verified recoverable Production database backup and explicit Production authorization** mandatory before merge/promotion.
5. **Device-specific storage** (sound/language/card text or picture) is not a database export; Excel includes cloud finance settings and activities, not device-local storage or Supabase Auth credentials.

## Rollback and truthfulness
- Baseline branch/commit PR #52 `c504c91708b3ed6427ff0ed2224ec8ae93816659`.
- If any new Preview behavior fails, continue using prior PR #52 READY Preview; **do not merge** the fix. The code revert would never restore DB changes, but no SQL changes were executed in this work.
- No system can guarantee “zero remaining bugs”; do not label QA complete before manual acceptance or all vulnerability gates clear.
