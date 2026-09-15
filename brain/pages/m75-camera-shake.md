---
id: m75-camera-shake
title: "M7.5 camera shake: impulse decay consumed by CAMERA (Key N, capped, idle no-op)"
category: decision
status: active
tags: [m7, fx, shake, camera]
created: "2026-09-16T01:38:35"
updated: "2026-09-16T01:39:19"
---

<!-- compiled_truth -->
## Decided

- M7.5 completes the camera-shake contract: the system is the impulse-decay energy scalar that already lives on `CAMERA` (since M1) — `CAMERA.shakeEnergy`, drained by `_decayShake` (linear, `−dt × CFG.input.shakeDecay`, to exactly 0) and consumed by `_applyShake`, which recomputes a FRESH transient `camera.position` offset every frame and never writes into `CAMERA.pos` ⇒ nothing accumulates into the pose, and 0 energy ⇒ `_applyShake` early-returns ⇒ idle cost is structurally zero (no pool, no mesh, no material, no draw calls).
- M7.5's delta: manual dev trigger Key `N` (`INPUT.shakeTrigger`, consumed in `CAMERA.update` — the "consumed by CAMERA" seam) fires `CAMERA.shake(CFG.input.shakeImpulse)` (1.0). The previously hardcoded 1.5 cap moved to `CFG.input.shakeCap` (repeated triggers accumulate up to the cap and then hold — never run away), and `CFG.input.shakeImpulse` is the manual-trigger energy. HUD hint now reads `P particles · R pulse · T arcs · B flash · N shake`.
- `shake(intensity)` semantics: adds `max(0, intensity)` clamped to `shakeCap`; ≤ 0 is a no-op.
- No screenshot gate: a 0.22 m offset (shakeAmp 1.0-energy) is sub-pixel at every deterministic pose, so the smoke M7.5 section verifies analytically — strictly stronger than a picture: registration (tunables/API/energy 0/trigger idle); idle no-op (`_applyShake` at 0 energy leaves `camera.position` untouched); Key N ⇒ camera offset from the deterministic still pose, bounded by `shakeAmp × energy` at every sampled frame, and the offset magnitude varies frame to frame (fresh offset, real motion); decay monotone to exactly 0 with `camera.position` back EXACTLY on `CAMERA.pos` (off === 0); 10 rapid re-triggers hold at `shakeCap` (never exceed); `shake(10)` clamps to the cap, negative no-op; heap flat.
- Environment note: the pre-existing M6.2 "heap flat with the fleet alive" smoke check flakes in this headless env (~2.6–2.7 MB delta vs the 2 MB bound) — re-verified to fail at the pre-M7.5 baseline too (1 FAIL / 2 PASS in 3 baseline runs), environmental GC noise, not an M7.5 regression.


## Timeline

- time: 2026-09-16T01:38:35
  kind: decision
  summary: "Created this page: M7.5 camera shake: impulse decay consumed by CAMERA (Key N, capped, idle no-op)"
  source: created via brain create-page
  affects: [m75-camera-shake]

- time: 2026-09-16T01:39:19
  kind: decision
  summary: "Created this page: M7.5 camera shake — impulse decay in CAMERA, Key N dev trigger, capped energy, idle no-op"
  source: M7.5 implementation
  affects: [m75-camera-shake]
