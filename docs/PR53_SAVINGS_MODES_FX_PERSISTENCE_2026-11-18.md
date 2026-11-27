# MH Finance App · Savings Goals modes + Sticky FX entry · 2026-11-18

## Exact starting point
- Based on integrated Draft PR #53, commit `1af18dcc889d5bc1a8e4e37861a65f541703702b`, not Production/main.
- New isolated branch `feat/pr53-savings-modes-fx-persistence-2026-11-18` only; TEST Preview, synthetic test data.
- Scope is limited to the two user screenshot requests and their validation, export, read-only assistant consistency, CI coverage.
- NO production Supabase data, SQL, RLS, Auth, secrets, environment variables, current main branch or Production Vercel deployment changed.

## Savings Goal editor
- Radio options: **Manual input** (existing `saved` amount) or **Auto: Current total balance − full current-month budget × X**.
- `X` is user-editable, from 0 to 120 with max 2 decimals, default 1.
- Auto result is clamped at RM0 and calculated in integer cents with BigInt before formatting. Uses the same verified as-of-today total balance as the dashboard and `monthlyBudgetTotal` from this month's saved budget snapshot (or template).
- Auto uses the **full monthly budget**, per the explicit request; shared Available Savings separately reserves only its **unspent** budget portion, as previously fixed in PR #53. These are separate labeled estimates.
- Mode and multiplier are stored per goal in the existing owner-scoped Supabase `user_settings.savings_goals` JSON field through the pre-existing version-checked `queueSettingsField` flow. No database migration.
- Existing `saved` values, goal IDs, targets, dates and historic Income, Expense, Transfers remain untouched. Auto only computes a display estimate and never creates a transaction, transfers money or changes the stored manual saved amount.
- Legacy goals lacking `savedMode` remain unchanged manual goals, including original serialized shape, until the owner explicitly edits them.
- The savings card, editor preview and read-only Finance Assistant use the same formula.
- Full Excel Export keeps the original **Saved (RM)** column as the preserved manual stored amount, and adds **Saved Mode** and **Budget Multiplier (X)**. Complete Cloud Settings JSON also includes mode and factor.

## Persistent currency selection
- Account-scoped, per-browser `localStorage` preference saves only the 3-letter currency code. User A and B never share a selected entry currency; no amounts, quoted rates, notes, tokens or passwords are persisted.
- After adding Income/Expense, clear only foreign amount as before; keep chosen currency selected. On refresh/relogin on the same browser, restore that account's last chosen currency until manually changed.
- Reset unsaved FX amount, date-specific rate quote and editing draft on account switch. FX reference quote is still fetched and validated for each currency and date; every saved transaction remains MYR-equivalent in the ledger.
- The currency preference is **device/browser local**, not guaranteed to sync to a different phone or browser. That tradeoff avoids changing cloud settings or user finance data without extra authorization.
- If storage is disabled, in-page selection still works, but it may not survive refresh.

## Automated validation and release gates
- GitHub Actions run `44343316331` on commit `b858eda998cd1ad2f04ad6a8c532258dc3032377`: **277/277** tests passed; Vite Build passed; shipped runtime npm audit found 0 vulnerabilities.
- The **full** dev/build dependency audit still fails with the pre-existing **12 HIGH** `picomatch`-related findings, NOT resolved by this UI feature.
- Final documentation/PR SHA may differ; recheck final CI exact SHA before reporting completed.
- Windows/Android real-device functionality, FX API availability when offline, TEST cloud A/B-account end-to-end preference and goal edit/sync remain pending manual validation. Never claim zero bugs, zero risk, full security approval or Production readiness.
- Rollback target for TEST code: PR #53 commit `1af18dcc...`. Code rollback does not restore any database. No SQL was modified.
