# MH Finance App — Stage 2.4 Manual Acceptance · 2026-11-16

**Base:** Stage 2.3 Draft PR #38, branch `feature/phase4-stage2-3-balance-note-sidebar-tools-2026-11-16`, commit `e96090b0cb6611a1fe910e79ffaa522e18d366cf`.

**Safety:** TEST ONLY, using isolated Supabase Test `qrkaxxdwqgffhkalvtby` and fictional TEST accounts/records. This revision changes UI/defaults, not Production, RLS, credentials, database schema, record CRUD or money calculations. Confirm Preview TEST MODE before interacting.

## 01｜新建固定账单：默认提前提醒 = 0 天
1. 打开左侧抽屉 →「固定账单」→「＋新增账单」。
2. 「提前提醒天数（0–30）」的默认值应为 **0**（到期当天提醒）。
3. 新建一条虚构账单，设为今天到期。右上角应出现到期提醒；如果将到期日设为明天，今天**不应**因默认 0 而提前弹出通知。
4. 把提前提醒天数手动改为 3，保存后重新编辑：仍应是 3。以前已保存的 3 天或其他设置**不得被批量改成 0**。
5. 固定账单的周期、金额、付款方式、日历和「确认已付并自动记账」仍按 Stage 2.3 工作；同一期重复操作不得插入第二条 Expense。

## 02｜左侧抽屉七个按钮的 Hover 浮起动画
1. Windows 桌面浏览器把鼠标移动到左侧抽屉的按钮上。每个按钮应有平滑的**微向右／向上浮起、轻微放大、阴影加深**效果，切换到下一个按钮应平顺复位。
2. 浮起只改变按钮的视觉 transform，不重排 Dashboard 卡片、图表或原有按钮位置；滑出抽屉也不能移动页面其它卡片。
3. 七个入口（Wrapped、Simulator、Month Comparison、Savings Goals、Recurring Bills、Review Inbox、Balance Check）点击后保持完整功能。
4. Android 的左侧抽屉仍可点击／纵向滚动，不应被桌面的悬停动画干扰。系统启用 **Reduce Motion** 时按钮不应强制浮动或产生无法控制的连续动画。
5. 焦点可见，Tab／Enter／Escape 按原有交互操作。

## 03｜Transfer History → 浮动按钮入口
1. 找到主页原有 **资金转账 / Money Transfer** 卡片，右上方应有按钮 **📋 转账历史（N）**，原本大型 Transfer History 列表不再长期占据主页。
2. 点击按钮，打开独立**转账历史浮窗**。原有 Transfer History 所有操作都应该在里面：
   - 可查看历史及筛选月份、From Method、To Method、关键字
   - 默认完整历史分页（首 25 笔，可「显示更多」）
   - 编辑日期、金额、付款来源／目标及备注，原有验证／版本冲突保护不变
   - 删除确认、Recycle Bin、Restore
3. 使用虚构 Test Transfer 编辑其中一笔并保存，关闭再打开，仍能看到云端新版本。金额输入 RM 输入按原本规则，不得将 RM100 改为 RM1。
4. 删除 Test Transfer 后，在转账卡片可 Undo；在历史浮窗内的回收站应可 Restore。
5. 浮窗 X／Escape／背景关闭、页面滚动锁定、Android 触控及滚动应正常。若正在保存，不能因误关窗而掩盖结果。
6. 仍可直接在主卡片新增 BANK → TNG RM120 Transfer，BANK 减少而 TNG 增加 RM120，总资产不变，Transfer 不计作 Income/Expense。

## 04｜余额对账：只从左侧抽屉和通知打开浮窗
1. 主页面的 Money Transfer 卡片应只展示原本**转账表单、Undo、Transfer History 按钮**，不再有「资金转移／余额对账」双 Tab，也不常驻余额对账整张大卡片。
2. 左侧抽屉 →「余额对账」，打开完整且可滚动的独立对账浮窗。所有 Method 的实际余额输入、账本余额、差额、自动匹配建议、确认转账、对账历史均可用。
3. 以虚构 Test 数据输入 TNG 实际比账本多 RM150、BANK 实际比账本少 RM120，其他账户差额为零：应建议 **BANK → TNG RM120**，剩余 RM30 只提示调查／可选择预填 Income，不允许未经确认直接生成 Income。
4. 尾差预填 Income／Expense 的 Note 应一律是 **`balance`**，并且仍只是填入**未保存**的表单。点击后对账浮窗应该关闭，让表单可见。
5. 从右上角具体账户差额通知点击进入，应打开**同一个完整对账浮窗**，并预先选中该条提醒的 Method，而不是跳到旧卡片。点击账单和异常记录通知仍各自打开原本对应的完整浮窗和具体对象。
6. 原有自动匹配多 Transfer 的「逐笔重新检查云端完整账本／发现冲突即停止／请求 ID 防重复」机制保持。**只在虚构 Test 数据下验证**。
7. 在中文和英文模式间切换，标题／按钮随语言切换，用户原文和财务 Method Key 不应改变。

## 自动测试和发布守则
- 最新 CI 执行全部 synthetic tests、Vite Build 和依赖扫描，并核对 Vercel Preview READY、target=null、SHA 与最终 Commit 完全一致。
- 这次更改涉及 `src/FinanceRecurringBills.jsx`、`src/financeStage2.js` 的默认提前天数，`src/financeUi.css` 动画，`src/FinanceTransferPanel.jsx` 历史浮窗，`src/FinanceStage2Hub.jsx` 共享对账浮窗及 `src/App.jsx` 的 UI 路由，相关测试及本说明；未更改 protected finance data write functions。
- **未执行** Windows/Android 实机操作验收、双设备并发实测、两个 TEST 账号相互隔离的手动验收。不能把自动测试结果等同于真实验收。
- **不允许**未授权合并 main、部署 Production、改变 Production Supabase 或密钥。正式发布前需要独立的加密可恢复数据库备份、恢复验证、完整回归和用户分别批准各高风险操作。
