# MH Finance App — Stage 3 完整手动验收指南
日期：2026-11-16 · 时区：Asia/Kuala_Lumpur · MYR（RM）

## 版本范围与硬性安全要求
Stage 3 包含 **10｜Activity Mode（旅游／活动自动关联记账）** 和 **16｜Activity Wrapped（活动财务回顾）**，以已验证 Stage 2.6 为基线。开发限独立分支／Vercel Preview／Supabase Test 项目 `qrkaxxdwqgffhkalvtby`。**不合并 main、不部署 Production、不修改正式数据库。**

仅使用 **虚构测试账号与虚构交易**；先检查 Preview 顶部 **🧪 TEST MODE**。如果没有标识，或者要求登录 Production 账号，立即停止。Stage 3 新增两个**独立 Test** 数据表：`finance_activities`、`finance_activity_links`，均启用用户隔离 RLS，活动与旧财务记录仅通过 ID 关联，没有重写历史金额／Category／Method／Note／日期／交易 ID。

CI 合格不等于 Android／Windows 真实操作已验收。测试执行者记录结果；真实双账号、双设备实测不应由自动构建替代。

## 10｜Activity Mode 完整功能
1. 打开左侧抽屉新按钮 **🎒 旅行／活动记账**。应显示新建活动、活动列表和独立统计区域。所有按钮可在 Windows 桌面、Android 手机触控；不会挤动首页卡片。
2. 建立虚构活动 **成都旅行**，预算 **RM1,500.00**。应直接变为「进行中」，显示预算进度、总支出 RM0 和 0 笔 Expense。刷新网页，活动仍保留并来自云端。
3. 活动进行中，使用正常 RM 输入新增虚构 Expense：RM35.50、Category 饮食、Method TNG、Note「火锅」。系统应只新增**一笔**真实 TEST Expense，同时产生一条 Activity 关联。首页 Income／Expense、Method Balance 与原本一致；活动统计额外显示 RM35.50。Record 列表（电脑和 Android）显示 **🎒 成都旅行** 小标签。
4. 再新增 RM10.25、Category 交通、Method BANK、Note「车票」。活动总额应 RM45.75（精确到 sen），显示按分类和日期分组、总预算使用率、支出笔数和日均消费。
5. 新增虚构 Income RM500。活动累计支出**不能**增加；Income 仍计入正常 Income／Balance。新增 BANK → TNG RM120 Transfer：活动金额及总资产不得改变，Money Transfer History 保持正常。
6. 在活动进行中点击**暂停**。新增虚构 Expense RM60，应照常保存为一般 Expense，**不自动增加活动总额**。点击**继续**后再新增 RM20，活动应恢复自动关联；暂停期间的 RM60 可以随后人工补关联。
7. **同一时间只能一个「进行中」的活动**：尝试创建／继续另一个活动时应被 UI 或数据库约束阻止；不得把同一笔消费自动关联到两个活动。
8. 选择早期未关联的虚构 Expense（例如 RM60），在活动管理的「手动关联历史 Expense」中搜索并选择，点击「关联」。活动总额只增加一次，不允许重复点击生成第二条关联；旧交易金额、日期、分类、Method、Note 与 ID 保持不变。
9. 展开「活动支出记录」，点击「取消关联」并二次确认。只撤掉这个活动小标签，**原本 Expense 不删除、不更改金额，仍正常计入首页账本**；历史关联以软解除形式保留。再选择此 Expense 补关联，活动总额恢复。
10. 在 Transaction Records 对已关联的 TEST Expense 编辑 RM35.50 为 RM45.50，刷新后活动总额应相应增加 RM10。将其 Soft Delete 移到 Recycle Bin：活动合计减少该笔金额。Restore 后恢复统计和原来的标签。
11. 结束活动之后，状态为「已结束」，原有关联和报告仍可查看；新增 Expense 不再自动归入已结束活动。可查看不同历史活动，按账号隔离。
12. 新增/编辑活动名称、预算时输入非法值（空名称、超过 90 字、RM0、三位小数）应被拒绝；金额不能乘 100 或被错误解释为 Cents Keypad。
13. 测试活动进行期间确认一笔**虚构固定账单**已付：只新增一条正常 Expense；若活动仍在进行，该 Expense 应自动出现活动标签，但不能新增第二条 Expense 或改变固定账单状态。
14. 模拟网络异常造成 Expense 已保存但 Activity 关联失败：系统必须明确说明 **Expense 已成功保存、标签未确认**，并提供手动关联路径；严禁诱导用户再次新增同一笔 Expense。
15. 两设备以相同 TEST 账号开启／暂停同一活动，使用过期版本在另一设备修改：应提示冲突并刷新，不静默覆盖较新状态。活动链接不会因双方重试重复插入。
16. 两个完全不同 TEST 账号：不得看到、修改、关联彼此的活动与 Expense；Supabase RLS 应阻止跨用户关联。

