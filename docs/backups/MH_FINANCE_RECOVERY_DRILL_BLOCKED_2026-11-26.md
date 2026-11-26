# 后续复核：2026-11-26 恢复演练已通过（取代下文早期阻断状态）

**最新结论：隔离 PostgreSQL 数据库逻辑恢复验证 PASS。**

- GitHub Actions [#45840348287](https://github.com/leeminghao131/finance-app/actions/runs/45840348287) 确认 **completed / success**，确切 Commit `ab6dc6354fafa311ad126c89d6d5e222b39bb02e`。
- 从原 GitHub 加密附件 **#45831886534** 下载并解密，`roles.sql`、`schema.sql`、`data.sql` SHA-256 清单校验通过。
- 在一次性 GitHub runner 上独立启动 PostgreSQL 17，使用隔离环境自带的 `supabase_admin` 角色恢复**原始 roles.sql，未删减任何角色授权**；随后以 `postgres` 身份导入 schema/data。针对本地旧版内置 Auth 模板，仅添加通过生产端只读结构核实的两个缺失字段 `auth.custom_oauth_providers.client_auth_method` 和 `client_assertion_audience`。
- 自动验证备份时的总数：687 records、58 transfers、2 user_settings、2 auth.users；验证交易金额合法、用户归属、三张 public 表的 RLS 与至少 9 条策略，以及无 JWT 的 authenticated 角色不能读取 records。
- 运行结束清理一次性临时容器和明文 SQL。没有上传恢复后的明文数据。
- 这证实的是**PostgreSQL 逻辑备份的恢复能力**，不是完整云服务一键恢复：Auth 外部配置、API keys、Realtime、Vercel 登录和设备实际操作仍需分别确认。
- 原始备份加密附件必须继续独立保存，避免 GitHub 1 天到期后丢失；解密密码另行保管。
- **没有修改 Production 数据库、正式网站或 GitHub main；PR82 生产数据库升级仍未批准及执行。**

下文为此前失败阶段的**历史记录**，保留其原始文本供审计，不再代表当前状态。

---

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
