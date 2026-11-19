# PR #60: Test-only visual bottleneck diagnostic

Context: User verified PR #56 smooth, PR #57–#59 still stuttering. The PR #59 expensive SVG-filter replacement passed 294/294 CI but did NOT solve real-device scrolling. We must not claim this is an SVG-only issue.

## Findings from code (not profiler claims)
- Premium theme still has multiple blended and shadowed backgrounds and ornate border images.
- Finance UI sticky cockpit uses `backdrop-filter: blur(14px)` even while opaque metal panel background is applied.
- Finance UI includes many persistent keyframe animations for orbit, notification and assistant.
- These are possible CPU/GPU paint/compositing costs. The source code alone does not establish which one causes jank.

## Minimal, reversible diagnostic
- App JS calculation logic is untouched. Only `src/main.jsx` conditionally mounts a separate `FinanceRenderDiagnostics` component when **both** the TEST Supabase URL guard is satisfied **and** URL has `?perfLab=1`.
- Lightweight panel has A/B toggles for original look, sticky blur, sticky position, animations, cosmic backdrop, metal panel decor, and combined low-effects mode.
- All modes only change `data-mh-perf-mode` CSS styling at runtime. No changes to data, transactions, synchronization, SQL, RLS, secrets or saved preferences.
- Panel samples requestAnimationFrame interval median / p95 and >34 ms frames after the user scrolls; it is not a Chrome Performance trace nor rigorous FPS benchmark. The overlay's own cost may slightly affect results. Compare the same content, device, viewport and approximate scroll speed.
- Click '恢复完整画面' or remove `?perfLab=1` to restore the original app experience exactly.

## What to compare
1. Scroll 3x each mode at same content and position. Record whether still stalls and p95, slow-frame count.
2. If only no-blur or no-sticky helps, target header compositor layering; if no-metal helps, focus on shadows/border painting; if no-animation helps, audit infinite animations; if no-space helps, optimize long root background.
3. Capture Chrome DevTools Performance trace if all individual toggles fail, to check JS, layout, Recharts and input handling.
4. Never merge diagnostic panel into Production. Keep separate, discard or revert after identifying actual cause.

## Safety & acceptance
Draft PR only, child of #59. CI + Vite + both dependency audits mandatory. Preview must remain Test-only and no real financial records. No evidence of actual FPS or Windows/Android improvement until observed on device.