## 16｜Activity Wrapped
1. 打开左侧 **✨ Finance Wrapped**，原有 Monthly、Custom Quarter、Yearly 模式须保持正常（日期范围、图表、预算快照、PNG 导出）。
2. 新增第四种 **活动／旅行（Activity / Travel）** 模式。可选择「成都旅行」及其他活动，包括已结束的活动；应依该活动实际关联的 Expense 生成故事，不受首页 Dashboard 的月份筛选影响。
3. 依次查看 10 页活动故事：活动名称与期间、总消费/笔数/活动天数、最高消费分类、付款方式、最大几笔消费、最常使用的备注、每日支出时间线、活动预算、日均消费、结语。
4. 核对财务数字：例如 RM35.50 + RM10.25 = **RM45.75**。Transfer、Income、Expected Income、其他活动或已删除 Expense 不得算入活动消费。
5. 切换 **Hide RM amounts（隐藏金额）**，故事和 PNG 均不应露出具体 RM 花费。切换 **Hide private notes（隐藏私密备注）**，故事备注页面和大额记录中的 Note 不显示原文。用户输入的原备注本身不能被修改。
6. 点击「Save summary as PNG」，浏览器应在本地导出图片；图文不上传到外部服务器，中文、英文以及 Activity 名称显示正常。分享图无私密 Note，隐藏金额模式也无 RM 数字。
7. 切回 Monthly、Quarterly、Yearly，仍使用原来的收入／支出数据及预算快照；Activity 模式不会改变任何 Income、Expense 或 Money Transfer 记录。

## 必须保留的所有旧功能
- 正常 RM 输入 `100` = RM100.00，Cents Keypad `2455` = RM24.55。
- 原有 Income／Expense 新增、编辑、删除、Restore、Undo；同一记录不重复提交。
- BANK → TNG RM120 只改变 Method 余额、不改变总资产或 Income／Expense。
- Budget 每自然月独立、75%／100% 提醒、Expected Income 仅预测不是真实收入。
- 固定账单一键安全付款、异常记录四开关、账户对账与 Transfer History、月度分析、Savings Goals、Quick Notes、CSV Import 先预览后确认、Excel Export、完整中英文显示和主界面动画。
- 已取消的 Method 差额通知仍然**不出现**。
- 多设备同步必须完整分页读取，未完整加载不得显示假成功，用户数据 RLS 隔离。

## 自动验证与上线边界
- GitHub CI 在最终 Stage 3 Commit SHA 上全部逻辑测试、Vite Build 与依赖扫描通过；Vercel READY Preview SHA 与该 Commit 精确一致且 target=null。
- 测试数据位于独立 Supabase Test；**生产数据库、Production 网站与 main 不得碰**。
- 本阶段已执行的 Supabase Test additive schema 仅限上述两张活动表；任何未来 Production 迁移必须单独审查兼容性、权限、备份／恢复，取得明确批准。
- 正式发布之前须独立、加密、可恢复的真实数据库备份和恢复测试，以及 Windows／Android、不同账号和双设备真实验收。Git 代码回滚无法恢复数据库。
