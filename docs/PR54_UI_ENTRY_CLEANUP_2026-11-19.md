# MH Finance App · Add Record UI Cleanup · 2026-11-19

## Starting point and safety
- Base: Draft PR #54, exact commit `89ff13eadb9a56f6f6c78ebcb23b76eb4a2c4e21`.
- Changes isolated to `ui/pr54-activity-category-currency-2026-11-19` (new Draft PR; Vercel Preview only).
- Absolutely no Supabase SQL, table schema, Auth, RLS, record/transfer/budget/goal/fx data write logic, token, configuration or Production/main changes.
- Never use production or personal financial records in Preview; only the independent test Supabase database with invented transactions.

## Three user screenshot requests

1. **Active trip / activity banner:** the yellow `🎒 Active Activity · New Expenses auto-tagged` read-only paragraph is now a real accessible dialog-trigger button with the existing lightweight hover vibration (honors reduced motion) and a mobile touch target. It opens the **original and only** `FinanceActivityPanel` floating dialog, via explicit App -> FinanceInsightsDock -> FinanceActivityPanel open request. Original Pause / Resume / Finish / Edit and all Activity cloud callbacks stay unchanged. No silent pause or activity status mutation from the launcher itself.
2. **Remove category quick-chip row:** delete only the extra duplicate `mh-entry-category-chips` row, its responsive CSS blocks and grid area. Keep original category select, custom Add/Delete category operations, record category value and independent quick-note chips.
3. **One-step FX selection:** replace redundant outer transaction-currency toggle plus inner dropdown with one always-visible native select on the same first row as the calculator. Selecting a foreign currency directly reveals the existing Foreign Amount, dated reference exchange rate and MYR ledger equivalent in the same component. The currency remains saved per account/device from PR #54; on switch, existing amount/quote clearing and reference-date validation are unchanged. MYR defaults display compactly, without a second card/dropdown click.

## Actual source files
- `src/App.jsx`: UI markup and one activity-dialog request state only.
- `src/FinanceActivityPanel.jsx`: accepts external open request; opener-focus return; no status/cloud logic changes.
- `src/FinanceInsightsDock.jsx`: forwards external Activity Mode trigger.
- `src/FinanceCurrencyInput.jsx`: supports compact direct native select; keeps one FX component instance and unchanged effects.
- `src/financeUi.css`: removes duplicate quick-category layout and styles direct FX select without changing other card colors/behaviors.
- `tests/finance-compact-entry-sticky-ui.test.mjs`: updates old now-obsolete UI expectations and retains protected underlying functionality tests.
- `tests/finance-entry-ui-three-requests-2026-11-19.test.mjs`: explicit new regression checks for all three screenshots.

## Verified and unverified
- GitHub Actions on commit `472e548afc53cd915274c38dd67910e46a1fc209`, run `44454999936`: 280 / 280 synthetic + structural tests PASSED; Vite build PASSED; shipped browser dependency audit 0 and full dependency audit 0 HIGH/CRITICAL reported **at this run**.
- Preview `finance-rmfcoga8s-leeminghao131s-projects.vercel.app` was READY at commit `472e548a` before adding this audit document. Final Commit, Actions and Preview must be rechecked to match exactly.
- Manual Chrome/Windows and Android UI, touch currency selection, external modal focus and Activity pause/resume are **pending human acceptance**. No claim of zero bugs or unconditional safety.
- Roll back TEST code to PR #54 `89ff13ead...` if rejected. Git code rollback never restores database.
- Do not merge `main` or promote Production without separate explicit authorization, verified independent encrypted/restorable Production backup, regression and manual acceptance.

## Visual acceptance
- Activity banner is visibly actionable; hover subtly vibrates on mouse, tap opens existing floating Activity Mode with Pause; hovering or tapping does not auto-change activity status.
- Category selection takes one row only. User's custom categories can still be selected/created/deleted as before; Note quick buttons remain.
- One currency selector instantly exposes its supported currencies. MYR keeps usual RM/cents amount input. Foreign currency keeps original amount/rate/ledger equivalence and original finance FX validation and persistent per-account choice.
