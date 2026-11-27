# PR #71 · Stage 3 (P2) Finance Business Logic Edge Cases
2026-11-23 · Asia/Kuala_Lumpur

## Exact baseline and approvals
- Source of truth: current PR #70 head `203c19f25da0389584a241ac93e35ff0987c08fc`.
- Changes on an isolated TEST-only branch, Draft PR based on PR #70. No merging to main, Production deploy, schema migration, SQL writes, or production environment changes without separate explicit approval.
- Seven audit items in Stage 3: **#07, #09, #12, #13, #15, #16, #20**. No extra features or UI redesign.

## Repairs

### #07 — Monthly Excel summary
Already fixed correctly in Stage 2 / PR #70: `Actual ledger-estimated balance through export date` and `Selected-scope net cash movement through export date` remain distinct, retaining Opening Balance only for cumulative ledger. No duplicate formula changes were made here. Added an independent month-scope Excel round-trip regression to prevent the earlier misleading label and 100× RM/sen mistakes.

### #09 — Missing Claim advances/reimbursements from account reconciliation activity
- New pure `src/financeReconciliationActivity.js` safely combines ordinary Income/Expense, account Transfers, Claim cash advances, and received reimbursements using the authoritative `claimCashMovements` already computed on the Dashboard.
- Filters all events to actual dates <= MY today, supports user-defined account aliases with `canonicalFinanceMethod`, does not count Claim as personal Income or Expense, respects soft deletes/voids already filtered by canonical claims service, and keeps the previous 12 most recent display limit.
- Only presentation plumbing in `App.jsx`, `FinanceStage2Hub.jsx`, `FinanceAccountReconciliation.jsx`; existing reconciliation transfer proposal or DB writes are untouched. Chinese/English labels for the two Claim transaction kinds were added.

### #12 — Assistant forecast question priority
- `financeAssistantRules.js` now identifies forecast words and common variations **before** the generic balance / cash / account, actual Income and Expense responses.
- Preset questions and existing fallback behavior unchanged. Normal bank balances still use the existing account response; forecast remains read-only and Expected Income still does not become actual Income.

### #13 — FX CSV false duplicates
- `financeFxImport.js`: duplicate fingerprint for foreign records compares original FX currency and **normalized original amount**, plus date/type/category/method/note. Two different FX original amounts are not flagged as the same only because they round to identical RM cents; exact FX duplicates are still flagged. Non-FX (MYR) detection continues to use the previous fingerprint.
- Existing records with FX metadata are compared against FX rows via the same key. A true duplicate warning is still visible and can be manually reviewed; there is no auto import or overwriting and no change to underlying financial amounts/reference rate calculation or `importCsv` service.
- FX quote errors continue to invalidate affected preview rows; no background financial writes.

### #15 — Reserved category names
- `App.jsx` Dashboard group, spending map, today's top category, plus Assistant category totals use `Map`/safe own entries rather than unsafe `object[key]=...`.
- `financePlanning.js` month's category comparison uses a null-prototype internal dictionary, returning the original plain-object JSON contract unchanged; its inner category value remains **integer sen**, not accidentally converted a second time.
- `financeInsights.js` budget normalization uses `Map` then `Object.fromEntries`; preserves user keys `__proto__`, `constructor`, `toString` and correct amounts without prototype pollution or deleted categories. No DB data rewritten.

### #16 — 160 confirmation ceiling
- `financeStage2.validateBills`: old 160-history cutoff raised to bounded 5,000 confirmations **per bill**, plus 20,000 across all bills per user. All existing entries retained; no archive/truncation/migration/deletion.
- This enables long-term weekly history (roughly 96 years at 52 entries/year) without indefinite/unbounded Settings JSON growth. An extreme safety-cap breach refuses saving and explicitly reports it; future dedicated archival would require a separately reviewed data migration, and no unapproved migration was performed.
- `withBillOccurrence`, existing bill Expense idempotency, snooze/skip/paid behavior and account/cloud settings revision checks unchanged.

### #20 — FX date reverted mid-edit
- `FinanceFxRecordEditor.jsx` saves the **original, locked FX quote** in a ref when the record is opened. If the date and currency are changed then restored to their original values, the original quote is immediately restored and loading/error reset.
- Pending old exchange-rate fetches are AbortController-cancelled; edit-start version check from PR #69 remains intact. Never silently changes a saved historical rate or amount.

## Automated validation
- New `tests/finance-p2-regression-2026-11-23.test.mjs` runs nine targeted checks:
  1. Excel current ledger vs selected month cash, exact RM amounts and data immutability
  2. Reconciliation Claim advance/repayment activity, proper sign and no future/deleted entries
  3. Mixed forecast/balance/cash query priority and ordinary balances
  4. Reserved custom category names in Assistant and Dashboard structure
  5. Two different original USD amounts with SAME converted RM still count separately; exact and existing FX duplicates flagged
  6. 161 and 162 bill confirmations, identity preservation and no original mutation
  7. 5,000-cap no truncation
  8. Original locked FX quote restored on date revert, requests abort, P0 edit-start CAS retained
  9. Reserved custom categories in month comparison and budget JSON, respecting integer-sen internals
- Existing Stage 1/Stage 2 test suite remains intact. Full CI, Vite build and both dependency audits need to pass on **exact final SHA**, not merely an earlier intermediate commit.

## Manual acceptance still required — independent Test account and fake records
- Open FX Editor, change date to another day, wait for quote and then revert; original saved locked rate and amount appear and Save is enabled without network. Test slow/disconnected fetch and cancel. Avoid fake external rate assumptions.
- CSV preview with multiple FX originals (same rounded RM), different currencies, exact duplicates, same originals already imported, and separate MYR transaction. Only explicit reviewed confirmation inserts data.
- 160+/200+ recurring confirmations stay accessible on Test account across phone/PC refresh and cloud Settings synchronization; no old entries disappear, Recycle Bin and linked Expense unchanged.
- Reconciliation Recent Activity lists real Claim advance/reimbursement signs with same Method as Dashboard, no future events; proposals/actual transfers unchanged.
- Dashboard charts/monthly comparison/budgets with custom `__proto__`, `constructor`, `toString` and normal Chinese category names.
- Assistant preset and mixed intent questions, Chinese + English; every other finance/forecast result and P0/P1 remains consistent.
- Large histories and Android scroll/render performance; version conflict/realtime during writes; source-data cloud recovery.
- Real-world Android/Windows and cross-account Test DB end-to-end verification have **not yet** been performed by CI and cannot be represented as having passed.

## Rollback and safety
- Exact rollback is PR #70 head without changing SQL or database; closing Draft PR #71 preserves production. Git rollback by itself does not restore databases, but this patch has no database change.
- No changes to Supabase schema, Auth/RLS, Service Role keys, CR*D services, budgets save function, import service, record amount parsing or transfers.
- Preview must use independent Supabase Test config; never expose a Preview connected to Production.
- Prior to any Production merge: explicit approval, separate encrypted verified database backup+restore, full regression and manual mobile/Windows acceptance.
