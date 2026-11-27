import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {
  chartFields,chartViewport,chartTickIndices,chartLineRuns,
  chartBalanceSegments,chartNumber
} from "../src/financeChartPlot.js";

const src=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const native=src("FinanceNativeChart.jsx");
const series=src("FinanceNativeMultiSeriesChart.jsx");
const app=src("App.jsx");
const forecast=src("FinanceForecastPanel.jsx");
const overlay=src("FinanceExpandedTrendOverlay.jsx");
const comparison=src("FinanceMonthComparison.jsx");
const simulator=src("FinanceScenarioSimulator.jsx");
const css=src("financeNativeCharts.css");

test("all shipped JSX charts use working SVG renderers, not failing ResponsiveContainer",()=>{
  const folder=new URL("../src/",import.meta.url);
  const offenders=readdirSync(folder).filter(name=>name.endsWith(".jsx"))
    .filter(name=>/<ResponsiveContainer\b|<LineChart\b|<BarChart\b|<AreaChart\b|<PieChart\b|from ["']recharts["']/.test(src(name)));
  assert.deepEqual(offenders,[],"no Recharts chart left hidden in other modules");
  assert.match(app,/<FinanceNativeChart rows=\{dailyData\} kind="bars"/);
  assert.match(app,/<FinanceNativeChart rows=\{trendData\} kind="expense"/);
  assert.match(app,/<FinanceNativeChart rows=\{trendData\} kind="balance"/);
  assert.match(forecast,/<FinanceNativeChart/);
  assert.match(forecast,/showPoints=\{false\}/);
  assert.match(overlay,/<FinanceNativeChart/);
  assert.match(comparison,/<FinanceNativeMultiSeriesChart/);
  assert.match(simulator,/<FinanceNativeMultiSeriesChart/);
  assert.match(comparison,/rows=\{chart\} mode="bars" xKey="metric"/);
  assert.match(simulator,/rows=\{comparisonData\} mode="line" xKey="month"/);
});
test("mobile tick geometry avoids overlapping x-axis labels for 30, 90 and 365 days",()=>{
  for(const count of [30,90,365]){
    const ticks=chartTickIndices(count,4);
    assert.equal(ticks.length,4);
    assert.equal(ticks[0],0);
    assert.equal(ticks.at(-1),count-1);
    assert.ok(ticks.every((value,index)=>index===0||value>ticks[index-1]));
    assert.ok(ticks.every((value,index)=>index===0||value-ticks[index-1]>=Math.floor((count-1)/3)-1));
  }
  assert.deepEqual(chartTickIndices(0,4),[]);
  assert.deepEqual(chartTickIndices(1,4),[0]);
  assert.deepEqual(chartTickIndices(2,4),[0,1]);
  assert.deepEqual(chartTickIndices(3,4),[0,1,2]);
});
test("threshold crossing keeps a continuous two-color balance line at the correct RM cutoff",()=>{
  const rows=[
    {balanceRed:1200,balanceGreen:null},
    {balanceRed:null,balanceGreen:2000},
    {balanceRed:null,balanceGreen:2100}
  ];
  const view=chartViewport(rows,"balance",400,200);
  const parts=chartBalanceSegments(rows,view,1500);
  assert.equal(parts.length,3);
  assert.equal(parts[0].above,false);
  assert.equal(parts[1].above,true);
  assert.equal(parts[2].above,true);
  assert.ok(Math.abs(parts[0].x2-parts[1].x1)<1e-9);
  assert.ok(Math.abs(parts[0].y2-parts[1].y1)<1e-9);
  assert.ok(Math.abs(parts[0].y2-view.y(1500))<1e-9);
  assert.ok(parts.every(p=>[p.x1,p.x2,p.y1,p.y2].every(Number.isFinite)));
  assert.deepEqual(chartBalanceSegments([
    {balanceRed:1000},{balanceRed:null,balanceGreen:null},{balanceGreen:2000}
  ],chartViewport([{balanceRed:1000},{},{balanceGreen:2000}],"balance",350,180),1500),[],
    "missing rows cannot create invented intermediate balances");
});
test("missing forecast ACTUAL data stays missing and separate from future projected balance",()=>{
  const rows=[{date:"2026-11-20",actual:1000,forecast:1000},
    {date:"2026-11-21",actual:null,forecast:940},
    {date:"2026-11-22",actual:null,forecast:1200}];
  assert.equal(chartNumber(null),null);
  assert.deepEqual(chartFields("forecast"),["actual","forecast"]);
  const view=chartViewport(rows,"forecast",350,220);
  assert.equal(chartLineRuns(rows,"actual",view).length,1);
  assert.equal(chartLineRuns(rows,"actual",view)[0].length,1);
  assert.equal(chartLineRuns(rows,"forecast",view)[0].length,3);
  assert.ok(view.high>=1200);
  assert.ok(native.includes('strokeDasharray={kind==="forecast"&&field==="forecast"?"7 5":undefined}'));
  assert.doesNotMatch(forecast,/forecastPlans.*\.from\(|\.insert\(/);
});
test("one-point and separated series still render a visible stroke without fake numeric zero",()=>{
  const rows=[{income:1,expense:10},{income:2,expense:null},{income:3,expense:12}];
  const view=chartViewport(rows,"expense",300,144);
  const runs=chartLineRuns(rows,"expense",view);
  assert.equal(runs.length,2);
  assert.ok(runs.every(run=>run.length===1));
  assert.match(native,/x1=\{run\[0\]\.x-7\} x2=\{run\[0\]\.x\+7\}/);
  assert.match(native,/!showMarkers&&previous===null&&next===null/);
  assert.deepEqual(chartFields(["first","second","saved0"]),["first","second","saved0"]);
  assert.throws(()=>chartFields(["bad-key!"]));
  const net=chartViewport([{first:-500,second:100},{first:300,second:1200}],["first","second"],300,200);
  assert.ok(net.low<0&&net.high>1200);
});
test("phone charts have no dense dots, dates are sparse and scrolling does not falsely tap rows",()=>{
  assert.match(native,/const showMarkers=showPoints&&!\(hidePointsOnMobile&&isMobile\)/);
  assert.match(native,/const isMobile=size\.width<540/);
  assert.match(native,/onClick:\(\)=>choose\(index\)/);
  assert.match(native,/onKeyDown:event=>/);
  assert.doesNotMatch(native,/onTouchStart/);
  assert.match(native,/touchAction:"pan-y"/);
  assert.match(native,/ResizeObserver/);
  assert.match(native,/window\.addEventListener\("resize"/);
  assert.match(series,/touchAction:"pan-y"/);
  assert.doesNotMatch(series,/onTouchStart/);
  assert.match(app,/h-\[270px\] min-w-0 sm:h-64/);
  assert.match(app,/h-\[188px\] min-w-0/);
  assert.match(forecast,/h-\[285px\] min-w-0 sm:h-64/);
  assert.match(overlay,/h-\[300px\] min-w-0 sm:h-80/);
  assert.match(css,/\.mh-native-chart--compact/);
});
test("saved what-if scenarios and month comparison still use calculated source rows unchanged",()=>{
  assert.match(simulator,/simulateFinanceScenarios\(records/);
  assert.match(simulator,/const comparisonData=v\?\.baseline\.map/);
  assert.match(simulator,/entry\["saved"\+p\.index\]=p\.value\.scenario\[i\]\.balance/);
  assert.match(simulator,/key:"saved"\+p\.index/);
  assert.match(comparison,/compareFinanceMonths\(records,firstMonth,secondMonth,asOfDate\)/);
  assert.match(comparison,/first:value\.first\.income,second:value\.second\.income/);
  assert.match(comparison,/first:value\.first\.net,second:value\.second\.net/);
  assert.doesNotMatch(series,/localStorage|supabase|fetch\(|saveBudgets|addRecord|updateRecord|deleteRecord/);
});
