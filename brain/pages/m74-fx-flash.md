---
id: m74-fx-flash
title: "M7.4 FX flash: screen-space additive overlay plane (Key B, decays to zero, idle 0 draw calls)"
category: decision
status: active
tags: [m7, fx, flash, overlay]
created: "2026-09-16T00:57:44"
updated: "2026-09-20T05:39:47"
---

<!-- compiled_truth -->
## Decided

- M7.4 extends `FX` with a screen-space flash: ONE additive plane (`PlaneGeometry(2,2)`, `MeshBasicMaterial` toneMapped:false, depthTest/depthWrite false) in a dedicated overlay `THREE.Scene` (`FX._flashScene`) + ortho NDC camera (`FX._flashCam`), rendered after the main scene ONLY while `FX._flash > 0`. Material color = tint × level IS the additive amount. 0 flash ⇒ plane hidden ⇒ exactly zero added draw calls.
- **Renderer info accounting change (durable, affects every later draw-call check):** `renderer.info.autoReset = false` + `renderer.info.reset()` once per frame in `frame()` before the main render — with the default autoReset, the second per-frame render call (the overlay) would zero the reported `info.render.calls` for the main scene. Per-frame call count now = main + overlay (1 while a flash is alive); idle frames are unchanged, so all pre-existing smoke call-count reads stay valid.
- `FX.flash(intensity, color)` is the public API (seams: M8.4 lightning, M9.3 beat-1 flare, M13.4 EM discharge). Level clamps to 0..`CFG.fx.flash.max` (1); re-trigger = max(current, intensity) — never accumulates; `intensity ≤ 0` is a no-op; color accepts `THREE.Color` or hex, omitted ⇒ default `CFG.fx.flash.color` (0xcfe8ff). Exponential decay τ = `CFG.fx.flash.decay` — **0.22 s after the M14.3 tuning** (0.30 → 0.22: crisper, no lingering; verified in the M14.3 feel pass: Key B flash resolves monotonically to exactly 0 in ~1.13 s measured, plane hidden again) — with a snap to exactly 0 at < 1/256 ⇒ the plane hides itself.
- Dev trigger: Key `B` (`INPUT.flashTrigger`, consumed in `FX.update`) fires `FX.flash(max, default tint)`. HUD hint now reads `P particles · R pulse · T arcs · B flash`.
- Smoke M7.4 section: registration (additive plane in a separate overlay scene, hidden at 0; autoReset off); idle parity (overlay not rendered ⇒ stable call count); Key B ⇒ exactly +1 draw call (the overlay plane) with material color = tint × level; monotone decay to exactly 0 + clean resolve (calls back to idle); API semantics (clamp / no-op / re-trigger / color honoured + default reset); heap flat; screenshot `smoke/shots/m74-flash.png` — full-screen flash at the deterministic M7.3 pose, verified by mean-luminance comparison against the idle shot at the same pose (decoded in-page via dataURL → 2D canvas).
- Note: the pre-existing M6.2 "heap flat with the fleet alive" check flakes in the current headless environment (~2.6 MB delta vs the 2 MB bound); verified to fail identically at the pre-M7.4 HEAD baseline — environmental GC noise, not an M7.4 regression.


## Timeline

- time: 2026-09-16T00:57:44
  kind: decision
  summary: "Created this page: M7.4 FX flash: screen-space additive overlay plane (Key B, decays to zero, idle 0 draw calls)"
  source: M7.4 implementation
  affects: [m74-fx-flash]

- time: 2026-09-16T00:58:18
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M7.4 implementation
  affects: [m74-fx-flash]

- time: 2026-09-20T05:39:47
  kind: decision
  summary: "M14.3 tuning: CFG.fx.flash.decay τ 0.30 → 0.22 s (crisper, no lingering); Key B flash verified monotone to exactly 0 in ~1.13 s, plane hidden again"
  source: "M14.3 polish pass (99ebced)"
  affects: [m74-fx-flash]
