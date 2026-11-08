# MH Finance App — Safety and release policy

This repository contains the web app for a real finance database. **No feature change should be merged or released until these safety gates are met.**

## Non-negotiable constraints
- Additional cost: **RM0**. Do not turn on billable services or upgrades.
- Preserve the existing production Vercel project, domain, Supabase project and user accounts.
- Work on a non-main branch; use a pull request to review changes.
- Production database is never used as a testing sandbox.
- Do not store financial records, passwords, bearer tokens, Supabase secret/service-role keys or database backup keys in GitHub.
- Do not deploy, modify production database schema or merge without user approval.

## Required checks for every PR
1. Verify that Vercel Preview points ONLY to the independent **MH Finance Test** Supabase project.
2. Run Node safety regressions and a Vite production build. Investigate failures before merge.
3. Review code diff for unexpected bulk updates/deletes, schema changes, and credential leakage.
4. Snapshot and validate production business data immediately before significant database-related changes.
5. Validate on synthetic data in test environment: auth, income, expense, transfer, budget and per-method balances.
6. Record production row counts and financial checksums before and after release.
7. Confirm that old records and the sign-in session still work.
8. Maintain a documented rollback plan for code AND a separately tested data restoration plan.

## Environment isolation
- PRODUCTION: original Supabase project `hlkciowyusbhwcwjzfsr`.
- PREVIEW: separate Supabase project `qrkaxxdwqgffhkalvtby`.
- Vercel env keys `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are separately scoped.
- **Old Vercel preview deployments are not automatically reconfigured**. Never perform destructive tests on old previews.

## Status / limitations (2026-11-08)
- Direct npm dependencies are pinned, `package-lock.json` is committed, and GitHub Actions runs `npm ci` + Node 24 regression tests + Vite build; observed successful run. This PR is still DRAFT and not merged.
- Production and Preview now use different Supabase project references via environment-targeted variables. Old Preview deployment bundles do not change retroactively; never use old preview URLs for destructive tests.
- The encrypted business-data snapshot was validated against production for exact equality across all three app tables. An independent-project decrypt/hash check passed.
- A synthetic create/snapshot/delete/restore/compare test succeeded inside a rolled-back transaction in the isolated test project. This demonstrates app-table round-trip, not full Auth/Storage/project disaster recovery.
- The Free plan **does not provide automatic daily database backups**. Before risky changes obtain a fresh independently stored encrypted full database backup using official CLI, and verify restoration in isolation. The repo includes `docs/WINDOWS_FREE_BACKUP.md` for the Windows owner; this local backup is not yet completed.
- GitHub main-branch protection and required status check enforcement must still be configured in repository settings. Suggested check: **Finance safety / locked build**. Never merge before confirming enforcement.
- Dependabot monthly PR configuration is staged here and only becomes active once merged to the default branch. No auto-merge.
- The safety branch now uses the fixed **SheetJS Community Edition `xlsx@0.20.3`** from the official SheetJS CDN. A synthetic Excel workbook roundtrip and existing finance regression tests pass; npm audit reports 0 production dependency advisories in the latest tested CI run. This is **not** yet live in production until PR #1 is explicitly approved and merged.
- Supabase's leaked-password-protection advisor warning cannot be eliminated on the Free plan; it requires Pro. **Do not upgrade to paid plan.** Use strong passwords, MFA where available, and free password-strength rules.
- This is still a baseline regression suite, not full browser-driven end-to-end coverage or guarantees against every type of data corruption.
- Never copy real financial data to CI, GitHub, or Preview.
