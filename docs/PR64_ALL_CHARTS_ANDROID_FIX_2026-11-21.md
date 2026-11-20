# PR #65 · 全站财务图表恢复与 Android 响应式修复
2026-11-21 · Asia/Kuala_Lumpur

## 用户报告
- 在 PR #64 测试版，除了已单独修复的 Cash Flow Forecast 之外，其他多张财务图表仍空白；Android 上 Forecast 每日点位密集、X 轴日期拥挤。
- 用户明确要求直接全面修复，保留 Steam/Cosmic 精美 UI，同时绝不改动真实财务计算和数据库。

## 以当前代码为基准
- 起点：PR #64 / commit `91dccecfb6ce3b86cfd666667d12db61816b8041`。
- 本改动为独立 **Draft 子 PR**，仅 Vercel Preview 和独立 Supabase Test 环境。
- 已排查 JSX 主图表入口。此前 PR #64 仍保留 Recharts 的位置：`FinanceMonthComparison.jsx`、`FinanceScenarioSimulator.jsx`；这次两者都迁移到原生 SVG。现有 Chart 库依赖未删除以降低变更范围。

## 精确修改
1. `src/financeChartPlot.js`
   - 新增只读的 `chartTickIndices`、`chartLineRuns`、`chartBalanceSegments`；支持只读动态 series 字段数组。
   - 30、90、365 天稀疏日期标签，不漏掉首尾。
   - 余额跨越可配置警戒阈值时在真实的插值位置切换红绿颜色，曲线不中断、不改变任何 RM 金额。
   - `null` 未来实际值保持空值，绝不伪造成 0 或真实记录。
2. `src/FinanceNativeChart.jsx`
   - 修复隐藏/0px 首次布局的回退及 ResizeObserver / window resize 后重新测量。
   - 手机上不显示大量圆点；Forecast 全平台无点、用银色实线 + 蓝色虚线；图表日期、RM tooltip 仍保留。Android 滑动采用 `touch-action: pan-y`，只在完成点击后选择日期，不因 `touchstart` 被动选中大量数据。
   - 单一有效数据仍绘制短线，空数组明确显示 No data。
   - 柱状图使用**独立居中数据槽**，按真实容器宽度计算柱宽，避免长期记录和年份范围内柱形互相覆盖。优先保留所有数据，不通过筛掉记录来掩饰卡顿。
3. `src/FinanceNativeMultiSeriesChart.jsx`（新增）
   - 月度对比 Income / Expense / Net 三类并排柱状图（含负净收支）。
   - What-if Simulator 的当前模式、计划模式，以及所有同期限用户预设独立曲线，保留其颜色、虚线及完整来源数据。
   - 动态 tooltip、手机少刻度、SVG 单点回退、触控/键盘可访问性，**没有任何财务写入函数**。
4. `src/App.jsx`、`src/FinanceForecastPanel.jsx`、`src/FinanceExpandedTrendOverlay.jsx`、`src/FinanceMonthComparison.jsx`、`src/FinanceScenarioSimulator.jsx`：
   - 仅替换 JSX 图表容器、调用及只读表现 props，不碰 `dailyData`/`trendData`、`calculateCashForecast`、`compareFinanceMonths`、`simulateFinanceScenarios` 的业务定义。
   - 全站图表和两种放大弹窗手机端明确高度，Forecast `showPoints={false}`，短小趋势图仍可放大且 X 轴不堆叠。
5. `src/financeNativeCharts.css`：尺寸兜底、适配窄屏、轻量 tooltip/legend；保留原有复杂蒸汽朋克材质和 Heatmap 日期弹窗。
6. 旧测试对 `onTouchStart`、过时颜色常量、Recharts 标签的断言更新为现有互动/阈值/数据来源验证；新增 `tests/finance-all-charts-mobile-regression-2026-11-21.test.mjs` 七项综合回归，扫描每个 JSX 文件，确保无残余 Recharts 绘图入口。

## 自动验证
- 最新代码需以 CI head SHA 为准：`npm test`（目标 315 / 315），Vite build，两套 npm 依赖安全审计。
- 不等于真实视觉测试；Playwright / Android 真机 / Windows 浏览器的图像可见性、手势、滚动、布局仍需手动验收。GitHub CI 成功及 Vercel READY 不能代替画面截图验证。

## 手动验收标准（独立 Test 虚构资料）
- Dashboard：每日收支柱状图、消费趋势、余额趋势，两种趋势大浮窗，按分类气泡、支付方式圆环。
- Forecast：月末/未来 30 天/90 天；手机无点、少日期、实线=真实、虚线=预计；未来实际数据保持空值。
- 月度财务对比：含收入、支出、正/负净值的双月份柱状；月份对调及分类明细弹窗正常。
- 情景模拟：3/6/12/24 月，多种已保存方案，颜色和数据与旁边的文字总额一致。
- Heatmap：有收入无支出、有支出无收入、空日期，以及日期明细浮窗；手机点击和滚动不冲突。
- 手机及 Windows：滑动不误触；首末日期不裁剪；不同宽度及放大缩小不会 0px 空白；表格/弹窗/登录和其他功能保持不变。

## 安全与回滚
- 未修改任何 Supabase schema、Auth/RLS、CRUD、`addRecord`、`updateRecord`、`deleteRecord`、`importCsv`、`loadCloudData`、`saveBudgets`；未修改真实历史金额、转账和预算。
- 不连接 Production 数据库，不修改生产环境变量，未合并 `main`，未发布 Production。
- 原 PR #64/PR #63 不变，回滚只需关闭此 Draft 子 PR。
- 正式发布须独立备份/恢复验证、自动测试与 Android/Windows 人工验收，并获得用户单独批准。
