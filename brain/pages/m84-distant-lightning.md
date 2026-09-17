---
id: m84-distant-lightning
title: "M8.4 distant lightning events: far-point strike with hemi bump + flash + EM discharge ring across the city in ATMOS"
category: decision
status: active
tags: [m8, atmos, lightning]
created: "2026-09-17T06:46:17"
updated: "2026-09-17T06:47:22"
---

<!-- compiled_truth -->
## Decided

- M8.4 adds distant lightning events, owned by `ATMOS` (no new system). `ATMOS.ltGroup` holds exactly two fog-off additive meshes: a **point-flash sprite** (`Sprite` on the shared `KIT.tex.glow`, `toneMapped: false`, flicker `0.75+0.25·sin(t·55)` over a `flashDur` 0.5 s window at the far strike point) and the **EM discharge ring** (`RingGeometry(0.6, 1.0, 64)` rotated to XZ — a 0.4R-wide annulus band, not a hairline, so it reads at distance; `MeshBasicMaterial` additive, `fog: false`, `depthWrite: false`, `frustumCulled: false`). Both `visible = false` while idle ⇒ **0 draw calls** at idle. All tunables in `CFG.atmos.lightning`.
- **Per fire** (`ATMOS._fireLightning(x, z, alt)` — optional args = re-fire at a known point, the dev/smoke seam): strike at a random far point (seeded `mulberry32(CFG.city.seed ^ 0x517C)`, dist 700–1400 m, altitude 220–380 m) plays: brief `KIT.hemi.intensity` bump (base + boost 2.0, decay 3.0/s — re-synced every frame so it *always* settles back to exactly `CFG.lights.hemiIntensity`), `FX.flash(0.5, 0xdcebff)` screen flash (M7.4 seam), the sprite flash, the EM ring (ease-out expansion 2→950 m over 2.6 s, `sin(u·π)·0.9` tint fade — additive ⇒ color *is* the light), and 16 lightning motes via the new public `PARTS.lightning(x, z, n)` (reuses the pooled 'light' pool through a new `_spawnLightAt(it, cx, cz)` shared with the camera-relative rain path; pool-capped, zero `new`).
- **Triggers** — auto on a seeded timer (`every: [16, 32]` s, `firstDelay: 10` s) + manual **Key L** (`INPUT.lightningTrigger` edge, same pattern as the other dev triggers). HUD hint extended with `L lightning`.
- **Smoke M8.4 section** (smoke/smoke.mjs): registration (both meshes fog-off additive in `ltGroup` under `ATMOS.root`, idle hidden, hemi at base, FX/PARTS idle, timer suppressed); Key L fire (far point in CFG range, ring/flash positions exact, hemi above base, flash > 0, motes === 16); point-flash billboard exactly **+1 draw call** when shown; screen flash decays; EM ring exactly **+1 draw call** (median of 3 on/off pairs) and expanding; hemi decays to **exactly base** and the event resolves clean; auto timer fires exactly one event and re-seeds into `[16, 32]`; motes age out (0 live); visual gate — plaza-side pose 300 m out / 300 m up, pitch −0.7854, re-fire at the last strike point, `waitForFunction(emRing.scale.x >= 700)` then freeze event time (`ATMOS._ltFrozen` — holds event age without pausing the sim), on/off `ltGroup` screenshot pair, 2-pair averaged ±5 %-frame-height strip centred on the projected far annulus edge (computed in-page via `SIM.project`), `shots/m84-lightning.png`; heap flat. The auto timer is suppressed (`ATMOS._ltTimer = 1e9`) after *each* START click, because the re-entry refresh re-seeds it and a live event would add 2 draw calls + hemi/flash bumps into earlier sections' measurements.
- **Camera trap (cost a debug run): altitude set during a mode blend sticks.** The ground clamp `pos.y += (clamp(pos.y, 0.7, 40) − pos.y) · (1 − blend)` is active while the GROUND→CINE mode blend runs (0.55 s). Setting `CAMERA.pos.y = 300` at `setMode('CINE')` time lets the clamp pull it down mid-blend and it then **sticks at an intermediate altitude** (observed 185.67 m) — velocity is zero and nothing pushes it back up. Smoke poses that fly above `groundMaxY` (40 m) must `setMode` first, wait ≥ 0.8 s for the blend to settle, *then* set `pos.y` (M8.4 lightning pose does this; M8.1/M8.3 poses with y = 60–80 m are silently affected but their gates tolerate the ~10–20 m error).
- **Smoke flake fixes folded in** (pre-existing timing races, not M8.4 regressions): M7.4 — read `FX._flash` *before* the screenshot (a headless screenshot can take >100 ms and the flash decays at τ = 0.3 s, so a post-shot read races the decay); M7.5 — the shake-offset bound must use the energy **at sampling start** (the sampled offset comes from the last rendered frame whose energy is ≥ the currently decaying one, so a frame-stale offset can exceed `amp × energy_now`); M8.1 sky gate — 2-pair averaged on/off stats (the off-shot sky region contains live traffic — drones/sky vehicles — so single-pair bright-pixel deltas wander around the threshold).


## Timeline

- time: 2026-09-17T06:46:17
  kind: decision
  summary: "Created this page: M8.4 distant lightning events: far-point strike with hemi bump + flash + EM discharge ring across the city in ATMOS"
  source: created via brain create-page
  affects: [m84-distant-lightning]

- time: 2026-09-17T06:47:22
  kind: decision
  summary: "M8.4 distant lightning events: ATMOS-owned far-point strike (hemi bump + FX.flash + fog-off point-flash sprite + fog-off EM discharge annulus + PARTS lightning motes), seeded auto timer + Key L, 0 draw calls idle"
  source: brain update-truth
  affects: [m84-distant-lightning]
