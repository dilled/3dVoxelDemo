---
id: m82-fog-zone-tint
title: "M8.2 fog depth tune + zone-tinted haze: tuned FogExp2 density + cyan-core/warm-avenues fog color lerp in ATMOS"
category: decision
status: active
tags: [m8, atmos, fog, haze, zone]
created: "2026-09-16T04:21:26"
updated: "2026-09-16T04:22:11"
---

<!-- compiled_truth -->
## Decided

- M8.2 tunes the scene `FogExp2` depth and adds zone-tinted haze, both owned by `ATMOS` (no new system). All tunables live in `CFG.atmos.fog`:
  - **Depth tune** — `density: 0.0028` (moved out of `CFG.color.fogDensity`, which was 0.004). Analytic FogExp2 factor `1 − exp(−(ρ·d)²)`: f(100 m) = 7.5 % (street range clear), f(500 m) = 85.9 % — distant structures survive as readable silhouettes (the old 0.004 swallowed 98.2 % at 500 m: the void took over). `scene.fog` is still created once at boot (`new THREE.FogExp2(CFG.color.fog, CFG.atmos.fog.density)`); `CFG.color.fog` is only the boot color.
  - **Zone-tinted haze** — `ATMOS.update` lerps `scene.fog.color` every frame: smoothstep on camera XZ distance from the central plaza across the M3 zone boundaries (`zone: { core: 220, outer: 520 }` m): cyan core `0x081726` → warm outer avenues `0x241a10`. All fog colors are pre-allocated in `ATMOS.init` (`_fogCore/_fogOuter/_fog`, `_tintCore/_tintOuter`) ⇒ zero per-frame allocation.
  - **Dome horizon tint sync** — `ATMOS.dome.material.color` lerps between `domeTint: { core: 0xd9e6ff, outer: 0xffe3d0 }` so the sky horizon matches the haze (material color multiplies the gradient map; the M8.1 canvas texture is untouched).
- The zone lerp is camera-relative (not per-pixel): standing in the core the whole scene haze is cyan; flying out past 520 m it is warm. That is the intended "zone tint visible flying across zones" behavior.
- Smoke M8.2 section (smoke/smoke.mjs): analytic checks — fog factor bounds at 100/500 m, fog color at core/mid/outer poses (cyan-dominant → warm-dominant, mid-zone exactly the lerp midpoint at k = 0.5), dome tint sync; visual gates — 500 m fog-on/fog-off screenshot pair (city-region mean luminance + horizontal edge detail survive the haze), core/outer zone shots (city-region warmth = mean R − mean B measurably higher in the outer zone). Shots: `smoke/shots/m82-fog-{500m,core,outer}.png`.
- Harness trap: the fog-off reference shot must use `scene.fog.density = 0`, NOT `scene.fog = null` — `ATMOS.update` reads `scene.fog.color` every frame, and a null fog throws inside the frame loop's per-subsystem try/catch, which **silently disables the subsystem** (`s.update = null`) and shows the HUD "Subsystem disabled" banner; the smoke "zero uncaught page errors" check does NOT catch this (the error is caught), so the M8.2 section asserts `systems.every(s => s.update !== null)` after touching `scene.fog`.


## Timeline

- time: 2026-09-16T04:21:26
  kind: decision
  summary: "Created this page: M8.2 fog depth tune + zone-tinted haze: tuned FogExp2 density + cyan-core/warm-avenues fog color lerp in ATMOS"
  source: M8.2 implementation
  affects: [m82-fog-zone-tint]

- time: 2026-09-16T04:22:11
  kind: decision
  summary: "M8.2 fog depth tune + zone-tinted haze: density 0.0028 in CFG.atmos.fog, fog color smoothstep lerp cyan core → warm outer avenues by plaza distance, dome horizon tint sync"
  source: M8.2 implementation
  affects: [m82-fog-zone-tint]
