# MH Finance RC89 — Production release checklist and rollback gates (2026-11-27)

**Status: RELEASE BLOCKED UNTIL EXPLICIT APPROVAL AND FINAL CURRENT BACKUP.**
This is a plan and evidence tracker, not authorization for Production SQL, Production env changes, `main` merge or deployment.

## Exact targets and constraints

- Existing Production app/site: `finance-app-ivory-theta.vercel.app`; keep this canonical domain and its original account logins.
- Existing Production Supabase: `hlkciowyusbhwcwjzfsr`; never copy actual records into the Test project.
- Isolated TEST: `qrkaxxdwqgffhkalvtby`; Preview must never reach Production.
- Release candidate: `release/rc89-prod-preflight-2026-11-27`, based on verified PR89 `05e5a937123928f6847ca2aa56fcad813963c89f`. This candidate removes performance diagnostic HUD and query switches but retains desktop material/coin fixes.
- Current old Production `main` SHA (at this audit): `7b4e2dc28cd64120e8a71a151ed84d06b6e8fd68`.
- Latest read-only Production baseline at audit: **688 records, 58 transfers, 2 user_settings, 2 users**; owner/amount checks passed. Values WILL change during normal usage.
- Verified earlier encrypted full logical SQL backup and isolated restore: [backup #45831886534](https://github.com/leeminghao131/finance-app/actions/runs/45831886534), [restore #45840348287](https://github.com/leeminghao131/finance-app/actions/runs/45840348287), based on **687 records**. **NOT current enough for a release that may impact newer rows.**
- Existing synthetic old-to-TEST migrations: [#45841822837](https://github.com/leeminghao131/finance-app/actions/runs/45841822837) PASS, but scripts applied old DELETE policy drop during migration. The new staged plan separates these changes.

## Stage 1 / Stage 2 draft SQL

- `docs/release/production-sql/DRAFT_STAGE1_COMPATIBLE_PREPARE.sql`: exact 15 ordered, current TEST source scripts, except that two `DROP POLICY` and one `REVOKE DELETE` on existing business tables are deferred. Preflight verifies old three-table shape, RLS, 12 policies and old-record future CHECK compatibility. Entire operation in one PostgreSQL transaction with lock and statement timeout. It creates tables, triggers, indexes, authenticated RLS and additive settings/FX fields. **Does not INSERT, UPDATE or DELETE historical transaction rows.** Existing old-client delete permissions must remain intact after Stage 1.
- `docs/release/production-sql/DRAFT_STAGE2_SOFT_DELETE_CUTOVER.sql`: separately gated transaction that removes old permanent DELETE access only when the new frontend replaces old code. Preflight requires Stage 1 tables and soft-delete columns. Cross-account RLS remains enforced.
- Drafts are **not yet approved**; passing fake-data tests is necessary, but the actual Production operation still requires a fresh independently verified backup, exact review and separate user authorization.
- Note: the source SQL includes TEST/STAGING-only notices. Their content is repackaged here as unapproved review candidates; do not run raw source files directly on Production.

## Blocking launch checklist, in mandatory order

1. **Release SHA review**: inspect exact `main..release` changes and finalize this release branch. Do not casually merge 953 historical commits and 259 files without review. Preserve PR89 CSS and original account/amount/transfer logic. Remove only temporary Preview diagnostic hooks, not genuine features. Rerun exact SHA Node tests, Vite build, high/critical dependency audit and staged local-SQL synthetic test.
2. **Vercel isolation**: confirm Preview URL uses only `qrkaxxdwqgffhkalvtby`. Confirm Production environment variables point to `hlkciowyusbhwcwjzfsr` and only contain a publishable/anon browser key, no service_role. The connector currently lists scoped sensitive variables but does not expose readable values, so effective binding still needs an authenticated check; do NOT paste secret values into chat. Verify build-time `VERCEL_ENV` is actually `production` for Production. Do not change production env unless separately approved.
3. **Fresh snapshot**: arrange brief write freeze on both old-site browsers, snapshot all current accounts/records/transfers/settings, capture per-owner counts and amount/hash totals privately. Run existing protected read-only encrypted dump workflow, download the new encrypted artifact to independent safe storage, keep passphrase separately, restore in a completely isolated disposable PostgreSQL environment and verify current counts and RLS (old 687 backup alone is insufficient). Never upload plaintext or secrets.
4. **Authorize Production Stage 1 only** (separate positive approval): perform preflight on current Production, then run reviewed Stage 1 in one transaction; expect no historical INSERT/UPDATE/DELETE. Compare row counts, original amounts, dates, category/method values and per-user ownership. Validate old website SELECT/INSERT/EDIT/DELETE (only if coordinated and safe) and two-account RLS. If any mismatch, stop, do not continue to Stage 2.
5. **New-code cutover coordination**: old tabs must be closed/refreshed; coordinate brief maintenance/read-only window so old UI cannot issue destructive DELETE while Stage 2 policy is changed. Carefully verify latest Production client variables and route guard first. The newer client needs working 9-table schema before it is served.
6. **Authorize Stage 2 Production SQL** (separate positive approval) immediately before coordinated new-client cutover; then separately authorize `main` merge and Production deployment or use an explicitly approved staged Production deploy/promotion workflow. Git-integrated `main` may automatically deploy, therefore explicit merge approval alone must not be silently treated as Production deployment consent.
7. **Post-cutover safe validation**: confirm original URL, real login, mobile+Windows responsiveness, all 688+ pre-release ledger rows unchanged, exact money and account ownership, transfers not Income/Expense, budget template and month rows, sync/version conflict, RLS two-user isolation, CSV/FX/Claims/Excel export and forecast-only expected income. Watch logs without exposing user records.
8. **Release decision**: If any check fails, **freeze writes first**, preserve current DB and error evidence. Git rollback restores only frontend; database changes remain. Never automatically restore an older full dump over new valid writes. Decide targeted repair or forward-fix after review; any change to Production rows/schema requires explicit owner approval.

## Independent rollback strategy

- **Before Stage 1**: old website and Production schema unchanged; safe to halt.
- **Stage 1 transaction failure**: PostgreSQL atomic rollback. No source finance rows should change. If the migration committed but application logic fails, do NOT drop additive fields/tables: keep them, keep the old website serving its existing data, investigate while retaining old DELETE policies.
- **After Stage 2**: the old client might no longer delete permanently; reverting Vercel code **alone** is not a full rollback. Prefer a reviewed forward-fix of the new client or safe read-only maintenance. Re-granting permanent DELETE to old clients is a separate, high-risk security/business decision and must not happen automatically. A full DB restore could discard newly added real records; preserve both snapshots and obtain owner approval for targeted restoration.
- **After successful release**: keep both independent encrypted backup copies, the original Production deployment ID, and exact tested release SHA.

## Completed / incomplete classification

Completed: initial encrypted logical backup and RLS restore at 687-row snapshot; old-to-TEST synthetic migration; PR89 automated finance checks; user's PR89 Windows performance and other feature acceptance; Production read-only 688-row shape/ledger checks.

Incomplete: current release-SHA staged migration verification; updated encrypted current backup + independent restoration + user download; Vercel effective sensitive env check and main branch protection verification; final release-candidate Windows/Android smoke test; all distinct Production approvals.

**NO PRODUCTION DATABASE MIGRATION, CREDENTIAL UPDATE, MAIN MERGE OR PRODUCTION DEPLOYMENT IS AUTHORIZED BY THIS DOCUMENT.**
