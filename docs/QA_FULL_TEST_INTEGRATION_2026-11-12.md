# MH Finance App — Full Test Integration (2026-11-12)

## Version / dependency
- Branch: `integration/finance-full-test-2026-11-12` (NOT main).
- Tracking Draft PR: #22, targeting a development-only base.
- UI stages: #9 and its follow-on #12–#19 (including layouts, chart repair attempts and expanded overlays).
- Finance phases: #2, #4, #5, #6, #7, #8 inherited by the UI branch.
- QA #10 integrated via test-only PR #20.
- Opening Balance #11 integrated via test-only PR #21.
- Production branch, website and production Supabase have not been changed.

## Additional fixes in integration
1. Hide the dashboard whenever a background cloud reload fails; stale data is never shown as a verified total.
2. Fail closed on invalid amounts, types, dates and critical account fields returned by the database; never convert malformed money to RM0.
3. Scope personal-card browser storage to the signed-in user; legacy global keys are left untouched, not deleted or copied to other accounts.
4. Add stable client operation UUIDs and unique per-user server indexes for Income/Expense and Money Transfer. Resolve retries with lost acknowledgements by reading the existing row instead of creating a second one. Only non-sensitive hashes/request IDs go into sessionStorage.
5. In isolated **MH Finance Test** only, create additive nullable request-ID columns, partial unique indexes, and a `NOT VALID` future-write integrity CHECK; no existing records were rewritten.
6. In **MH Finance Test** only, revoke authenticated DELETE privilege on user_settings; SELECT/INSERT/UPDATE owner paths are retained.
7. Update the legacy UI-only forecast test to account for the already implemented Opening Balance parameter.

## Database no-data-change verification
Before and after test-only additive migrations:
- Test `records`: 647 rows, old request-ID tags 0.
- Test `transfers`: 1 row, old request-ID tags 0.
- Test `user_settings`: 1 row.
- Test `records` and `transfers` RLS enabled.
- Authenticated DELETE privilege on test user_settings: revoked.
- Integrity constraint is deliberately NOT VALID for historical rows and enforced only on future writes/updates.
- No actual financial rows, dates, amounts, IDs, notes or owners were updated or deleted.
- **Production database was not queried for business records or modified**.

## Automated CI and limitations
CI suite includes synthetic test scenarios for amount entry, duplicate clicks, lost acknowledgements, stable request IDs, cloud reload consistency, validation, owner-scoped balances, forecast, CSV import and Excel export, Chinese/English UI and mobile UI structure.
- Latest exact CI run and Preview SHA must be verified again after every commit.
- A Vercel build marked READY is not a substitute for manual browser testing.
- Preview uses a fail-closed client guard requiring `https://qrkaxxdwqgffhkalvtby.supabase.co`. Environment metadata declares Preview credentials separate from Production. Actual end-user login must still be tested on the Preview.

## Manual acceptance checklist — fake data and Test account ONLY
- [ ] Windows and Android: open the exact linked Preview, confirm **TEST MODE** and sign in with a TEST account (do not reuse live credentials).
- [ ] Amount RM typing: `100` => RM100.00; `24.55` => RM24.55; Cents keypad `2455` => RM24.55.
- [ ] Calculator `3.50+12.90+2*5.40` => RM27.20; press Calculate & Fill, save fake Expense, refresh, verify.
- [ ] Rapid double-click Add; confirm only one record and one total change.
- [ ] Simulate slow/offline network without real records; check uncertain-save warnings and retry; no duplicate ID or amount.
- [ ] Transfer BANK->TNG RM100; per-account balances offset, whole-account total unchanged; duplicate request/retry doesn't create a second transfer.
- [ ] Set Opening Balances for BANK/TNG/CASH; verify sum and Forecast; Expected Income never increments actual income.
- [ ] Open Budget from Filtered Expense; 75% / 100% warnings, independent months and no autosave on dismiss.
- [ ] Income/Expense soft-delete and restore; Transfer History recycle restore; original IDs and amounts preserved.
- [ ] Test CSV preview, duplicate flags, confirmation, same-file retry; test Excel records/transfers/budgets/expected income/Opening Balances and optional trash.
- [ ] Toggle full Chinese/English; verify source keys and financial totals unchanged; reload language persisted.
- [ ] Windows + Android charts are visible; expanded trend overlays, mobile records, heatmap, popup stacking and close actions work.
- [ ] Two independent TEST accounts: no cross-user data access, Opening Balance or custom settings leakage.
- [ ] PC & Android same TEST account: concurrent edits and disconnections; latest version wins or explicit conflict, never silently overwrites.
- [ ] Failing cloud refresh hides totals until a verified full reload succeeds.
- [ ] Confirm user-facing PDF/Excel exports are NOT a recoverable Supabase database backup.

## Known remaining release blockers
- Manual browser and two-device RLS end-to-end tests are NOT yet run.
- Auth leaked-password protection advisor warning on Test requires separate Auth configuration review.
- Database multi-table snapshots are not atomic in PostgREST; per-table verification minimizes but does not eliminate all race windows.
- This is NOT approved for Production. Production schema migration, independent encrypted full backup, restoration validation, actual-device acceptance, and separate authorization are still required.
