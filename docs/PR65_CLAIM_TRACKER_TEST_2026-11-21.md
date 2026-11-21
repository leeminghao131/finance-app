# MH Finance App — Claim Tracker (advance / reimbursement) — TEST ONLY

Date: 2026-11-21 MYT. Base: [PR #65](https://github.com/leeminghao131/finance-app/pull/65), exact SHA 71e0c040f7fb577c02aaf83c2fb81163785f29d8.

## Scope and accounting contract

- New Claim Tracker entry in left, long-press-sortable drawer. Modal styled in existing premium steam × cosmic language; responsive phone and Windows, accessible focus/reduced motion. No giant permanent Dashboard card.
- Owner-specific **claim cash ledger** (not finance.records Expense, Income, or transfers). On actual advance: cash decreases in original Method. On actual reimbursement: cash increases in receiving Method. Partial payments and cross-Method refunds supported.
- The main cash Balance, Method Balance, cumulative Balance Trend, Cash Flow Forecast and Savings Goals use actual cash movements. Income, Expense, budget, Category/Method expense charts, consumption trend and actual real-income sums do not.
- Existing normal RM and Cents Keypad behavior is **unchanged**. Claim forms deliberately use normal RM typing: 100 = RM100; 24.55 = RM24.55.
- Persistent right-bell **one notice per outstanding claim** until reimbursed completely; closing the bell is only dismissing the menu, not closing the claim. "Mark submitted" records that an HR request was submitted *outside this app*; this app does not send an HR claim form.
- Per-claim partial reimbursement date, amount, receiving Method, note; close only at RM0 outstanding. Completed/void/cancelled history stays available. Mistaken claim may be cancelled only if no active repayment; mistaken receipts are reversible using soft void with version guard.
- Existing Excel Export adds Claim Advances and Claim Reimbursements sheets, including void/cancel history, original amounts, receiving methods and timestamps. Export Summary includes net cash claim movement and outstanding, without reclassifying to personal income/expense.
- No paid API or background push notifications. Alerts occur **inside the app only** and remain when the app is next opened.

## Real cash example (TEST, fake entries only)

1. BANK opening RM1000; Claim "Company lunch", paid BANK RM100 on 2026-11-16: BANK RM900, Total Balance RM900, Expense RM0, Income RM0, outstanding RM100, 1 bell notice.
2. Mark submitted to employer: amounts unchanged, bell stays.
3. On 2026-11-19 receive RM60 in TNG: BANK RM900, TNG +RM60, Total Balance RM960, outstanding RM40; bell stays.
4. Later receive RM40 to BANK: Total Balance RM1000, outstanding RM0; bell notice disappears, history becomes Completed.
5. Void mistakenly entered RM40 receipt: cash back to RM960, outstanding RM40, bell notice reappears.
6. For never-reimbursed incorrect claims, Cancel restores the original advance cash but preserves an audit trail.

## Database — TEST ONLY

- Test project **qrkaxxdwqgffhkalvtby**, name MH Finance Test, independent from Production **hlkciowyusbhwcwjzfsr**.
- New tables: public.finance_claims / public.finance_claim_repayments. No ALTER to records, transfers, budgets or user_settings.
- Owner RLS policies for SELECT/INSERT/UPDATE, no DELETE grants/policy, no anon access, composite owner FK for repayments, unique (user_id, client_request_id) for idempotent retries, and version guards.
- Trigger serializes concurrent reimbursements by locking the parent claim, rejecting overpayment **in the database itself**. Rows are immutable for money/date/owner fields; soft void or cancellation preserves historical evidence.
- Test-only SQL: docs/database/test_only_claim_tracker_20261121.sql. Migration name mh_finance_claim_tracker_test_only_20261121. Must NEVER run it on Production without separate review, backup and explicit authorization.
- Full snapshot loader includes both claim tables with TWO complete, owner-filtered, count-verified read passes; errors hide every balance rather than silently leaving out claim liabilities.
- Realtime notifications for claim tables trigger the existing verified cloud reload; focus/online reconciliation remains.

## Tests

- Automated: tests/finance-claim-tracker-2026-11-21.test.mjs covers RM typing, partial/complete/void/cancel, account isolation rejection, overpayment, cash conservation, cash Forecast without personal spending, Excel roundtrip and UI/RLS invariants.
- Existing regression tests updated only where expected draw-table names, callback arguments, notifications or balance formulas legitimately changed. All other old assertions remain.
- GitHub Actions exact head plus Vite Build and both npm audits must be checked. A READY Vercel Preview is NOT manual acceptance.

### Owner acceptance on Android and Windows — pending

- [ ] In Preview confirm TEST MODE and isolated Supabase Test URL, NEVER use real financial records or Production login.
- [ ] Log in fake Test Account A. Add BANK RM100 advance with description/company/date; refresh and check cash -100 but Expense, budget, Category Ratio and Income unchanged.
- [ ] Confirm user-created Method such as 支付宝 appears as paid/receiving Method; actual Method Balance counts correct.
- [ ] "Mark submitted" changes only status; bell reminder persists; do not claim app emailed HR.
- [ ] Partial RM60 into TNG then RM40 into BANK, confirm each method and overall total, pending RM40 then zero; bell clears only when complete.
- [ ] Void a mistaken repayment, confirm outstanding and bell reappear; canceled incorrect claim remains in history and is excluded from current cash.
- [ ] Change phones/devices or refresh, check cloud persistence and that Account B cannot read/create/update Account A claims or reimbursements.
- [ ] Two Test devices try simultaneous partial refunds that would exceed remaining: one must fail; no negative outstanding, double-click or retry cannot create double reimbursement.
- [ ] Go offline during save, retry with SAME draft and request ID; refresh if result unknown, never quietly reinsert.
- [ ] Monthly/year/recent filters, balance trend, daily drilldown, Forecast, Savings Goals, Account Check and unchanged personal Income/Expense charts reconcile.
- [ ] Export All Excel and Selected Month; check two Claim sheets, canceled/void flags, Chinese, cents and summary; export never writes cloud data.
- [ ] Android touch target, close/Escape, drawer reorder, bell hover/tap, very long lists, vibration scope, reduce-motion and performance.

## Release gate

PR remains Draft on a new test branch. No main merge, Production deploy, Production SQL, Production env changes or real financial data writes. Owner Windows/Android manual acceptance, two-test-account RLS, full encrypted restorable Production backup and successful restore drill, production schema compatibility/security review, and **separate explicit approvals** for production migration, main merge and Vercel Production remain mandatory. Git rollback alone cannot restore database rows.
