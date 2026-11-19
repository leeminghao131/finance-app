# MH Finance App · PR #57 Cosmic scroll performance hotfix · 2026-11-19

## Observed user repro
- On the same Windows computer/browser, **PR #56 scrolls smoothly while PR #57 visibly stutters**.
- PR #57 only added CSS/SVG visuals to PR #56; it did not change records, Supabase, money logic, Realtime, or chart data computations.
- The root dashboard uses `mh-ui mh-cosmic-pilot min-h-screen` and grows with the entire page.

## Code-level root cause hypothesis
- PR #57 `src/financeCosmicPremium.css` gave this tall root `background-size: cover` plus `background-attachment: fixed`.
- Its 1920×1200 `financeCosmicDeepSpace.svg` has expensive `feGaussianBlur`, `feTurbulence` and >500 drawing primitives. A `cover` background on a long scrolling element scales the *vector artwork to the height of the entire dashboard*, not merely the window. Repaint/compositing becomes expensive.
- The same CSS adds several metallic textures/shadows; these remain a secondary performance concern. Actual browser frame-time profiling has **not** been captured; root cause remains a strong code-supported hypothesis, not a measured guarantee.

## Minimal fix
- Change **only** the premium theme root background rules from `cover / no-repeat / fixed` to **`1920px 1200px / repeat / scroll`**. This bounds each vector tile to its native viewBox, avoids scaling to whole-document height and no longer pins the heavyweight filtered scene during scroll.
- Keep the exact same SVGs, CSS metalwork, app JSX and all its React components, financial arithmetic and data operations untouched.
- Existing small-screen `@media (max-width: 767px)` already uses its own `background-size:auto 980px; background-attachment:scroll` and remains unchanged.
- The star/planet pattern now repeats at a finite tile size as the page scrolls; the visual theme persists, though the background parallax/repetition may differ slightly from PR #57.

## Verification
- New `tests/finance-cosmic-scroll-performance.test.mjs` checks that the root scene cannot regress to unbounded `cover` or `fixed` and that all original SVG artwork/material panels and mobile sizing are retained.
- Existing entire Finance Safety workflow includes synthetic finance logic regression, Vite build, runtime npm audit and full toolchain audit.
- Browser performance telemetry / Windows & Android hands-on FPS measurements are still **pending** and cannot be inferred from `npm test` or a Vercel READY build.

## Safety, rollout and rollback
- Base exact PR #57 SHA: `392e1b4d18da5ad07d31453c5c33b41db7e2f443`.
- New Draft PR on **`fix/pr57-cosmic-scroll-render-2026-11-19`**; Vercel **Preview only** with existing fail-closed Supabase Test guard.
- No `main` merge, Production deployment, credential access, SQL, migration, Auth/RLS changes, or actual user financial record access.
- Rollback: use the prior PR #57 READY Preview (code snapshot), or revert the CSS-only commit on this test branch. Git rollback is never a substitute for database restoration.
