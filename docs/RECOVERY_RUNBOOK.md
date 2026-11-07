# MH Finance App — recovery runbook (RM0)

## Scope
Production: original Supabase project (do not reset, delete or replace); Vercel domain stays unchanged.
Test: independent `MH Finance Test` project. Never import real customer/personal finance data into a public repository or production website preview.
Do not proceed with a destructive production fix before a reviewed backup and isolated rehearsal.

## Backup strategy
- Before **every release that can affect data**, capture a fresh snapshot and retain the previous known-good snapshot.
- For Free-plan projects there are **no automatic daily backups**. For a full Postgres dump use the official [Supabase CLI db dump guide](https://supabase.com/docs/reference/cli/supabase-db-dump) on the owner's trusted computer, with credentials entered locally (never into chat or GitHub). Ask the CLI for current usage with `supabase db dump --help`.
- Preserve schema, tables, owner relationships and database settings. If full Auth/Storage or binary Storage is used, plan separate coverage: a business-table JSON snapshot is not a complete Supabase-project backup.
- Encrypt backup copies; store the decryption key separately in a password manager or safe offline location. Do not put keys, dumps, or private data in GitHub, CI logs, Vercel preview or issues.
- The pre-existing encrypted business-data snapshot has been verified and decrypts, but it is **not** a substitute for an independently verified full PostgreSQL dump.
- Confirm backup file readability and integrity (e.g. SHA-256), and record capture date, row counts, and per-user sums.

## If records go missing / values look wrong
1. Stop adding/editing/deleting data in the website; preserve the current state for investigation. Do not delete the Supabase project, refresh RLS indiscriminately, reset auth, or run TRUNCATE/DROP.
2. Identify the last known-good Git commit and the Vercel production deployment. If **only the front-end code is wrong**, roll back the site in Vercel; this does NOT restore deleted database rows.
3. Compare the current database with the last good encrypted snapshot **by primary key, owner, date, amount, and note**. Keep the original backup untouched.
4. Rehearse the intended repair in the isolated database using **synthetic data**. For real data recovery, use a private controlled recovery environment with tightly restricted access; do not make test data public.
5. Prepare targeted, transactional SQL to recover only affected rows. Preserve IDs, user ownership, and original timestamps. Do not blindly overwrite an entire live database or discard legitimate new records.
6. Review the diff and affected row count, obtain approval, apply the repair, then verify all totals and logins. If uncertain, stop instead of guessing.

## Required pre/post deployment gate
- Confirm the exact Git commit, `main` branch ruleset, passing `Finance safety / locked build` check, and Vercel Preview's separate Supabase endpoint.
- Verify a fresh off-site backup and a tested recovery path.
- Track by-user record counts, income/expense sums, transfers and method balances; compare before/after.
- Smoke test login, session persistence, income, expense, transfer, budgets, Excel export and mobile layout on Preview with *synthetic* data.
- Production deployment requires owner's explicit approval.
- If an issue occurs, freeze writes, preserve evidence, roll back code when appropriate, and restore data separately.
