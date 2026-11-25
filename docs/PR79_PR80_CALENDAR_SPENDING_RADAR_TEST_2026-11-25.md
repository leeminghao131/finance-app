# MH Finance App — Financial Calendar + Spending Radar (2026-11-25)

## Release state and parent chain

- Production main unchanged: `7b4e2dc28cd64120e8a71a151ed84d06b6e8fd68`.
- Parent: Draft PR #78 HEAD `26cadbe8d8b9e99dd733effba0c912f90c50bb34`.
- Draft PR #79: `feature/pr78-heatmap-calendar-test-2026-11-25`, targets PR #78 branch. **Not merged**.
- Draft PR #80: `feature/pr79-spending-radar-test-2026-11-25`, targets PR #79 branch, therefore includes the integrated calendar. **Not merged**.
- TEST-only Vercel Preview. No production deploy or environment variable modification. This codebase contains a fail-closed sandbox-only Supabase URL guard.
- Split Bill deliberately **not** implemented; existing Claim Tracker business logic untouched.

## PR #79 — Financial Calendar × Spending Heatmap

- One existing homepage card, one seven-column heatmap/calendar, NO view-mode switch or extra persistent calendar card.
- Existing Expense-only heat intensity retained. Calendar-day colored markers add real Income, bank Transfers, Claim advances and reimbursements, pending Recurring Bills and Expected Income.
- Existing Year/All/Month/Recent heatmap scope/navigation preserved. Visible days only are computed/rendered; month weekday blanks align correctly.
- Daily floating popup now shows true Income, Expense, personal net, actual cash movement and separate Claim/Transfer vs scheduled sections.
- Money Transfers have zero global cash movement; scheduled bills and Expected Income never post as actual money. A bill already linked to an actual Expense is not shown as a second scheduled payment.
- Files: `src/App.jsx` (display-only Heatmap integration), `src/financeCalendarEvents.js`, `src/FinanceHeatmapDayDetails.jsx`, `src/financeHeatmapCalendar.css`; new pure regression tests and precisely updated older layout tests.

## PR #80 — Spending Pattern Discovery / Spending Radar

- Single new reorderable drawer entry next to Month Comparison, not a homepage card. Lazy React module.
- Six deterministic, explainable patterns: category change, weekday daily averages, number of transactions, single-large-purchase concentration, four complete months of increasing spend, median/MAD outlier.
- All analysis is performed in browser on validated owned Expense records. Income, Transfer, Claim, deleted or future-dated records are never treated as personal Expense.
- Supports baseline comparison of 3 or 6 previous months, analysis-kind and category filtering, top three findings or show-all.
- Each finding expands to calculation explanation plus associated Expense evidence, without opening a finance mutation editor or writing any data.
- Sparse data fails closed with a clear insufficient-sample state; no fabricated insights, auto-posting, AI, paid API or notification spam.
- Files: `src/FinanceInsightsDock.jsx`, `src/financeDockOrder.js`, `src/FinanceSpendingRadar.jsx`, `src/financeSpendingPatterns.js`, `src/financeSpendingRadar.css`, new tests and older drawer-count assertions adjusted from 10 to 11.

## Verification and gates

- PR #79 GitHub Actions: 424 / 424 synthetic tests passed, build passed, browser+dev dependency audits 0 vulnerabilities.
- PR #80 combined GitHub Actions on `29eda240c1880bfc5d938e968fbbd5d4bf7c4c5d`: 434 / 434 synthetic tests passed, build passed, dependency audits 0 vulnerabilities.
- PR #80 READY Preview of combined features: https://finance-es5wn03uy-leeminghao131s-projects.vercel.app
- Both PRs remain Draft. No merge, no Production deployment, no live Supabase data or schema change.

## Manual acceptance still required

1. Open the **PR #80 combined Preview** with a fictitious account in the isolated Supabase Test environment (not the real production account).
2. On Windows, check Heatmap month/year/all navigation, dates and spacing; click expense days, Claim days, actual Transfer days and future Expected Income/Recurring Bill days. Planned values must never change real cash.
3. On Android, check 7-column cells, visible colored markers, tap targets, smooth scroll, date popup close, no clipping/overlap, Chinese/English display.
4. Open left drawer -> Spending Radar. Try 3/6 months, category filtering and all six analysis categories; open evidence. Check samples are clearly identified as saved records, not implied missing transactions.
5. In Supabase TEST only, use two fictitious accounts and verify each account's events and patterns remain scoped to that user. Verify failed cloud reads do not display incomplete totals. Review low sample, zero history, very large transaction counts and date boundaries.
6. Cross-check a few sums with Transaction Records, Claim Tracker, Forecast and the original Heatmap on both devices. No test can claim complete real-device acceptance until the owner performs it.

## Production release prohibition

Any future Production release needs explicit, separate authorization for merge and deploy, independent encrypted recoverable database backup, validated restore method, regression acceptance, and review of any migration (none in these PRs). Git rollback does NOT recover database records.
