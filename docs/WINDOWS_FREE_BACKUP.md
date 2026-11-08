# MH Finance App — Windows 免费数据库备份（仅在你自己的电脑执行）

**目标：RM0，不更改正式数据，不把密码、财务记录或备份上传到 GitHub。**

## 目前的保护状态
- 已有加密业务数据快照（`records`、`transfers`、`user_settings`），此前验证可解密、逐条一致。
- 已在独立测试数据库完成虚构数据的删除与恢复演练。
- **尚未从正式项目取得独立、完整、可恢复的 PostgreSQL 备份**；这是一个需要在可信本机完成的步骤。
- GitHub Actions 没有数据库密码、`service_role` key 或生产备份权限。不要向它授予这些权限。

## 免费工具
1. 在自己的 Windows 电脑安装官方 Supabase CLI，并确认 `supabase --version` 可用。
2. 按官方文档安装/启动 Docker Desktop（个人合规免费使用时无需购买订阅）。
3. 准备本机**非 GitHub Repository** 的安全文件夹，例如 `C:\MHFinance-Secure-Backups`。
4. 备份加密存放。建议使用已有的可信密码管理器和加密存储介质；若使用 7-Zip 的 AES-256 加密压缩，也是免费的。**不要留一份未加密 SQL 在同步/共享文件夹。**

## 只读备份步骤
在自己的 Windows PowerShell 中运行；请勿把数据库密码、连接字符串、登录 Token 发给 ChatGPT。

```powershell
mkdir C:\MHFinance-Secure-Backups
cd C:\MHFinance-Secure-Backups
supabase init
supabase login
supabase link --project-ref hlkciowyusbhwcwjzfsr
supabase db dump --linked -f roles.sql --role-only
supabase db dump --linked -f schema.sql
supabase db dump --linked -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

Get-Item .\roles.sql, .\schema.sql, .\data.sql | Select-Object Name, Length
Get-FileHash .\roles.sql, .\schema.sql, .\data.sql -Algorithm SHA256
```

如果 `supabase init` 显示目录已经初始化，不要重置任何远程数据库；先确认当前文件夹。以上 `db dump` 只导出，不执行 `db reset` / `db push` / `db restore`。

**必须检查**：三个文件都有内容，数据文件包含所需业务表的数据。将三个文件一起加密归档，密钥单独离线保存，保留至少两个不同日期的版本；确认加密归档能重新打开后，安全清理明文副本。

## 官方限制与灾难恢复
- Supabase CLI 的 `db dump` 会排除部分 Supabase 托管的 `auth`、`storage` 等 Schema；数据表文件不等于完整 Supabase 项目备份。
- 如果使用 Storage 存储图片/附件，还需要按官方文档单独导出文件；如果将来发生整个 Supabase 项目丢失，Authentication 身份和会话可能需要另行恢复或重新登录。
- **永远不要直接把 SQL 恢复到正式数据库。** 先建立专门且不公开的恢复环境，确认对象、主键、用户归属和金额后，再按具体事故做精确修复。
- 正式数据库恢复前必须先停写、保留事故时的现有数据库和原始备份，避免覆盖备份以后新增的合法记录。
- 若界面要求购买服务或升级套餐，停止操作，遵守 RM0 限制。

来源： https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
以及 https://supabase.com/docs/reference/cli/supabase-db-dump
