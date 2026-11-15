# MH Finance App — Stage 2.1 Preview / Manual Acceptance Guide
Date: 2026-11-15 · Time zone: Asia/Kuala_Lumpur · Currency: MYR / RM.

**Stage 2.1** is the first revision of Stage 2. Its base is Stage 2 Draft PR #35, branch `feature/phase4-stage2-bills-review-reconciliation-2026-11-15`, SHA `c408c32a6be2f8791ca0f7c23355c740431f3588`.

## IMPORTANT — independent TEST environment only
Use **fictitious expenses, accounts, bills and a TEST login** in the existing isolated Supabase Test project `qrkaxxdwqgffhkalvtby`. Confirm the Preview displays the `🧪 TEST MODE` banner before continuing. Do **not** log in with a real/Production account or use real bank transactions. No main merge, Production deploy or Production DB migration is authorized. Stage 2.1 makes **no database schema changes**.

## 01 · Recurring Bills: one tap now CREATES one actual Expense
1. On a Test account, tap the upper-right 🔔 Alerts → Recurring Bills. Create a **fake** bill: *Test Internet*, RM89.90, Category 住房, Method BANK, monthly cycle, first due **2026-11-17**, 3-day advance notice. Save.
2. Open the corresponding bill occurrence when its alert is visible. The button is now **✓ 确认已付并自动记账**. There is **no** "select an existing Expense" picker and **no** need to manually fill an Expense and return to link it.
3. Check the displayed amount, Category, Method and due date. Only press Confirm if treating it as an already-paid *fictitious* bill. One confirmation immediately INSERTS a new Expense dated **the actual confirmation date in Malaysia** (not necessarily the scheduled due date), note = bill title, RM amount and saved payment method from the plan.
4. The bill occurrence should show **已付并记账 / Paid / recorded** and the single new Expense should appear in Transaction Records. Expense totals and the BANK Method ledger balance should change **once**, not twice. Money Transfer must not be created.
5. Close and reopen the bill popup; click on the same occurrence or refresh. The bill must remain Paid and must **not** add a second Expense.
6. If the network fails after the Expense saved but before the bill's paid-state synced, the UI must **explicitly say Expense was saved, status incomplete**. After loading the complete cloud snapshot, confirm the bill **again**. It must recover/link the *same* Expense using a stable cross-device `client_request_id`, never insert a duplicate.
7. If the saved Expense was moved to Recycle Bin, a repeated bill confirmation must **not** create another Expense. The app should direct you to inspect/restore the original record.
8. Confirm a second occurrence due in a different month. That legitimately creates a **separate** Expense, but retries within that occurrence cannot duplicate it.
9. Check that bill editing, lead reminders, snooze, skip one occurrence, calendar and recurring schedule still work.
10. For device-concurrency checks, use **two separate TEST devices**. Clicking Confirm for the same bill concurrently must never create two rows; the database enforces UNIQUE (user_id,client_request_id), with owner RLS.
11. **Important distinction:** this makes a real *bookkeeping* Expense entry; it does not transfer bank money or automatically pay the bill to the merchant.

## 03 · Four independent anomaly reminder switches
1. Open 🔔 → **异常记录复查 / Review Inbox**.
2. You should see 4 independent switches: **大额支出**, **疑似重复**, **缺少备注**, **未来日期**.
3. By default, older accounts without switch preferences retain all 4 enabled.
4. Create imaginary examples in TEST:
   - Expense RM600 → triggers 大额 if the default RM500 threshold is enabled.
   - Two Expense records with the same date/type/category/Method/amount → 疑似重复.
   - Expense with empty Note → 缺少备注.
   - Transaction dated next day → 未来日期.
5. Turn off **only 大额支出**. Large-expense reasons and associated notifications must disappear; the other 3 rules remain active.
6. Repeat for each of the other three switches. Turn **all 4 off**: Review Inbox should have no new anomaly notifications. Turn one back on: its matching cases return.
7. Refresh the Preview and, if possible, open on a second Windows/Android Test device with the **same account**: switches should persist via `user_settings.review_state.enabled`. Another TEST account must not inherit your preferences.
8. While a rule is disabled, existing confirmation fingerprints and actual financial transactions remain **unchanged**, and enabling again restores detection without batch edits.
9. Check individual record popup action **确认无误** and **修改对应记录** still works. Edits use the original protected `updateRecord` CAS/version guard.
10. Check threshold RM value remains independent of switches. Verify invalid toggle values fail validation in automated tests.

## 06 · Account Reconciliation integrated WITH Money Transfer
1. Go to the **existing Money Transfer card**. It now has two tabs: **🔁 资金转移** and **🏦 余额对账**. There is no separate account reconciliation popup anymore.
2. The default Transfer tab retains its original From Method / To Method / amount / date / note controls, Transfer History, Edit, Recycle Bin, Restore and Undo. BANK → TNG RM100 must reduce BANK and increase TNG by RM100, while overall Total Balance stays unchanged.
3. Switch to **余额对账** within that same card. All previous features must work: TNG / CASH / BANK / GRAB PAY / custom Method selection, computed ledger balances, actual-balance input, difference, history and recent transactions.
4. Example: if simulated BANK ledger is RM1,000, enter an actual balance of RM950.00. The difference must be **−RM50.00**. Save a fake reconciliation snapshot; refresh and verify its account-scoped history remains.
5. The **account discrepancy alert still exists** at the top right, but tapping it must scroll to Money Transfer and select the **余额对账** tab and correct Method, not open an independent popup.
6. Click "补记支出／收入表单". This still **only prefills an unsaved record form**, requiring a separate deliberate Save. A discrepancy may be due to a missing Transfer or another issue, so it must not auto-correct balances.
7. Switch back to 资金转移. Verify history and any in-progress transfer entry still appear correctly. Test both tab controls and alert navigation on desktop and Android touch screens.

## Regression and release boundaries
- Normal RM typing `100` → RM100.00; Cents Keypad `2455` → RM24.55.
- Cloud saving still validates current user, RLS isolation and versions. Under no circumstances should test code touch Production Supabase `hlkciowyusbhwcwjzfsr`.
- Check Budget snapshot by natural month; Savings Goals, Quick Notes, Finance Wrapped, Comparison, What-if Simulator, Opening Balance, CSV preview and Excel Export.
- Stage 2.1 reuses the existing TEST `user_settings` fields added in Stage 2: `recurring_bills`, `review_state`, `account_checks`. No new table/column/function migration.
- Recurring-bill confirmation inserts into TEST `records` **only on an explicit click**, using a stable per-occurrence UUID. The status write occurs separately under the existing settings version guard; a partial failure is surfaced and recoverable. There is no promise of a cross-table SQL atomic transaction.
- Automated tests and Vite Build should pass for the **same exact commit SHA** as the READY Vercel Preview (`target=null`).
- **NOT yet verified**: real Windows/Android manual acceptance, real Test user account login/actions, two-device conflict behaviour and independent two-account practical RLS testing.
- Production release requires independent encrypted recoverable full DB backup with tested restoration, financial regression, manual signoff, schema/security review, and separate explicit approval for main merge and Production deployment. Git rollback alone does not restore database rows.
