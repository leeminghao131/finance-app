import React, { useEffect, useState } from "react";

// Read-only scroll paint diagnosis, TEST Preview only. Does not import any
// financial service, intercept form submission, or read/write user data.
const MODES = [
  ["normal", "原本完整画面"],
  ["no-blur", "只关闭顶部背景模糊"],
  ["no-sticky", "只关闭顶部悬浮定位"],
  ["no-animation", "只关闭持续动画"],
  ["no-space", "只关闭宇宙背景"],
  ["no-metal", "只关闭复杂金属装饰"],
  ["minimal", "同时关闭装饰/模糊/动画"],
];

export default function FinanceRenderDiagnostics() {
  const [mode, setMode] = useState("normal");
  const [folded, setFolded] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    document.documentElement.dataset.mhPerfMode = mode;
    return () => { delete document.documentElement.dataset.mhPerfMode; };
  }, [mode]);

  // Samples actual requestAnimationFrame intervals after input/scroll.
  // This is a rough device comparison aid, NOT Chrome tracing or guaranteed FPS.
  // No permanent listeners or timers; does not listen to finance state.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let endAt = 0;
    let intervals = [];
    const frame = time => {
      if (last) {
        const ms = time - last;
        if (ms > 0 && ms < 1000) intervals.push(ms);
      }
      last = time;
      if (time < endAt) {
        raf = requestAnimationFrame(frame);
        return;
      }
      raf = 0;
      if (intervals.length > 5) {
        const sorted = intervals.slice().sort((a,b) => a - b);
        const p95 = sorted[Math.floor((sorted.length - 1) * .95)];
        const median = sorted[Math.floor(sorted.length * .5)];
        const slow = intervals.filter(ms => ms > 34).length;
        setResult({ median: median.toFixed(1), p95: p95.toFixed(1),
          slow, count: intervals.length });
      }
      intervals = [];
      last = 0;
    };
    const onActivity = () => {
      endAt = performance.now() + 900;
      if (!raf) {
        intervals = [];
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("wheel", onActivity, { passive: true });
    window.addEventListener("touchmove", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { capture: true, passive: true });
    return () => {
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("touchmove", onActivity);
      window.removeEventListener("scroll", onActivity, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode]);

  return (
    <aside className={"mh-perf-lab" + (folded ? " is-folded" : "")}
      aria-label="仅测试环境渲染性能诊断">
      <header className="mh-perf-lab__head">
        <strong>🔧 UI 卡顿诊断 · TEST</strong>
        <button type="button" onClick={() => setFolded(value => !value)}
          aria-label={folded ? "打开诊断面板" : "收起诊断面板"}>
          {folded ? "展开" : "收起"}
        </button>
      </header>
      {!folded && <>
        <label htmlFor="mh-perf-mode">选择一个效果关闭，再上下滚动：</label>
        <select id="mh-perf-mode" value={mode}
          onChange={event => { setMode(event.target.value); setResult(null); }}>
          {MODES.map(([value, name]) =>
            <option key={value} value={value}>{name}</option>)}
        </select>
        <div className="mh-perf-lab__result" aria-live="polite">
          {result
            ? <>帧间隔中位数 {result.median}ms · P95 {result.p95}ms
              <small>大于34ms的帧：{result.slow}/{result.count}</small></>
            : <>切换后滚动页面，显示粗略帧间隔。</>}
        </div>
        <small>相同设备/位置/速度比较。关闭效果只影响当前测试页的显示，不改财务数据。</small>
        <button type="button" onClick={() => { setMode("normal"); setResult(null); }}>
          恢复完整画面
        </button>
      </>}
    </aside>
  );
}
