# Stage 1 P0 Finance Data-Safety Patch — 2026-11-23 (MYT)
Status: independent **Draft PR**, Preview/Test-only, no Production changes.

## Scope and source
Source of truth: current GitHub PR #68 head `3726e60211402097d726bbd3a91822b5fe7a8f7b`, not historical logs. User approved precisely four P0 cases: #02 Claim lost-reply duplication, #18 stale editor writes, #19 old-account async response pollution, #21 duplicate entries after delete/restore.

## Patch summary

### #02 Claim and repayment: stable retries, no new actual financial records in development
- New `src/financeClaimRequestId.js`: SHA-256 of validated, normalized **intent** (user account, operation kind, amount, method, date, claim ID/description/note as applicable) identifies a stable per-account local pending UUID. No amount, date, claimant name, note or other financial text is stored in browser storage; only SHA-256 fingerprint and random UUID.
- The same intent across browser refresh recovers the SAME request ID; service's existing server-side `client_request_id` uniqueness and read-after-commit recovery prevents a second INSERT. Once server confirms, remove ONLY matching cached request. If storage is unavailable/corrupt, fail closed rather than insert with an untracked ID.
- Optional Web Locks serialize simultaneous initialization from Chromium tabs; fallback validates read-after-write; without cross-tab locking on unsupported browsers absolute atomicity cannot be guaranteed without server-supported intent key (which is NOT authorized for migration in this phase).
- `FinanceClaimTracker.jsx`: blocks rapid double submission, freezes input while saving, scopes pending IDs and responses to original account, preserves pending ID after unclear responses. Existing claim summary and payment/cancel/void business logic untouched.
- Unlike `Expense`/`Income`, Claim continues to be a **separate** ledger impacting cash only; forecast and actual-record counts are unmodified.

### #18 Multi-device stale drafts cannot overwrite newer amounts
- `EditableCell` (desktop/Advanced) captures the visible value AND version when user clicks Edit, then sends version at Save.
- `FinanceMobileRecords`, `FinanceReviewInbox`, `FinanceTransferPanel`, `FinanceFxRecordEditor` preserve the edit-open version. FX no longer resets draft from Realtime version-only refresh.
- `updateRecord`, `updateTransfer`, `updateForeignRecord` reject locally stale versions and preserve PostgREST owner+version CAS queries; ambiguous writes do not bypass conflict validation.
- `financeMutationSafety.js` provides pure version comparison; no SQL schema or column changes.

### #19 Protect account identity during asynchronous operations
- All seven core existing edit/delete/restore transaction/transfer actions capture an initiating owner and verify the current auth identity before writing state after awaited SQL. A response from Account A never updates Account B's UI.
- Initial asynchronous `auth.getSession()` response cannot replace an already newer `onAuthStateChange` session; no change to sign-in mechanism.
- Claim UI asynchronous intent acquisition and success notification also recheck owner; never allow an old saved request ID to enter a newly signed-in account's form.
- RLS still enforces `user_id`; no production Auth, settings, credentials or permissions touched.

### #21 No duplicate restored or deleted rows even after Realtime race
- `upsertUniqueVersionedRow` deduplicates by ID, keeps the newest version; `replaceExistingVersionedRow` will not downgrade an updated row, nor revive a row removed from active state.
- `hasNewerVersion` rejects late REST replies if a newer Realtime version already appears in current active or recycle-bin snapshots.
- Restore/Delete retain original soft-delete `deleted_at`, version CAS, Undo, Recycle Bin, and account isolation. No `DELETE`, `DROP`, `TRUNCATE` or history amount change.

## Files
- Existing: `src/App.jsx`, `src/FinanceClaimTracker.jsx`, `src/FinanceAdvancedResults.jsx`, `src/FinanceMobileRecords.jsx`, `src/FinanceReviewInbox.jsx`, `src/FinanceTransferPanel.jsx`, `src/FinanceFxRecordEditor.jsx`.
- New: `src/financeClaimRequestId.js`, `src/financeMutationSafety.js`.
- Tests: focused `tests/finance-p0-data-safety-2026-11-23.test.mjs` plus six original test files updated to assert the NEW contract rather than outdated call syntax.
- No changes to `src/financeClaims.js`, `src/financeClaimService.js`, `src/financeInsights.js`, `src/financeCloudService.js`, `src/supabaseClient.js`, budgets/import/export/data calculation modules or SQL migrations.

## Testing and release gate
1. GitHub full `node --test` financial suite, Vite build and strict two-part `npm audit` on EXACT FINAL HEAD SHA; validate exact CI pass count in PR description.
2. New deterministic unit tests exercise refresh/retry, normalized fingerprint, changed payload and owner isolation, storage failure closed, Web Locks, version CAS, unique merge, newer Realtime reply and a simulated Claim network write that commits on mock server but loses its response (must make EXACTLY ONE INSERT upon retry).
3. Preview only: Vercel Ready does not mean visual/manual financial QA completed.
4. Manual QA still required (not claimed complete): two Test accounts, two devices, intentional network interruption while inserting Claim and reimbursement, concurrent editing, account switch mid-pending async, delete+Undo+Realtime, mobile and Windows browser; use **fictional transactions only**.
5. No main merge/production release without separate explicit user authorization and verified encrypted full database backup and restore plan. Git rollback changes code only, not database.

## Residual safety notes
- Client-only browser storage cannot provide a mathematically perfect distributed lock on browsers without Web Locks. Existing server `client_request_id` uniqueness handles the SAME ID. Independent intent keys remain distinct legitimate transactions by design. A database migration for deduplicating *semantically identical* payments would need separate owner review and permission; DO NOT silently add one.
- Existing multi-table snapshot reads are not an atomic DB transaction; that architectural issue (#22) is P1 and not part of this P0 patch.
- Code passes mocks/CI before any production release; real device behavior and production database are deliberately NOT touched.
