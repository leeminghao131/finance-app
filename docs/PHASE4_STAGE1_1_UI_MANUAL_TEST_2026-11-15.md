# MH Finance App — Stage 1.1 UI Revision — Manual Test Guide

**Stage 1.1 = first revision after Stage 1.** Future revisions of Stage 1 should be Stage 1.2, Stage 1.3, etc. New feature stages retain their own numbering. Stage 1.1 is based on Stage 1 Draft PR #32, not on Production.

**TEST PREVIEW ONLY**: Sign in only with independent MH Finance Test accounts containing fictional data. A visible TEST MODE banner and successfully verified complete cloud snapshot are required before any testing. No Production release or database migration is authorized.

## 04 — Budget Burn Rate interface and bilingual display
1. Dashboard > **Filtered Expense** > open existing **Monthly Budget** modal.
2. Confirm **Budget details / 预算明细** still supports existing saved budget values and saving. The second tab must be **消费速度预测** in Chinese mode and **Burn Rate Forecast** in English; no "English / 中文" mixed tab text.
3. Switch to Chinese and open forecast. Header, rate selector, status badges, every metric caption and explanatory note must be Chinese, except MYR amounts, dates and user-defined category names. Switch to English and confirm English interface.
4. The first row should show three compact overview values: at-risk category count, highest-risk category, sum of projected overspend (each category's positive overflow only).
5. Each category uses one title/status, a narrow progress bar, and a 2×2 grid: budget, spent, projected month-end and either possible overspend or daily remaining allowance. No old long stacked paragraphs.
6. Compare **本月平均** and **最近 7 天**. They may project different amounts but must use **the same previously verified Stage 1 calculation**. Check sample: on day 15 of 30, food spent RM450, budget RM600 -> month-average projected RM900 and over-budget RM300.
7. In a historical month, show actual spent not a future estimate. In future months, do not fabricate an estimate. Unbudgeted categories must be marked clearly.
8. Change the Dashboard Date Filter: monthly budget and prediction must still be based on the selected natural month, not the Dashboard Filter.
9. Do not alter or auto-save any unsaved monthly budget draft when switching prediction tabs.

## 18 — Understandable finance simulator
1. Hover the left edge dock on desktop, open the **财务模拟器** button. On Android tap the exposed arrow tab to expand, then tap the Simulator.
2. In Chinese mode, labels should explain: Step 1 period, Step 2 per-month earn more/spend less/spend extra, Step 3 "余额现在 / 照旧预计余额 / 按计划预计余额 / 两者差额".
3. Example for **6 months**: income extra RM300/month, spend less RM200/month, additional spending RM100/month -> difference from original pattern = **RM2,400** after six months. Balance shown is a linear projection, NOT a bank guarantee.
4. Use sliders AND numeric inputs and verify they stay in sync; toggle to English and check captions and chart legends.
5. Chart: gray = unchanged pattern, green = modified plan; horizontal axis counts months, vertical values MYR. Open the explanatory collapsible area to learn that the baseline comes from the past 90 days of valid records.
6. Reverse goal example: extra RM10,000 over 6 months -> needs an additional RM1,666.67/month. This is relative to the original pattern, not a real recorded Savings Goal.
7. Save up to three named simulation presets to this device; refresh and reopen, confirm they remain. Switch to a different Test account, confirm the other user's presets do not appear.
8. No Income, Expense, Transfer, Budgets, Forecast or Expected Income records may change after manipulating Simulator or saving local presets.

## 16 + 18 — Left slide-out dock
1. Desktop (Windows browser): open the Dashboard at normal zoom. New Finance Intelligence full-width toolbar must be **removed**; other cards retain their original order and dimensions.
2. On the left of the viewport, a narrow strip of the tool dock remains visible with a small arrow plus ✨ and 📈 markers. Hovering it must reveal two full button labels with smooth slide-out; moving away should collapse.
3. Click **Finance Wrapped**. Existing Monthly / Custom Quarter / Yearly options, story navigation, privacy toggle and PNG download must still function, and dialog must close normally via X, backdrop and Escape.
4. Click Simulator and check all forms, saved presets and graph remain usable; dialog must scroll on narrow screens.
5. Android browser: tapping the visible left arrow expands/collapses drawer; tapping a tool opens its popup. Tapping outside can collapse. There must be no forced reliance on hover.
6. Reduced-motion preference: the drawer must work without its slide animation.
7. Left drawer should not shift Dashboard cards, block amount entry, or intercept clicks on other areas when collapsed.

## Safety regression
- RM input 100 -> RM100.00; Cents Keypad 2455 -> RM24.55.
- Transfer of RM100 between Methods does not change total Balance.
- Recycle Bin, Undo, Opening Balance, Savings Goals, existing Month Comparison and Quick Notes remain unchanged.
- Budget/Expected Income are not rewritten by forecast; Simulator never writes financial data.
- Two-device user synchronization and account isolation remain as in Stage 1; test only with fictional data.

## Release and verification
- GitHub Actions tests, Vite build and dependency scan pass for the **final SHA**.
- Vercel Preview is READY with **target=null** and exact matching SHA.
- The scope is UI-only; **no Supabase schema or data changes** in this Stage 1.1 revision.
- Android and Windows real-device visual/touch/manual acceptance remain **pending** until performed by the user.
- Keep `main`, Production deployment, Production database and production environment credentials unchanged.
