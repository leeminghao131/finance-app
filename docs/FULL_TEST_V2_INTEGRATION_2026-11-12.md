# MH Finance App — Complete Test Integration v2 (2026-11-12 MYT)

**Scope:** GitHub feature-branch code integration for user-run staged mass testing. NOT an approved Production release.

## Evidence and history
- Reviewed available project conversation summaries and uploaded MH_Finance_App_Changelog_2026-11-12_v7.md. This is NOT a claim to have retrieved every verbatim chat message.
- Rechecked GitHub PR #1–#26 metadata. PR #24 is closed and superseded by PR #25.
- Confirmed Vercel project finance-app has separate Preview and Production environment-variable targets (values were not decrypted or displayed).
- Confirmed isolated Supabase Test project has user_settings.opening_balances, user_settings.savings_goals and version columns. User-owned RLS policy predicates were reviewed, no user financial records read or changed.
- Confirmed `src/supabaseClient.js` hard-requires Test Supabase project `qrkaxxdwqgffhkalvtby` and disables the client if the actual build URL does not match.

## Branch composition
- Starting point: `feature/finance-ui-four-tweaks-2026-11-12` at commit `5094b7ba409e3013c56a0bb3baceaa85403cab2b`. This branch contains baseline full integration #22, Month Comparison/Quick Notes/Savings Goals #23, and UI placement/auto-savings #25.
- Applied PR #26 manually and minimally: `src/FinanceCategoryBubbleChart.jsx`, `src/FinanceMethodDonutChart.jsx`, `tests/finance-premium-bubble-donut-ui.test.mjs`, two display imports/instances in `src/App.jsx`, and corresponding chart tests.
- Retains all prior finance data safety, CRUD, cloud sync, expected-income, budget, Opening Balance and Excel logic. No unrelated finance handler modifications.
- Integration branch: `integration/finance-complete-test-2026-11-12-v2`.
- Draft PR #27 targets a feature branch, Draft PR #28 targets `fix/finance-qa-four-issues-2026-11-12` for full independent CI checks; neither PR targets `main`.

## CI results (before this documentation-only commit)
- GitHub Actions run `43222509613` on `7ae1588df3ddffe8614c9a40b1910ef65d6e7a05`: 102 tests, 102 pass, 0 fail.
- Vite build passed.
- npm production dependency audit reports 0 advisories.
- Automated tests are synthetic/unit/source structural tests. No authenticated Windows/Android end-to-end browser session completed for the newest combined build.

## Vercel Preview deployment blocker
- New exact-SHA Vercel Preview creation failed with HTTP **402 payment_required**:
  `api-deployments-free-per-day`, more than 100 API deployments on Hobby Free plan; retryAfter 86400.
- Both Git Auto Deployment status and manual Preview creation were affected. No new exact-SHA Preview URL exists for this branch as of this report.
- An old READY Vercel preview from PR #25 or PR #26 is **not** a full v2 integration: DO NOT present either as the latest completed combined Preview.
- Never upgrade the plan or change billing automatically. Project must remain RM0.

## Large-scale manual staging acceptance when exact-commit Preview is available
1. Confirm the Preview shows independent **TEST MODE**, and use test-only login and fabricated amounts.
2. Verify RM entry (`100` -> RM100; `24.55` -> RM24.55), Cents Keypad (`2455` -> RM24.55), calculator arithmetic, edit and delete/restore.
3. Income/Expense and Money Transfer double-click, slow network/ambiguous response, idempotent retries; one action, one row, correct amounts.
4. Opening Balance by payment method; all balances sum including opening amounts; Transfers sum to zero across methods; Expected Income is forecast-only.
5. Monthly Budget per natural month, version-conflict checks, 75% and 100% warnings.
6. CSV preview, duplicate detection and same-file retry; Excel export includes all fields, deleted rows only in optional trash sheets, Opening Balance, Savings Goals if supported by export format.
7. Monthly Financial Comparison for arbitrary months including cross-year; independent of dashboard filters.
8. Quick Add up to seven prior Note chips, filtered by type/category; selecting chip only fills Note, does not save.
9. Savings Goals automatic shared available savings is Balance including Opening minus current-month budget total; compare snapshot/template fallback; does not modify actual records.
10. Expense Category floating bubbles and Method Ratio donut; ensure category/method proportions and RM figures equal aggregates; check Android smoothness and reduced-motion preference.
11. Bilingual UI on login, Dashboard, filters, chart, budget, forecast, transfer, CSV and dialogs; source Keys/Notes unchanged.
12. Windows + Android, same TEST user two devices: realtime, conflict, reconnect, paginated records. Two different TEST users: RLS and local-storage isolation.

## Hard boundaries and unresolved items
- Production `main`, Supabase Production schema/data and Production Vercel are unchanged.
- Test migrations already prepared for Opening Balance and Savings Goals; no new Test DB migrations made in v2 integration.
- Two-device true concurrency, Android/Windows browser tests, full restore test, and a verified full Production database backup are outstanding.
- Never merge to `main` or publish Production without independent explicit approvals and all safety gates.
