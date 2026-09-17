---
id: m91-idle-dormant-animation
title: "M9.1 idle/dormant animation: antenna sway + periodic 'dream' LED wave across the node grid (shader-less instance colors)"
category: decision
status: active
tags: [m9, entity, dormant, instance-color]
created: "2026-09-17T08:04:53"
updated: "2026-09-17T08:06:07"
---

<!-- compiled_truth -->
## Decided

- M9.1 extends the M5 `ENTITY` dormant idle (no new system). Tensor-ring idle spin and breathing-core scale already existed (M5); M9.1 adds **antenna sway** and the periodic **"dream" LED wave** across the compute node grid. All tunables in `CFG.entity` (`antennaSway`, `dream`).
- **Antenna sway**: small deterministic absolute tilt on each of the 4 mast groups — `rotation.x = amp·sin(t·speed + ph)`, `rotation.z = amp·cos(t·speed·0.83 + ph·1.7)` (amp 0.02 rad ≈ 0.24 m tip sway, speed 0.35 rad/s, phases in `ENTITY._antPh`). The mast child mesh is untouched; absolute-in-t ⇒ deterministic.
- **Dream wave**: a periodic radial LED sweep, **shader-less** — per-node `instanceColor = hue × (baseBrightness + glow × exp(−dd²/2σ²) × env)` where `dd = nodeDist − r`, `r = (t − t0)·speed` (16 m/s from origin `(0, 44, 0)`, head level), σ = 5 m; `env` fades linearly over the last 3σ past `maxR`. When the front exits (`r − 3σ > maxR`) the dormant base colors are **restored byte-exact** and `nextAt` re-seeded by a seeded `mulberry32` (`ENTITY._dreamRng`) into `[14, 26]` s (first wave 8 s after boot). All per-node arrays are pre-allocated at init (`_nodeBase`/`_nodeHue`/`_nodeBright`/`_nodePos`/`_nodeDist`, node capacity 4200) ⇒ heap flat, and **no per-frame instance upload between waves** (dormant idle stays still-ish).
- While the wave is active the core lifts with the front: `ENTITY._hero.intensity += 0.5·env`, `coreEye` color lerp `+0.45·env` on top of the dormant pulse.
- **Seams for M9.2+**: wave start is gated on `ENTITY.state === 'DORMANT'`; `ENTITY._dreamFrozen` pauses wave time (same pattern as `ATMOS._ltFrozen`) for the screenshot pair.
- **Smoke M9.1 section** (smoke/smoke.mjs): registration (pre-allocated data, wave idle, node grid dim — max instance color < 0.1); antenna sway within ±amp with mast children byte-static; timer fire (front node lit, ahead node still dim); sweep travel (B lit after, A dim again); resolves clean (instance colors byte-exact at base, interval re-seeded in range, draw calls unchanged); dormant idle byte-static across frames (no per-frame upload); heap flat across a wave; visual gate — street pose (72, 1.7, 55) yaw 0.92 pitch 0.30, fire the wave, freeze at r ≥ 18 via `_dreamFrozen`, capture the exact frozen wave colors, off/on screenshot pair around the projected creature core `(0, 44, 0)` (±12 %-frame region), 2-pair averaged, `shots/m91-dream-wave.png`.
- **Smoke flake fixes folded in** (both were M9.1-section races, not regressions): (1) the sweep-travel `page.evaluate` must **return `iA`/`iB`** — the check reads `w2.iB` and an absent field makes `undefined >= 0` fail the check even when the wave is correct; (2) **arm the timer atomically** — an auto-timer wave that starts between the idle check and the smoke's `nextAt = now + 0.2` write has its re-seeded `nextAt` clobbered (gap check then reads ~1 s instead of `[14, 26]`); the arm is a `waitForFunction` that writes `nextAt` only while the wave is idle and resolves on start (an auto wave that starts first is fine — its own re-seeded interval is what the gap check verifies).


## Timeline

- time: 2026-09-17T08:04:53
  kind: decision
  summary: "Created this page: M9.1 idle/dormant animation: antenna sway + periodic 'dream' LED wave across the node grid (shader-less instance colors)"
  source: created via brain create-page
  affects: [m91-idle-dormant-animation]

- time: 2026-09-17T08:06:07
  kind: decision
  summary: "M9.1 idle/dormant animation: antenna sway + periodic dream LED wave across the node grid (shader-less instance colors, byte-exact restore, pre-allocated, _dreamFrozen seam, DORMANT gate)"
  source: brain update-truth
  affects: [m91-idle-dormant-animation]
