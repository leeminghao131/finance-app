# PR82 Production Migration Compatibility Review — DRAFT, 2026-11-26

**DO NOT EXECUTE ON PRODUCTION.** This is a read-only technical audit and a synthetic rehearsal plan, not an approved Production migration. This review branch is based on PR83 SHA **ac438a6aa33faf8c401748d8df9bbb0d0b691866**. Nothing here should be merged into main or deployed.

## Independently verified facts

- Production main: **7b4e2dc28cd64120e8a71a151ed84d06b6e8fd68**, still the original live version.
- PR82 head: **d19be27abf1f96f43064b3b95eb7a7415834d061**, draft, unmerged.
- PR83 head: **ac438a6aa33faf8c401748d8df9bbb0d0b691866**, draft, unmerged.
- Production Supabase **hlkciowyusbhwcwjzfsr**: 3 public business tables, 1 historical migration, 12 owner-scoped policies.
- Independent TEST Supabase **qrkaxxdwqgffhkalvtby**: 9 public business tables, 19 TEST migrations.
- Production encrypted backup [#45831886534](https://github.com/leeminghao131/finance-app/actions/runs/45831886534) succeeded; owner confirmed encrypted download.
- Independent encrypted backup **full SQL restore** [#45840348287](https://github.com/leeminghao131/finance-app/actions/runs/45840348287) **passed**: 687 records, 58 transfers, 2 settings, 2 auth users, RLS/owner/no-JWT checks. It used unchanged roles.sql, plus local-only built-in Auth compatibility columns. Auth external services remain to be reconfigured in a complete disaster recovery.

## Production schema compared with PR82 TEST

| Existing table | Production columns | New TEST columns |
| --- | --- | --- |
| public.records | 9 | updated_at, version, deleted_at, client_request_id, fx_currency, fx_amount, fx_rate, fx_rate_date, fx_provider |
| public.transfers | 8 | updated_at, version, deleted_at, client_request_id |
| public.user_settings | 5 | version, forecast_plans, opening_balances, savings_goals, saved_filters, recurring_bills, review_state, account_checks |

Missing six TEST tables: public.monthly_budgets, public.finance_import_items, public.finance_activities, public.finance_activity_links, public.finance_claims, public.finance_claim_repayments. All need correct authenticated grants, owner-scoped RLS and controlled write/delete rules.

Production currently has owner SELECT, INSERT, UPDATE and DELETE policies on each of records, transfers and user_settings (12 policies). Names of the DELETE policies are **Users can delete own records**, **Users can delete own transfers**, **Users can delete own settings**.

## Existing TEST/STAGING SQL files that have been inventoried

Do **NOT** simply replay TEST migration history or the initial TEST schema in Production:

| Source under docs/database/ | Review |
| --- | --- |
| preview_finance_reliability.sql | records/settings version triggers, Realtime, and **DROP records DELETE policy** |
| preview_finance_transfers_budget_forecast.sql | transfer revision trigger, monthly_budgets, forecast_plans, and **DROP transfers DELETE policy** |
| preview_finance_safe_csv_import.sql | Import markers, authenticated-only RPC, unique source rows; review idempotency / permissions |
| preview_finance_opening_balances.sql | additive JSON settings |
| preview_finance_savings_goals.sql | additive JSON settings |
| test_finance_integrity_request_ids_2026-11-12.sql | unique request IDs and NOT VALID amount/date checks; still apply to FUTURE UPDATE |
| test_finance_transfer_idempotency_settings_guard_2026-11-12.sql | transfer idempotency and **REVOKE DELETE on settings** |
| test_only_stage1_saved_filters.sql | JSON saved filters |
| test_only_stage2_bills_review_reconciliation.sql | recurring bills, review state and account checks JSON shape guards |
| preview_finance_stage3_activities.sql | Activity + activity-link tables, owner RLS and constraints |
| preview_finance_stage3_rls_hardening.sql | activity-link owner checks; depends on activity tables |
| preview_finance_stage3_realtime.sql | Realtime publication; validate RLS and replication scope |
| test_only_stage4_fx_20261117.sql | nullable FX fields, NOT VALID FX consistency check; old MYR amounts untouched |
| test_only_stage4_fx_csv_import_20261117.sql | FX CSV import RPC; enforce authenticated scope and safe replay |
| test_only_claim_tracker_20261121.sql | Claim/repayment tables, replay/version/overpayment guards and RLS; never treat Claim as Income/Expense |

**Most urgent old-client compatibility hazards:** if the DELETE policies are removed while old Production app code is still in use, browser DELETE fails. New revision triggers and NOT VALID future-write constraints can also change behavior for an old active session. Do not apply the test SQL wholesale or preempt the website cutover.

## Proposed gate-separated migration steps (design only)

**Gate A — frozen baseline and current backup:** verify encrypted offline backup can be restored for the CURRENT Production snapshot. If records changed since previous backup, take and validate a fresh one. Verify count, account ownership, record IDs, amounts, dates, categories and methods without publishing raw values.

**Gate B — additive compatible preparation:** only add missing nullable/default-safe columns, six tables, indexes, carefully reviewed grants/RLS, and limited RPCs. No historical UPDATE/DELETE. Keep legacy browser permissions operational. Do not silently move, overwrite or reset category budgets.

**Gate C — transaction and access regression:** on an isolated *synthetic* schema clone with two fictional accounts, exercise old production client before cutover and PR82 after cutover. Verify stale version edits, cross-account RLS, CSV repeated requests, Claim partial refunds, FX consistency, RM vs cents keypad (RM100 must not become RM1), budget month boundaries Asia/Kuala_Lumpur, and Transfer neutral to Income/Expense. Verify realistic pagination and failed cloud-read behavior.

**Gate D — controlled security and frontend switch:** coordinate soft-delete policy cutover, new protected Production client environment and website deployment. Preview MUST continue to refuse connection to Production. No implicit Vercel auto-release by prematurely merging main.

**Gate E — read-only post-release reconciliation:** verify existing website URL, accounts, balances, history, transfer neutrality, user-defined categories, CSV/Excel, all charts, Forecast, Calendar, Spending Radar, Windows/Android and two-account separation. Compare snapshot hashes and amounts.

## Exact blockers not yet satisfied

1. **No reviewed, production-adapted migration script or migration-on-fictitious-data rehearsal yet.**
2. **PR82 source still has TEST-only Supabase client guard**; a separately tested Production-only configuration must be created without permitting Preview to access Production.
3. Final release SHA complete CI (npm test, npm run build, npm audit) and real Windows/Android/two-account user acceptance are not verified.
4. Full Vercel Production env separation and post-cutover rollback plan (Git and SQL are different) need verification.
5. Apply Production SQL, modify Production environment, merge main, and deploy Production each require explicit separate owner approvals.

## Safety invariants

- Do not run the scripts above against Production as-is.
- Do not attempt restoration of real data in shared TEST: fake users and fake records only.
- A Realtime/soft-delete/constraint change is a **business behavior change** despite appearing as schema-only.
- Do not remove existing owner RLS, change category/payment keys, rewrite amounts or invalidate old user IDs.
- A Production rollback of website code does NOT revert database structure.
- Only after successful synthetic rehearsal, exact-SHA CI and restored-backup confirmation should Production cutover be scheduled.

**Current status:** isolated backup restore PASS; PR82 Production migration and release NOT executed or approved.
