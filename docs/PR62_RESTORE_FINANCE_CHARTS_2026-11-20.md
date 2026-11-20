# PR #63 — 修复 PR #62 图表全空白（2026-11-20，Asia/Kuala_Lumpur）

## 用户报告及证据
用户提供两张截图：Dashboard 的 Daily Income vs Expense、Spending Trend、Filtered Balance Trend、Method Ratio 多个 Recharts 图表空白；Spending Trend 的独立浮窗也空白，而右侧仍有 2026-11-18 当日真实支出金额和 5 笔记录。Expense by Category 的原生 SVG 气泡仍能显示，但容器白色背景与深色风格不一致。

这支持“图表数据尚在，**显示层**存在回归”的判断，不是数据库数据丢失的证据。尚未取得用户浏览器 Performance trace / DOM computed styles，故旧 Recharts 空白的具体根因**未证实**，不可冒称“确认是某个 CSS”。

## 修复范围（严格只改图表显示，不变更财务计算）
独立分支 `fix/pr62-restore-chart-rendering-2026-11-20`，从 PR #62 的 `e9b9dad490d193d549d42f966bc184d3319a51bd` 创建，PR 以 PR #62 开发分支为基准，不碰 main。

- 新增 `src/financeChartPlot.js`：纯函数，计算 SVG 绘制坐标、刻度、原数据点及 donut 扇区比例；严格区分 `null`、`undefined` 和数值 0，不把未到期余额假装成 0；支持负余额。
- 新增 `src/FinanceNativeChart.jsx`：从原 `dailyData` / `trendData` 直接绘制 Income/Expense 柱状、Expense 折线、Balance 红绿折线；本地 ResizeObserver 仅负责视口尺寸，不参与财务数据计算；显示原始日期和 RM 金额；支持电脑悬停、键盘、手机触控，按日期同步浮窗右侧明细。
- 新增 `src/FinanceNativeDonut.jsx`：从原 `methodData` / `entries` 绘制 TNG/CASH/BANK/GRAB PAY 等方法圆环；原数据和自定义支付方式保留；百分比来自输入数值按原规则汇总，不增加/更改记录。
- 新增 `src/financeNativeCharts.css`：原生 SVG 容器、边框、可读图例及 tooltip；补足分类气泡容器白底和右侧交易明细的深色对比。
- 修改 `src/App.jsx`：仅新增图表组件 import、样式 import、三处图表 JSX；原 `dailyData`、`periodDailyData`、`trendData`、分类、筛选、金额、RLS、CRUD、云端加载及状态**未改**。
- 修改 `src/FinanceExpandedTrendOverlay.jsx`：仅一处 Recharts 改为原生 SVG 组件，保留双图表模式、悬停/触控日期选择、右侧交易记录显示。
- 修改 `src/FinanceMethodDonutChart.jsx`：仅绘图，原各方法列表、百分比、合计及按钮交互保留。
- 更新三个旧渲染测试，不再强制要求已被替换的 Recharts 类名，而是检测日期选择、阈值、红绿颜色、来源聚合与触控、鼠标、键盘交互。
- 新增 `tests/finance-native-chart-restoration.test.mjs`：含模拟正确/缺失/无效金额、负余额、不伪造 0、比例总和 100%、四个显示入口实际挂载等检查。

## 验证限制
GitHub Actions 代码级测试、构建与安全审计可自动确认。**实际浏览器的 SVG 图形、手机交互、全站样式和帧率目前没有用户验收记录**，Preview READY 不等于已完成真实设备视觉验收。
测试流程：在独立 Supabase Test 账号使用虚构 Income/Expense 数据；测试全部 4 个图表及两种放大浮窗、记录日期/金额一致、比例合计 100%、空月份/自定义支付方式、手机和 Windows 滚动、中文/英文、资金转移不计为收支。确认无样式遮挡、裁剪、重叠。正式账户不允许接入 Preview。

## 安全及回滚
Production / GitHub main / Supabase 生产数据库未修改。完全不修改 `addRecord`、`updateRecord`、`deleteRecord`、`loadCloudData`、预算、导入导出、转账与真实资金数据。图表恢复如不符合视觉效果，可独立撤回本 PR，原 PR #62 代码保持不变。合并 main 和 Production 必须分别经用户明确授权，并遵守备份与恢复验证要求。
