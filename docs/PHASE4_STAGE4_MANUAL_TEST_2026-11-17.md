# MH Finance App — Stage 4 complete TEST acceptance, 2026-11-17

Only isolated Supabase Test and fake transactions. No main merge, Production deployment, Production SQL, or Production credentials.

## Scope
20: Four-corner Transfer — BANK/TNG/CASH/GRAB PAY + user methods; mouse/touch drag and tap, original dropdown fallback; existing Save, History, Edit, Filter, Soft Delete, Undo, Recycle Bin and Restore unchanged.
21: Free, bilingual, rule-based, read-only finance assistant. Only fully synchronized owned financial records, no finance writes or paid API. Uses existing month budget, forecast, goal, Activity, bill and review logic.
22: Foreign currency transactions. Automatic dated Frankfurter reference rate; original ISO/amount/rate/effective date/source saved with MYR within one record; original FX edit with owner/version guard and no manual rates/bank settlement workflow; original income/expense amounts and transfer accounting remain MYR; CSV preview, Excel and soft delete support FX.

## Manual acceptance — use two independent FAKE Test accounts on Windows and Android

### Safety
- [ ] Confirm Preview shows TEST MODE, actual connection is isolated Supabase Test (never Production).
- [ ] Check a second signed-in user cannot access first user's records, FX data, drafts, Activity links or assistant queries.
- [ ] Check main and Production remain unchanged; no real financial data exposed.
- [ ] Confirm cloud sync on two devices, offline/online failure, stale version conflict and duplicate requests.

### Four-corner Transfer
- [ ] Mouse drag BANK to TNG; Android touch drag CASH to GRAB PAY; tap two corners; custom user-defined Method.
- [ ] Standard account dropdown remains usable. Invalid same source/dest rejected.
- [ ] Add fake RM100 transfer, confirm -RM100 source/+RM100 destination; total assets, Income and Expense unchanged.
- [ ] Transfer History filter/edit, amount RM100 → RM150, date/note, soft delete, 10s Undo and Recycle Bin Restore.
- [ ] Duplicate click/retry/version conflicts do not generate duplicate or silently overwrite a newer transfer.

### Foreign currency
- [ ] Normal RM input: 100 → RM100, 24.55 → RM24.55. Cents keypad: 2455 → RM24.55.
- [ ] Switch to JPY, USD, CNY, SGD and a provider currency beyond favorites. Enter original foreign amount.
- [ ] Check provider rate, quoted date, expected RM amount, rounding to sen, positive amount and proper decimal places.
- [ ] Test a past date, weekend, future date, unavailable quote, invalid currency and offline access; no silent fallback.
- [ ] Save, refresh and relogin: RM primary amount, original FX/rate/date/source still present, historically frozen.
- [ ] FX Edit updates original foreign amount + MYR atomically. Same date keeps frozen rate, new date/ISO gets new reference.
- [ ] Test malformed and stale edits, soft delete and restore, account switch and RLS, same real Expense not counted twice.
- [ ] Budget, category/method charts, Activity Wrapped, Forecast, Finance Wrapped, Balance and Account Check all use RM source.

### CSV and Excel
- [ ] Legacy six-header MYR CSV unchanged, with preview/duplicate and idempotent retry.
- [ ] FX CSV: Date,Type,Category,Method,Amount,Note,Currency,Foreign_Amount; foreign rows leave Amount blank.
- [ ] Reference FX fetched before import preview. Failed lookup marks invalid row; no save until explicit Confirm.
- [ ] Mixed FX/MYR file, repeated file, chunk failure and safe same-source retry, invalid data and duplicate warnings.
- [ ] Excel Finance Records and Recycle Bin preserve original FX currency, amount, rate/date/source and independent MYR totals.
- [ ] Confirm other sheets and export roundtrip; Excel not database recovery backup.

### Assistant
- [ ] Open bottom-right assistant; ask Income, Expense, Ledger Balance, Method Balance, Top Category, Budget, Bills, Review, Activity, Savings Goals, Forecast and FX help.
- [ ] Reconcile each amount against existing cards, and verify data not ready is explicitly blocked.
- [ ] Desktop/mobile keyboard and long answers scroll; assistant overlay doesn't reflow dashboard.
- [ ] Switch English/Chinese; assistant never alters data or sends private ledger records to an external AI service.

### Database and release gating
- [ ] TEST records FX fields nullable, consistent check, original owner RLS/version trigger and all old MYR rows intact.
- [ ] Independent Test FX CSV RPC is SECURITY INVOKER, anonymous EXECUTE denied and original CSV RPC untouched.
- [ ] GitHub Actions, tests, Vite build and audit on exact final head successful.
- [ ] Windows/Android, two Test accounts and devices owner manual approval still required.
- [ ] Production release blocked until independent encrypted full/restorable database backup, recovery drill, schema compatibility/RLS review and separate approvals for migration, main merge, Production deploy.

Reference rates are NOT bank settlement rates. Foreign cash wallet/currency-exchange-as-Transfer is a separate future feature, not part of Stage 4.