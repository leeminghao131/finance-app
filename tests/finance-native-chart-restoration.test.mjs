import test from "node:test";
import assert from "node:assert/strict";
import {
  chartNumber,chartFields,chartViewport,chartLineSegments,chartPercentages
} from "../src/financeChartPlot.js";
import {readFileSync} from "node:fs";
const load=file=>readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const app=load("App.jsx");
const modal=load("FinanceExpandedTrendOverlay.jsx");
const native=load("FinanceNativeChart.jsx");
const donut=load("FinanceMethodDonutChart.jsx");
const ring=load("FinanceNativeDonut.jsx");
const css=load("financeNativeCharts.css");
test("numeric plot never converts future or invalid balances into fabricated zero",()=>{
  for(const x of [null,undefined,"",NaN,Infinity,"broken"])assert.equal(chartNumber(x),null);
  assert.equal(chartNumber(0),0);assert.equal(chartNumber("42.55"),42.55);
  assert.deepEqual(chartFields("bars"),["income","expense"]);
  assert.deepEqual(chartFields("expense"),["expense"]);
  assert.deepEqual(chartFields("balance"),["balanceGreen","balanceRed"]);
  assert.throws(()=>chartFields("transfer"));
});
test("all four kinds of daily plot maintain coordinate integrity with real-shaped data",()=>{
  const rows=[
    {dateKey:"2026-11-18",day:"18",income:200,expense:862.38,balanceGreen:null,balanceRed:1000},
    {dateKey:"2026-11-19",day:"19",income:100,expense:50,balanceGreen:1050,balanceRed:null},
    {dateKey:"2026-11-20",day:"20",income:0,expense:0,balanceGreen:null,balanceRed:null},
  ];
  for(const type of ["bars","expense","balance"]){
    const v=chartViewport(rows,type,660,240);
    assert.equal(v.data,rows,"must refer to original rows");
    assert.equal(v.x(0)<v.x(1),true);
    assert.ok(v.low<=0&&v.high>=862.38 || type==="balance"&&v.high>=1050);
    assert.ok(v.y(0)>=v.margin.top&&v.y(0)<=v.margin.top+v.ph);
    assert.ok(v.ticks.every(x=>Number.isFinite(x)));
  }
  const bv=chartViewport(rows,"balance",480,160);
  assert.deepEqual(chartLineSegments(rows,"balanceGreen",bv).map(x=>x.row.dateKey),["2026-11-19"]);
  assert.deepEqual(chartLineSegments(rows,"balanceRed",bv).map(x=>x.row.dateKey),["2026-11-18"]);
  const debt=chartViewport([{balanceRed:-220}, {balanceRed:-40}],"balance",320,120);
  assert.ok(debt.low<0&&debt.high>=0,"negative balances are not clipped");
  assert.equal(debt.baseline,debt.y(0));
});
test("donut shares match source values exactly, including malformed and zero entries",()=>{
  const p=chartPercentages([
    {name:"TNG",value:"200.50"},{name:"CASH",value:99.5},
    {name:"BROKEN",value:"bogus"},{name:"ZERO",value:0}
  ]);
  assert.equal(p.total,300);
  assert.equal(p.slices.length,2);
  assert.equal(p.slices[0].value,200.5);
  assert.equal(p.slices[1].end,1);
  assert.ok(Math.abs(p.slices.reduce((sum,x)=>sum+x.percent,0)-100)<0.000001);
  assert.deepEqual(chartPercentages([]),{total:0,slices:[]});
});
test("existing chart data and popup triggers remain, new SVG is actually mounted",()=>{
  assert.match(app,/const dailyData = useMemo/);
  assert.match(app,/const trendData = useMemo/);
  assert.match(app,/<FinanceNativeChart rows=\{dailyData\} kind="bars"/);
  assert.match(app,/<FinanceNativeChart rows=\{trendData\} kind="expense" compact/);
  assert.match(app,/<FinanceNativeChart rows=\{trendData\} kind="balance" alertLimit=\{balanceLimit\} compact/);
  assert.match(modal,/<FinanceNativeChart/);
  assert.match(modal,/selectedDate=\{selected\?\.dateKey \|\| ""\}/);
  assert.match(donut,/<FinanceNativeDonut entries=\{entries\}/);
  assert.match(ring,/chartPercentages\(entries\)/);
  assert.doesNotMatch(native,/onTouchStart:\(\)=>choose\(index\)/);
  assert.match(native,/onClick:\(\)=>choose\(index\)/);
  assert.match(native,/onKeyDown:event=>/);
  assert.match(css,/\.mh-native-chart/);
  assert.doesNotMatch(app+modal+donut,/<ResponsiveContainer|<LineChart|<BarChart|<PieChart/);
});
