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
- An encrypted application-data snapshot was verified; it is **not** a full native Postgres/Supabase backup.
- Backup has been decrypted in the independent project and contents validated, but complete data-restoration is **not** verified.
- Actual GitHub enforced main-branch protection must be configured and checked in GitHub Settings.
- Dependencies currently use `latest` and no lockfile was found. Freeze dependencies and commit a lockfile before claiming reproducible builds.
- The test suite is a **baseline smoke/regression check**, not comprehensive financial math or end-to-end coverage.
- No user data should be copied from production to the test environment.
