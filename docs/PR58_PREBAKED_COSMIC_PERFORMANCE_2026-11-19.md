# PR #59 — Bake costly cosmic filters while preserving high-detail steampunk UI

Date: 2026-11-19 (MYT). Base: PR #58 `edd7278aa4b3c89d6a6f31b0e1f3edc89ec06a04`.

## Observed vs hypothesis
- User experienced smooth scrolling on PR #56 and stutter on PR #57 and PR #58 on the same Windows machine.
- PR #58 limited/repeated the background instead of scaling it to full page height, but kept live `feGaussianBlur`/`feTurbulence`.
- Source inspection found seven very large filtered nebula ellipses, one live filtered planet overlay, and a repeating filtered metal texture used on several cards.
- This is a code-level bottleneck hypothesis. Chrome Performance traces, Android FPS and visual acceptance have **NOT** yet been obtained.

## Changes in this isolated Preview branch
1. New `src/financeCosmicDeepSpaceStatic.svg` preserves stars (500+), brass pipes/gears, planet and orbital rings, gradients and dimensions. Replaces seven runtime 62px Gaussian blurs with carefully stopped radial-gradient glows and replaces turbulent planet overlay with a precomputed light-gradient haze; zero SVG filter primitives in active scene.
2. New `src/financeHammeredSteelGrain.png` is a 128x128 RGBA deterministic precomputed grain tile. The active premium CSS now reuses its cached bitmap rather than invoking per-tile SVG turbulence.
3. `src/financeCosmicPremium.css` only swaps local presentation asset URLs; original nine-slice brass frame, shadows, Transfer, Heatmap, Top5, cockpit, icons and mobile rules remain intact.
4. PR #57/#58's original filtered SVGs remain **unchanged**, so a revert is straightforward. Tests which previously demanded that expensive effects be present are updated to expect the active static alternatives, and a new focused regression suite checks the active scene and PNG signature.
5. No new package, paid API, remote asset, scroll handler, animation, JS state, forms, Auth, RLS, database writes, history changes or core financial CRUD modifications.

## Verification and manual performance gate
- Run full existing synthetic finance tests, locked Vite build, both dependency audits for the exact code commit.
- Use Chrome DevTools Performance + Rendering Paint Flashing on **PR #56/#57/#58/#59** with the same Windows browser/device, viewport, and synthetic Test records; compare scroll frame time, GPU/paint/composite and dropped frames, not merely build status.
- In Android test scroll, ring touch controls, popups, long lists, notification hover/taps and visuals. Ensure gradient glow/planet/brass texture maintain desired premium appearance; tweak static color stops only if necessary.
- If still stuttering, separately isolate box-shadows / nine-slice borders / repeated panels by temporary DevTools changes and capture a frame-time trace before another structural change. Do not blindly enable containment or will-change on finance cards.

## Rollback and production isolation
- New Draft PR based on PR #58, Preview only, TEST-only fail-closed Supabase guard inherited.
- Revert CSS asset URL commit or use PR #56 Preview for smooth-scrolling comparison. Original assets preserved.
- **No merge into main, no Production, no Supabase migration/write.** Final publication still requires verified encrypted database backup + restore rehearsal, migration compatibility/RLS review, separate owner approval and Windows/Android acceptance.
