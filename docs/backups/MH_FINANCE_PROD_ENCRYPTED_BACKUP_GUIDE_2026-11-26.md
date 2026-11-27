# MH Finance App — 云端加密备份操作与安全说明（2026-11-26）
 
> 当前阶段：**配置待完成；未导出任何真实财务资料；未完成恢复演练。**
> 这个流程只运行在独立分支 `backup/secure-prod-2026-11-26`，绝不合并/部署生产网页。
 
## 已由开发助手准备
- GitHub Actions 文件：`.github/workflows/mh-finance-prod-encrypted-backup.yml`
- 已固定项目校验：**hlkciowyusbhwcwjzfsr**（正式 Supabase）
- 使用 GitHub 临时 Ubuntu 机器；不要求用户电脑安装 Docker
- 仅读取 SQL：Supabase CLI 导出 roles、schema、data；没有数据库写入或迁移
- 临时 SQL 文件在 runner 中经 AES-256（GPG）加密，验证可解密和 tar 结构后，**只上传加密 `.gpg` 附件**
- 附件 GitHub 保留 **1 天**，不是永久保存；请及时下载并另行离线/私密保存
- 本流程验证加密文件可打开，**不等于验证数据库可成功恢复**
 
## 唯一需要用户亲自设置的安全内容
**不要把数据库密码、连接串或加密密码发到聊天、PR、Issue、文件或任何普通消息。**
 
1. 登录 GitHub，打开 [项目 Environments](https://github.com/leeminghao131/finance-app/settings/environments)。创建或选择 `mh-finance-prod-backup`。
2. 在 **Deployment branches and tags** 选 **Selected branches and tags**，仅允许 **Branch** `backup/secure-prod-2026-11-26`。不要允许任意分支。若有另一位可信赖的审查人，可以设置 Required reviewers。
3. 在 **Environment secrets** 添加：
   - `MH_PROD_DB_URL`：从 [MH finance app 正式 Supabase](https://supabase.com/dashboard/project/hlkciowyusbhwcwjzfsr) 的 **Connect → Session pooler** 获取正式 PostgreSQL 连接串。GitHub runner 使用 IPv4，优先 Session pooler，端口 5432；连接串中的密码只在 GitHub Secret 中输入。
   - `MH_BACKUP_PASSPHRASE`：由你自己的密码管理器生成、长度至少 32 字符的强随机密码。必须**额外离线保存一份**；丢失它无法解密备份。
4. 在同一个 Environment 的 **Environment variables** 新增 `MH_BACKUP_ARMED` = `YES`。
5. **只回复聊天：**「GitHub 备份环境、2 个 Secrets、1 个 Variable 已配置」。**不要提供 Secret 值。**开发助手将重新触发备份并核查运行记录。
 
如果忘了正式数据库密码，请先说明情况；不要为了备份擅自重置，避免影响旧的数据库连接。
 
## 上线安全门槛
备份 Action 成功 ≠ 完整数据库可恢复。仍需：
- 将 AES-256 加密文件下载到独立安全位置，至少保留两份；**不能把 SQL 或密码提交到公开 GitHub 仓库**
- 检查 `auth.users`、`public.records`、`public.transfers`、`public.user_settings` 的逻辑导出内容
- 使用完全隔离的环境进行 **roles/schema/data 恢复演练**，验证 RLS、账号、金额和数据完整性（不能在正式 Supabase 测试恢复）
- 记录备份时间与迁移前记录笔数，再取得明确的正式数据库迁移授权
 
## 重要限制
GitHub 的仓库是公开的；即使附件被强密码加密，也只能作为临时转运，不能取代独立私密的长期备份仓库。
Supabase Free 不包含自动每日备份。官方链接：
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
