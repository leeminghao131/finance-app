# MH Finance App · Final integrated P0–P3 hardening · 2026-11-23

## Baseline, scope and release boundary
- Exact source baseline: Draft PR #72 head `a12ab82c767fd499ba803393d09f04cc93afd3e1`.
- New isolated release-candidate branch `fix/pr72-final-16-issue-hardening-2026-11-23`, Draft PR stacked **on PR #72**. All previously implemented P0, P1, P2 and P3 feature branches remain in the ancestry.
- **Only app code, UI preferences, pure analytics and tests modified**; no SQL, RLS, Auth policy or Supabase database changes.
- No Production Vercel deployment, no `main` merge, no production environment variable changes, no real financial record reads/writes.
- A Git rollback does not restore production PostgreSQL data. Before Production release: independent encrypted backup, verified restore plan, real Android+Windows TEST acceptance and **separate explicit owner approval**.

## Sixteen reviewed items — current treatment

| Item | Severity | Change / result | Remaining caveat |
|---|---|---|---|
| #01 Old overdue bill inaccessible | P1 | `checkBillPaymentEligibility` now includes same oldest overdue item as visible UI, keeping deterministic same-bill request ID and Expense recovery | Manual bill occurrence history UI pending |
| #02 CSV import on account switch | P0 | Every 100-row chunk checks owner ref AND current Supabase `auth.getUser` both before/after RPC; errors fail closed and same-file import markers remain retry-safe | Browser/session switch *inside* an in-flight RPC is not a database-atomic operation; test simultaneous-tab behavior before release |
| #03 Old account content during auth transition | P0 | Loaded snapshot stores owner ID; financial dashboard cannot render until authenticated account matches verified snapshot owner | Two-account browser manual smoke test pending |
| #04 Old background snapshot overwrites newer write | P1 | Epoch increment on confirmed records/transfers/claims/bills/settings, and `loadSnapshotAfterWriteStability` re-reads an entire verified snapshot when epoch changes; never commits stale response | Supabase serializable DB-wide snapshot is not added; underlying double-scan/version logic remains |
| #05 Period net flagged as low assets | P1 | `Filtered Balance` period net never uses true asset alert threshold; true Balance retains account-scoped alarm | None known in static logic |
| #06 Floating-point dashboard sums | P1 | Income/Expense and aggregate assets now sum in integer MYR cents and reject unsafe totals; Transfers remain total-neutral; Claims stay cash-only | Other view-only derived series still format numbers, no stored values are changed |
| #07 Duplicate matching Claims from separate devices | P1 | Checks active claims for same date, title, claimant, method and cents; asks for explicit confirmation and preserves truly separate advances | **Warning, not proof against simultaneous cross-device creation**; enforcing business-content uniqueness risks collapsing two legitimate payments and needs a distinct approved design |
| #08 Deleted custom category not filterable | P2 | Filter category choices include categories found in active historical rows, preserving raw category keys | Test with custom account and deleted options manually |
| #09 Review candidates stale across midnight | P2 | Reviewer takes `asOfDate` from App's Kuala Lumpur local-midnight state; recalculates on date change | Physical browser awake-through-midnight test pending |
| #10 Desktop edit draft lost on failure | P2 | Edit stays open until `onSave` acknowledges server; original opened version is passed unchanged, invalid/failed draft retained and error shown | Concurrent-edit manual test pending |
| #11 Forecast expense chart expensive daily rescan | P2 | One map of per-day integer cash deltas + sorted chronological sweep, same forecast totals / Claim cash movements, drastically reduces repeated scans | Large-record Android performance manual test pending |
| #12 Bubble chart constant Android CPU | P2 | Coarse-pointer/touch browsers display static accessible SVG bubbles; desktop physics throttled to about 30 updates/sec; hover/focus/click intact | Touch interaction and low-end Android performance pending |
| #13 Scenario stale midnight | P2 | Both scenario and saved presets use current `asOfDate` prop from App and dependency arrays | Cross-midnight manual test pending |
| #14 Month export Claims Outstanding unclear | P3 | Worksheet label explicitly indicates outstanding amount is all-account as of export date, not selected-month subtotal | Excel contents remain read-only |
| #15 Nested modals wrongly restore body scroll | P3 | Shared ref-count body lock; closes restore prior CSS only after last portal; focus restoration restricted to topmost dialog | Nested popup Android/backdrop manual test pending |
| #16 History hard caps | P3 design limit | **Intentional fail-closed limit retained** for 800 account checks, 5000 review decisions, 40 bill plans, 1000 monthly budget history and other bounded volumes. No historical row is deleted or truncated to dodge the limits | Future redesign into paginated owner-scoped tables needs explicit data/schema impact review. The existing caps are NOT claimed fixed |

## Testing and verification policy
- Original baseline PR #72: 377 tests.
- New targeted suites: `tests/finance-final-account-sync-import-2026-11-23.test.mjs` (9 tests) and `tests/finance-final-forecast-ui-regression-2026-11-23.test.mjs` (8 tests); target all four stages' original regressions plus new failure modes.
- Existing UI tests updated **only** when they asserted prior literal implementation details; they still verify modal focus/scroll, business identities, Claim separation and precise account sums.
- Validated: 101-row account-switch CSV failure, old overdue bill, owner-gated snapshot, read-epoch retry exhaustion, date-aware review and scenario, forecast numerical equivalence, nested modal safety, historical categories, Claim warning, export labels and explicit retained history limits.
- CI: Node tests, Vite production build, npm runtime and full audit. Record the run and **exact final commit** only after complete success; a Preview READY URL does not replace visual acceptance.
- Actual browser Test identity switch, CSV import under real RLS, claim concurrency, large volume, Android SVG interaction and real-device UX **NOT manually verified**.

## Production safety
- Branch includes existing `src/supabaseClient.js` **fail-closed test-only project URL guard**. Do NOT remove it in this PR simply to make a production site start.
- All test previews must be on isolated TEST credentials with synthetic money. Never attach a preview to production Supabase or store Production API secrets in Preview.
- Production remains at the prior real deployment commit until the owner separately approves a reviewed release. Do not label this Draft PR as an already-deployed final website.
