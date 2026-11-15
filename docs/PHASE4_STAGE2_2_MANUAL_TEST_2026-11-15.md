# MH Finance App · Stage 2.2 (2026-11-15) · Manual Acceptance

**Base:** Stage 2.1 independent Preview branch `feature/phase4-stage2-1-bill-pay-review-toggles-transfer-reconcile-2026-11-15`. This is a TEST-only UI/logic revision; no main merge, Production deployment or Production/TEST database migration.

## Before starting
- Use **only isolated Supabase Test** `qrkaxxdwqgffhkalvtby` and entirely fictional amounts and transactions. Confirm the **🧪 TEST MODE** banner; stop immediately if it is absent.
- The current release is automatic-test/Preview verified; it has **NOT** been accepted on an actual Android phone or Windows desktop by the user, or on two real devices at once.
- NEVER test with Production records or real bank account credentials.

## 01 · Legacy Chinese Method bill payment repair
1. Open 🔔 → 固定账单提醒. Check the existing fictional bill shown as **住房 RM275.00** and **Method「银行账户」**.
2. Click ✓ 确认已付并自动记账. It must no longer reject the translated Method as unavailable. In the TEST Expense list there should be **exactly one** RM275.00 Expense with the saved Category and canonical **BANK** Method.
3. Refresh the Preview, reopen the same bill. It must remain **已付并记账**, and must **NOT** create a second Expense. Any previously saved bill plan must remain intact.
4. Edit a TEST bill, choose BANK from the Method dropdown in Chinese mode, save, and reopen. Toggle to English; the stored Method key must remain **BANK**, not a translated label.
5. Test TNG 电子钱包, 现金 and GrabPay as well. They must be saved to their original respective keys TNG, CASH and GRAB PAY. A truly deleted custom Method must still show an error rather than silently falling back to the wrong account.

## 06 · All-Method Balance Reconciliation inside Money Transfer
1. Scroll to Money Transfer and select **🏦 余额对账**. TNG, CASH, BANK, GRAB PAY (and any custom Methods) should be shown as **full-width individual rows**. Names and RM balances must not be truncated.
2. All rows have independently editable **actual balance (RM)** inputs. Fill every Method; an empty field is **not** assumed to be RM0.
3. For a sample where TNG ledger=RM1,000 and BANK ledger=RM1,000, enter TNG actual=RM1,150 (**+150**) and BANK actual=RM880 (**−120**). Keep other Method actual balances equal to their ledgers.
4. The app should propose **BANK → TNG RM120** and show remaining **TNG surplus RM30**. **Reason:** `actual − ledger` positive means the account is missing a recorded inflow; negative means it is missing an outflow. Recording **TNG → BANK** would increase the discrepancies, not reduce them.
5. **Do not press Execute unless this transfer actually occurred and was omitted from the ledger.** If it did, click **✓ 核对并执行建议转账**, read the complete preview and approve the confirmation. One Transfer is saved. The BANK ledger must decrease RM120; TNG increases RM120; **overall Balance stays unchanged**.
6. The remaining RM30 must be presented as an **unexplained surplus** with an optional **填入收入** action. This only fills an **unsaved** Income form and must never auto-add Income. Investigate possible opening-balance errors or missing transactions first.
7. Try a reverse example with a total RM30 shortfall. The app must suggest **only** a possible missing Expense and provide an optional **unsaved** Expense form. It must never auto-create an Expense from reconciliation.
8. Test several methods with multiple matched transfers. One confirmation may execute several sequentially. If a network or cloud conflict interrupts the batch, it must **stop**, show the number already saved, leave those saved transfers intact and reload verified cloud data; it must never claim an all-or-nothing database transaction.
9. Test repeated confirmation, lost HTTP acknowledgement and two-device concurrency with **fake records only**. Per-step `client_request_id` is deterministic; the TEST database already has a unique index per user/request. A repeated step may not create two transfers.
10. Press **保存全部余额核对记录**. All current Method ledger/actual snapshots should be saved to per-account `account_checks` with version protection. Another user's account must not see them.
11. Confirm original Money Transfer form, history, edit, undo, restore and recycle bin are unchanged. Balance checks are still a tab within the same card.
12. Windows narrow layout, Android browser zoom and scroll: every Method, value, input and button should remain readable without horizontal scrolling.

## Safety and regression
- Regular RM input `100` must still be RM100.00, cents mode `2455` must still be RM24.55.
- A BANK → TNG RM120 transfer changes only Method balances, not total assets or total Income/Expense.
- Original Income/Expense CRUD, Budget, Expected Income, soft delete/Restore, CSV Import and Excel Export are unchanged.
- **Never auto-create Income/Expense** as a reconciliation adjustment. User must investigate and manually confirm the cause before saving a filled form.
- No test database schema or records have been wiped/rewritten; no Production services or environment variables changed.
- Final SHA must match both successful GitHub CI and READY Vercel Preview (target=null). Manual Windows, Android and dual-device/account verification remain **PENDING**.

## Risk / recovery
- Auto reconciliation uses **multiple separately idempotent Transfer INSERTs**, not an atomic PostgreSQL batch. If the second step fails after the first is saved, the successful first Transfer remains and must not be undone or reinserted without user confirmation. The app stops and reloads verified records.
- For a future Production release, require the user's separate explicit authorization, an independent encrypted/restorable database backup with tested restoration, full money calculation regression and real-device signoff. A Git rollback does not restore database data.
