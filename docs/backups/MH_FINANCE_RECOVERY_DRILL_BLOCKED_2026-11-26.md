# MH Finance App — Production Backup Recovery Drill Status (2026-11-26)

**Status: BLOCKED / DO NOT RELEASE.** This file is a factual audit, not evidence of a completed restore.

## What was independently verified
- Real Production backup workflow run **45831886534** completed successfully. The AES-256-encrypted GitHub artifact was uploaded as `mh-finance-prod-aes256-encrypted-backup`. User reported downloading and safeguarding the artifact.
- The **same saved artifact** was downloaded and decrypted multiple times in isolated GitHub Actions restore rehearsals. Each successful decrypt stage independently verified the internal SHA-256 manifest of `roles.sql`, `schema.sql`, and `data.sql`.
- An **isolated local PostgreSQL 17** instance initialized inside a temporary GitHub runner. Neither the real Production Supabase nor the separate shared TEST project was used as a restore target.
- Production GitHub `main` remained at `7b4e2dc28cd64120e8a71a151ed84d06b6e8fd68` during the audit, with no Production deployment or schema migration.

## What is still NOT verified
- Import of all `roles.sql`, `schema.sql`, `data.sql` **into a new empty database** has NOT passed.
- Local restore stopped while loading **roles.sql**, PostgreSQL **SQLSTATE 42501** (insufficient privilege). Only safe SQL error codes and stages were exposed; raw SQL / user records remained private.
- The documented CLI-login-role grant exception did not lead to a completed restore. No unverified broad grant removal should be used to make the checks appear green.
- Auth user restoration, transaction counts, RLS, ownership isolation, settings, and post-restore sign-in remain **NOT VERIFIED**.
- Decryption/integrity checks do not equal proof of database recoverability. Similarly, Git commit rollback is not a database rollback.

## Evidence
- [Original full encrypted backup workflow / artifact](https://github.com/leeminghao131/finance-app/actions/runs/45831886534)
- [Latest isolated recovery rehearsal — still failed](https://github.com/leeminghao131/finance-app/actions/runs/45836548652)
- [Draft backup safety PR #84](https://github.com/leeminghao131/finance-app/pull/84)
- [Official Supabase backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Next required technical work
1. Privately map the specific `roles.sql` statement and local Postgres role privileges producing SQLSTATE 42501 without logging credentials or private user rows in the public repository.
2. Build a **minimal, documented and isolated** recovery compatibility procedure. Never rewrite the original encrypted archive.
3. Restore `roles.sql`, `schema.sql` and `data.sql` transactionally into a new disposable database; verify accounts, 687 records, 58 transfers, 2 settings rows and per-user RLS before accepting. These were backup-time reference counts, not guaranteed to reflect subsequent new Production activity.
4. Only after passing the restore gate, rehearse additive version-compatible PR82 migrations against an **independent synthetic-data** TEST clone, prepare production-only client with strict preview/production secret isolation, run exact-SHA CI, and conduct Windows/Android two-user manual QA.
5. Any Production schema migration, credential change, merge to `main` and Production deployment require independent review and explicit approval. NO Production work is authorized by this report.

## Safety invariants
- Keep current Production website, Supabase project, accounts, and existing data unchanged.
- Never publish plaintext backups or passwords in public Github logs, repository files or comments.
- Preserve the downloaded encrypted artifact and the separately stored passphrase until an independently verified complete restore has succeeded.
