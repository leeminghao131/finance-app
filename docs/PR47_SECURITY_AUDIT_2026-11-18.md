# PR #47 Security & Finance Logic Audit — 2026-11-18

## Scope and absolute constraints
- Baseline: Draft PR #47, branch `ui/steampunk-assistant-popup-hover-2026-11-18`, exact SHA `6606d81e9adb5375ccc6557aa90c3c6f51eb720e`.
- Changes only in `fix/finance-pr47-security-audit-2026-11-18`, targeting PR47 branch. Not `main`/Production.
- No database DDL/DML, no real transactions queried or modified, no Auth/RLS/keys/env changes. The only Supabase access during this review was read-only project/security/permissions metadata.
- "Zero risk" cannot honestly be established. No production release until full audit clears and end-to-end manual/security tests plus verified recoverable encrypted backup and approved schema migration exist.

## Confirmed issue 1 — UI branches escaped automated safety workflow
Existing `.github/workflows/finance-safety.yml` `push.branches` omitted `ui/**`; `pull_request.branches` was also narrowly whitelisted. PR #47 head was READY on Vercel but had no matching branch-triggered Actions runs.
**Fix:** add `ui/**` to the existing push branch whitelist, retaining all existing CI steps and strict HIGH/CRITICAL failure gates. The new fix branch is in the already-covered `fix/**` range and has successfully run all CI steps.

## Confirmed issue 2 — distinct FX transactions could reuse same pending record UUID
The preexisting `getRecordRequestId` signature used *only* MYR converted amount/type/category/method/note/date. Two different FX purchases that round to the same MYR amount could thus map to the same pending request UUID after an uncertain network response. On UNIQUE conflict, `addRecord` previously accepted any owner-scoped row matching that request UUID without checking original currency/amount/rate. This could incorrectly report that a different FX transaction was saved.
**Fix:** separately SHA-256 fingerprint the original FX intent (currency, canonical original amount, canonical rate, rate date, provider), retaining the unchanged MYR fingerprint. New MYR versus FX requests never share the same pending UUID; purely cosmetic decimal changes (e.g. 10.0 versus 10.00) preserve retry identity. Only hashes and an intent label are written to sessionStorage—never notes, amounts, currencies, rates or secrets. Older pending keys lacking an intent label reuse the old ID for recovery, not a second write.

## Confirmed issue 3 — server UNIQUE conflict recovery did not verify exact record content
Previously both `addRecord` and `addTransfer` recovered by UUID and checked only deleted_at before clearing the input form and announcing success. An earlier request whose row was edited could be acknowledged as the current requested transaction.
**Fix:** two pure read-only validators `assertRecoveredRecordMatchesPayload` and `assertRecoveredTransferMatchesPayload` check type/date/method/category/note/integer MYR cents and all relevant FX metadata as appropriate. Mismatch throws a clear error and keeps the draft for manual inspection; **no change to the DB insert/update/delete/sync/soft-delete logic**. App.jsx only changes the import and the two recovery branches.

## Security validation on Supabase Test (metadata only)
- `public` business tables have RLS enabled; inspected policies are owner-scoped (auth.uid() = user_id), including Activity links checking owner of linked Expense/Activity.
- `user_settings` has a legacy DELETE policy, but the authenticated role's table DELETE privilege is **false** on the TEST project. Records and transfers have no active DELETE RLS policy; their soft delete mechanisms remain preserved. Do not change privilege grants in this code-only audit.
- Prior advisor continues to show `auth_leaked_password_protection` WARN (Leaked Password Protection Disabled). It was not changed because Auth settings can affect login flows/users; evaluate separately with explicit approval.
- Source retains the exact TEST-only Supabase URL fail-closed guard; actual browser test-user A/B login, RLS penetration and network failure are **not** independently exercised.

## Test evidence and residual security blocker
- GitHub Actions `44286612247` at exact SHA `5830e365b49c3f047fc1cbc2d5f5ae249a3d1469`: 243/243 synthetic tests PASS (including new PR47 idempotency and conflict tests), Vite Build PASS, shipped runtime dependency audit PASS / zero advisories. Full npm supply-chain audit correctly **FAILS** with **12 HIGH, 0 CRITICAL** inherited from unpatched picomatch-related advisories. This is **NOT** a complete security clearance.
- Additional final docs/tests may produce a later SHA; rerun/recheck CI for final SHA before calling it accepted. Dist JS baseline PR47 must not be misrepresented as security-certified.
- Reference public root advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf. At the time of this review no verified compatible released patch exists; do not downgrade Vite to an older RCE-affected release or disable the audit.
- Supabase Auth existing warning reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Pending manual and deeper tests
- Windows/Android, user A/B account isolation, FX historical-rates API failure and formatting, CSV FX import source-row retries, concurrent bill paid status, Activity auto-tagging, transfer reconciliation partial commit recovery, soft delete/Undo/Restore, budget monthly snapshots, language switching and network loss are not established by source checks alone.
- If a pending legacy FX id maps to another historical row, the guarded recovery intentionally refuses to claim success; inspect Transaction Records rather than re-submit without checking.
- Source inspection suggests deleting an expense custom category also removes its default budget template key. Since changing that behavior has implications for the Savings Goal budget reserve and existing user preferences, no silent template migration or behavior change was made in this audit. Requires a separate focused design/regression test before modification.
- Full all-code mathematical proof of zero bugs/zero risks is not possible.

## Rollback and release
- Code baseline: PR #47 SHA `6606d81e`. Existing PR47 Preview remains untouched.
- Git revert restores code, never Supabase data; this audit performed no database writes.
- New test branch/PR remains Draft and must not be merged into main or promoted to Production without explicit separate user permission and other mandatory gates.
