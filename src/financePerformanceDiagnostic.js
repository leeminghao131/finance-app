// Read-only A/B performance diagnosis, allowed ONLY on a Vercel Preview hostname.
// No Supabase imports, requests, app state writes, finance data or storage.
export const FINANCE_PERF_MODES = Object.freeze(["baseline", "i18n-off", "paint-lite", "both", "texture-off", "shadow-off", "motion-off"]);
export const FINANCE_PRODUCTION_HOST = "finance-app-ivory-theta.vercel.app";

export function resolveFinancePerformanceMode({ tier, hostname, search }) {
  const host = String(hostname || "").trim().toLowerCase();
  if (tier !== "preview" || host === FINANCE_PRODUCTION_HOST ||
      !host.endsWith(".vercel.app")) return "normal";
  const requested = new URLSearchParams(String(search || "")).get("mh_perf");
  return FINANCE_PERF_MODES.includes(requested) ? requested : "normal";
}

export function currentFinancePerformanceMode() {
  if (typeof window === "undefined") return "normal";
  const tier = typeof __MH_VERCEL_ENV__ === "string" ? __MH_VERCEL_ENV__ : "unknown";
  return resolveFinancePerformanceMode({
    tier, hostname: window.location.hostname, search: window.location.search,
  });
}
export function financePerformanceSkipsTranslation() {
  const mode = currentFinancePerformanceMode();
  return mode === "i18n-off" || mode === "both";
}

// Small passive frame monitor: browser metrics only, never reads financial or user data.
// Visible only on an explicitly enabled Preview diagnostic URL.
export function startFinancePreviewFrameMonitor() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const mode = currentFinancePerformanceMode();
  if (mode === "normal") return () => {};
  document.documentElement.dataset.mhPerfDiag = mode;
  const panel = document.createElement("aside");
  panel.setAttribute("data-i18n-ignore", "");
  panel.setAttribute("aria-label", "Temporary preview performance diagnosis");
  panel.className = "mh-perf-debug-panel";
  panel.textContent = "DIAGNOSTIC " + mode + " · Measuring frames…";
  document.body.appendChild(panel);
  let stopped = false, frame = 0, start = 0, previous = 0, total = 0;
  let delayed = 0, biggest = 0, longTasks = 0;
  let observer = null;
  try {
    if (typeof PerformanceObserver !== "undefined" &&
        PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      observer = new PerformanceObserver(entries => { longTasks += entries.getEntries().length; });
      observer.observe({entryTypes:["longtask"]});
    }
  } catch { observer?.disconnect(); observer = null; }
  const tick = now => {
    if (stopped) return;
    if (document.visibilityState === "visible") {
      if (!start) { start = now; previous = now; }
      const dt = now - previous;
      if (dt > 50) delayed++;
      if (dt > biggest && dt < 2000) biggest = dt;
      previous = now;
      total++;
      const period = now - start;
      if (period >= 4000) {
        const fps = Math.round(total * 1000 / period);
        panel.textContent = "DIAGNOSTIC " + mode + " | FPS " + fps +
          " | Frames >50ms " + delayed +
          " | Max gap " + Math.round(biggest) + "ms" +
          " | Long tasks " + longTasks +
          " | Preview only";
        start = now; previous = now; total = 0; delayed = 0; biggest = 0; longTasks = 0;
      }
    } else {
      start = 0; previous = 0; total = 0; delayed = 0; biggest = 0; longTasks = 0;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    panel.remove();
  };
}
