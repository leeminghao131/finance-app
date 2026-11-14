# MH Finance App · Phase 4 Stage 2 — Manual Acceptance / 2026-11-15

**Base:** Stage 1.2 Preview commit `115641fb9014df4a2ff474b3522514ed6bbb9f17`.
**Scope:** Stage 2 = **01 fixed/recurring bills**, **03 anomaly review**, **06 manual account reconciliation**, all using an animated top-right in-app notification center.

## Safety first
- Log in only to **isolated MH Finance Test** with fictional records and fake bills. Confirm **TEST MODE / 测试环境** and a fully verified cloud snapshot.
- Production, main, real data and real credentials are **off limits**. No automatic charge, record creation, transfer, opening-balance update, budgeting write or expected-income write occurs in Stage 2.
- Changing the TEST user account must not reveal another account's bills, review decisions or reconciliation history.
- If any screen shows real Production data, missing test-mode banner, cloud verification failure, a nonzero unexpected balance change or cross-account data, STOP and send a screenshot.

## 01｜固定账单提醒 (Recurring Bills)
1. Open top-right **🔔 提醒** menu and select **固定账单**. Click **＋新增账单**.
2. Create fictional Internet plan: amount **RM89.90**, Category 住房, Method BANK, cycle monthly, first due date **2026-11-17**, remind 3 days earlier. Save. Refresh; plan should remain in Test cloud.
3. Confirm a new top-right **animated jumping** bill notice appears when the date is within the lead interval. Click its notice; it should open the relevant bill in a popup.
4. Inside the bill center expand **🗓️ 查看账单日历**, choose November and December, inspect due day markers, and select a marked day to see bill title/amount.
5. Test cycles **weekly, monthly, quarterly, yearly** and a monthly anchor on Jan 31 (Feb must clamp to Feb 28 or 29; dates must be valid).
6. Click **明天再提醒**: this particular occurrence hides until the next day; click **跳过本期**: it no longer appears, but following periods remain.
7. Click **填入支出表单**: the popup should close, scroll to the **unsaved** Add Expense form (normal RM mode) and fill the chosen amount/category/method/note. The Balance must **not** change until you deliberately submit.
8. Manually save one fictional Expense after checking the fields. Return to the bill center, choose **确认已付／关联支出**, select that existing Expense, and confirm. This should mark only that bill occurrence paid and must **not insert another Expense**.
9. Soft-delete the test Expense and revisit the bill. Because its linked payment is gone, the bill should prompt review again, not falsely claim a valid payment.
10. Edit a bill's date/amount/category, refresh and verify cloud persistence. Delete only the fictional bill plan: should not delete any Expense.
11. On a second TEST device check same account sync; two simultaneous edits must fail safely with a settings version conflict, not silently overwrite each other.

## 03｜异常记录通知 + 小浮窗确认/修改
1. In Test account create several fictional Expenses: one **RM500.01** (default large threshold RM500), two otherwise identical expenses (same type,date,amount,category,Method), one Expense with blank Note, and one future-dated record. Use artificial dates in the last 180 days for review testing.
2. A top-right bouncing **交易待确认** notice should appear. If there are many bills, the first three shown notices should still include a review type; open **🔔** menu to see total review count.
3. Click one specific anomaly toast, which should open a small floating window for **that record** and display the applicable reasons: large, duplicate, missing Note or future-dated.
4. Click **确认无误** and refresh. For the same unchanged version it must not repeat an alert; the Review Inbox can still display reviewed records when **只看待确认** is unchecked.
5. Open **修改对应记录**, select one editable field (Note, Amount, Date, Category or Method), and save. Verify real record changes through existing version-checked transaction editing, without modifying other fields. If the anomaly no longer applies, it should disappear; if still anomalous, it must require review again.
6. Use two devices to edit the same fictional record; a stale edit must be rejected, not overwrite newer data.
7. Adjust the large-expense threshold (e.g. RM600) and refresh; the threshold and decisions must persist per account.
8. Confirm deleted records are not flagged. Review Inbox must not silently auto-delete, auto-correct or insert finance transactions.
9. Language switch from Chinese to English and back: reason labels and action buttons should switch display language while user Note/Category keys remain unchanged.

## 06｜账户余额对账
1. Top-right **🔔 提醒** → **账户对账**. Check buttons for **TNG, CASH, BANK, GRAB PAY** plus any custom Method.
2. Select BANK; the calculated balance should match the Bank value in the existing Methods breakdown. Transfers affect Method balances, but do not count as Income/Expense.
3. Type a fictional actual balance **RM50 lower** than the ledger balance (negative amounts are allowed for overdraft). The displayed **实际 − 账本** difference must be **−RM50.00**.
4. Add a note and click **保存本次核对**. Refresh: account-check history must retain date, ledger/actual snapshot and exact difference. Real opening balance and transactions must **not change**.
5. When a nonzero mismatch is stored, the top-right **账户有差额** notification can appear.
6. Click **补记支出表单** or **补记收入表单** only after verifying the cause: a confirmation should appear, the popup should close and the unsaved record form should be filled with RM amount and Method. No balance changes until an intentional manual Save.
7. Inspect recent Method-specific Income, Expense and Transfers. Confirm each Transfer is correctly signed as inflow or outflow; soft-deleted rows must not appear.
8. On a different Test account, account reconciliation history must be isolated. If another device changes this history first, the stale write must be rejected.

## Mandatory regression checks
- Normal RM input 100 -> RM100.00; Cents 2455 -> RM24.55.
- Money Transfer BANK -> TNG RM100: BANK −100, TNG +100, Total Balance unchanged.
- Opening Balance unchanged by Stage2 notices and checks.
- Existing Financial Simulator, Budget Burn Rate, Advanced Search, Finance Wrapped, Monthly Comparison, Savings Goals, Quick Add remain.
- Undo, Recycle Bin Restore, CSV Preview + confirmed import, Excel Export, user-separated language switch still work.
- Android: toast buttons can be tapped, nested popups scroll and close via X and Escape where supported. Windows: toasts jump smoothly; honors reduced-motion accessibility preference.
- No extra paid service or browser push permission is required. Reminders are in-app on Dashboard opening/focus, not a background phone push service.

## Technical state / release requirements
- Only independent Supabase Test project `qrkaxxdwqgffhkalvtby` was migrated, adding non-destructive JSONB fields `recurring_bills`, `review_state`, `account_checks` to existing owner-RLS `user_settings`.
- The new fields use existing version-checked single-field CAS; none create or modify underlying finance records automatically.
- A Git commit rollback does not remove any database field; the additive Test schema should be retained pending inspection.
- The code branch remains isolated from `main`. No Production deploy, Production DB migration or Production environment edit is authorized.
- Windows/Android/two-device/two-user interactive acceptance is **PENDING** until actually performed. Exact final SHA CI + Preview READY are necessary, but not substitutes for manual acceptance.
- Before any future release: independently encrypted full Production backup, restore verification, security and schema review, regression test and user's separate explicit permissions.
