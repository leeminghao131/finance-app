# Three features — Test Preview acceptance (2026-11-12)

**TEST ONLY. Never sign into a Preview with production credentials or real finance data.**
Preview must use the isolated `MH Finance Test` project and fictional data. This feature branch explicitly refuses Production Supabase URLs.

## 01. Monthly Financial Comparison
1. Sign into the isolated Preview with a test account.
2. Find **Monthly Financial Comparison** below the top balance row, **before the Dashboard Filters**.
3. Select October 2026 and November 2026 (or any two months in any year).
4. Verify Income, Expense, Net, absolute/percentage change, chart and Category comparison against the test records.
5. Change the Dashboard's Filtered month or keyword. Comparison values must remain unchanged.
6. Use Swap and verify the change signs reverse. Future or empty months should report zero, not fabricated transactions.

## 02. Quick Add (Top 7 category Notes)
1. Create fictional expense records in the same category with repeated Notes (e.g., Lunch 3 times, Coffee 2 times).
2. Choose a different Category and then choose the category with the saved test notes.
3. A floating Quick Add dialog must **open automatically** with at most 7 most frequent Notes.
4. Tap a Note on Android/Windows: only the unsaved **Note** input is filled. Amount, Type, Method, Date and existing records remain unchanged.
5. Close using X/Escape, or tap the small Quick Add button to reopen.
6. Newly added categories with no historical Notes must not show an empty modal.
7. Deleted/recycled records must not contribute suggestions. Another user's notes must not appear.

## 04. Savings Goals
1. Find the dedicated **Savings Goals** card near Monthly Financial Comparison.
2. New Goal: "Emergency Fund", Target RM5000.00, Saved RM250.50, Date 2027-01-31.
3. Verify progress ~5.01% and remaining RM4749.50. Save then refresh and sign in from another test device.
4. Edit saved to RM5000.00 and verify Completed; edit amount/date/name; try invalid amounts/duplicate rapid clicks.
5. Delete test goal, confirm only the goal disappears; actual Records, Transfers, Balance, Budget, Expected Income and Forecast remain unchanged.
6. With two devices, edit the same goal from stale data. A version conflict must reject stale writes and require review.
7. With two distinct test user accounts, verify data isolation. Never enter actual financial details.

## Safety and release
- Savings Goals are a separate manual plan; **not** a bank account, real asset or transfer.
- `user_settings.savings_goals` is new JSONB, DEFAULT `[]`, owner RLS as for existing settings and version-guarded writes.
- SQL additive migration applied **only** to isolated MH Finance Test. No Production schema changes.
- Manual acceptance, separate full encrypted/restorable Production backup + restore demonstration, migration approval and release approval are mandatory before main/Production.
- Git revert cannot restore deleted database values.
