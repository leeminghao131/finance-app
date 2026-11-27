# Phase 2: MH Finance App manual Preview acceptance (test data only)

**Branch:** feature/finance-transfer-budget-forecast-time-2026-11-08  
**Preview database:** isolated MH Finance Test (qrkaxxdwqgffhkalvtby)  
**Production:** not migrated, not merged, not released.  
**Cost:** no paid services added (RM0).

This Preview is hard-locked to the TEST Supabase project in src/supabaseClient.js.
Do not enter real personal transactions or reuse production passwords. Preview and
Production have separate Auth user tables. You may need to create a new test account.

## 06 — Transfer
- Create a fake BANK -> TNG RM100 transfer.
- Verify neither Total Income nor Total Expense changes.
- Click View All Transfers; search and filter by date/from/to.
- Edit transfer amount to RM150; verify it stays RM150, not RM1.50.
- Verify BANK decreases by an additional RM50 and TNG increases by RM50; combined balance remains unchanged.
- Delete the transfer. Its effect disappears from Method Balances, not total Income/Expense.
- Click Undo within 10 seconds. Delete once more; after 10 seconds open Transfer Recycle Bin and Restore. All original fields/ID must return.
- Repeat using two logged-in tabs/devices; conflicting edits must notify and never silently overwrite.

## 09 — Monthly Budget
- Select test month, set Food RM600 and Transport RM300; save the month.
- Add a fake RM420 Food spend, RM250 Transport spend, RM100 Medical spend.
- Expected: budget total RM900; spent on budgeted categories RM670; unbudgeted RM100; remaining RM230.
- Change main Transaction Filter to recent 3 days / all history; the month's budget must not change.
- Save another month's budget and revisit the first: its saved snapshot must remain the same.
- If an old month has no saved budget, UI must explicitly say "No historical budget saved", not invent a prior snapshot.
- Set a new default budget template; existing saved months must stay unchanged.
- Concurrent edits of the same saved month should reject a stale save.

## 08 — Forecast
- Check Ledger-estimated current balance includes all past months, not just the currently selected month.
- Set expense average window 7, 30, 60 days and observe differences.
- Add a future planned income (for example "Expected salary" RM2500).
- Verify forecast increases but Total Income and Transaction Records do NOT change.
- Switch Month-end / 30 / 90 day forecast, inspect actual (solid) versus forecast (dashed).
- View a completed month: it should show ACTUAL month-end, not projected future balance.
- Remove the planned income and check forecast reverses with no real-record mutation.

## 10 — Malaysia Time
- Check today's date and default transaction date agree with Malaysia UTC+8.
- Verify recent 3/7/30-day boundaries, end of February in leap years, month and year transitions.
- When leaving the browser open over local midnight, Today Summary and default new-entry dates refresh.
- Existing historical finance record dates must never shift due to timezone conversions.

## Exit conditions before production
- All GitHub Actions checks pass and Vercel Preview is READY.
- Staging signed-in RLS owner tests and soft-delete/revision checks passed.
- Owner tests mobile and desktop and approves the exact Preview.
- Complete and verify independent encrypted production backup.
- Separately review and explicitly approve the production database migration.
- Only after both backup and migration approval: release via protected main and retest.
- Never infer that rolling back Git alone restores a changed database.
