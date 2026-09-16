---
id: m81-night-sky
title: "M8.1 night sky: ATMOS system — gradient dome + seeded stars + faint aurora band (camera-pinned, 3 draw calls)"
category: decision
status: active
tags: [m8, atmos, sky, night, aurora]
created: "2026-09-16T03:17:48"
updated: "2026-09-16T03:19:05"
---

<!-- compiled_truth -->
## Decided

- M8.1 adds the `ATMOS` system — the first sky/atmosphere subsystem. Registered after FX and before HUD (fixed boot order: …, PARTS, FX, **ATMOS**, HUD), exposed on `window.SIM.ATMOS`, tunables under `CFG.atmos`. It owns exactly 3 draw calls, all fog-off, all pinned to the camera every frame in `update()` ("at infinity"), so street / orbit / far-fly all see the same correct sky:
  - **Dome** — `SphereGeometry` r 2400 (inside the 3000 m far plane), `BackSide`, `MeshBasicMaterial` with a 1×256 canvas vertical gradient (zenith `#05070f` → horizon-glow `#16304f` at v 0.52 → void `#04060c` below the horizon), `fog: false`, `depthWrite: false`. Replaces the flat `scene.background` as the visible sky (background stays as the below-horizon/behind fallback).
  - **Stars** — one `Points` object, 1600 positions pre-allocated (seeded `mulberry32(0xA705)`, upper hemisphere r 2300, elevation 3.4°–90°, mostly cool / rare warm vertex colors), `PointsMaterial` additive, `sizeAttenuation: false` (2.5 px), shared `KIT.tex.glow` sprite, `fog: false`. Tier cap is `drawRange` only (high 1600 / med 900 / low 500 from `CFG.atmos.stars.tiers[TIER.active()]`) — zero allocation at any tier.
  - **Aurora** — open-ended `CylinderGeometry` (r 2250, h 300, 96 seg) at 480 m altitude, `BackSide`, additive, `opacity 0.45`, static 512×256 canvas of green-dominant curtains (seeded `mulberry32(0x5EED)`, 90 streaks, alpha fades out at both vertical edges — the material opacity does the final "faint" dimming), slow spin `rotation.y = t × 0.012`. Aurora x/z track the camera; y stays at the configured altitude.
- Design constraints that shaped the build: everything `fog: false` (the dome/stars/aurora must not be fogged out by the scene `FogExp2`), `depthWrite: false` on all three (the dome must not occlude the city, and additive layers must not write depth), dome radius 2400 < camera far 3000, stars radius 2300 < dome, aurora radius 2250 < dome. All three are `MeshBasicMaterial`/`PointsMaterial` (unlit — the sky is self-emissive; no light interaction, no per-frame material state).
- Visual gate (smoke M8.1 section): three camera distances — street (GROUND, y 4), orbit (CINE, y 60), far flyby (CINE, 700,140,700) — each looks ~14° up so the horizon-glow band, the low star band, and the ~11° aurora band are all in the sky region. Each pose gets an ATMOS-on/off screenshot pair decoded in-page (dataURL → 2D canvas); the sky region is the top 55 % of the frame at x ≥ 25 % (top-left corner holds the FPS HUD text — excluded). On must beat off on: mean luminance (dome), bright-pixel count > 120 (stars), greenish-pixel count `g > b+8 && g > r+8 && g > 25` (aurora). Measured: mean 5.4→15.2 / 10.2→25.5 / 8.6→26.2, bright 167→232 / 162→218 / 172→272, green 0→6780 / 0→7413 / 0→7517. Shots: `shots/m81-sky-{street,orbit,far}.png`.
- Smoke check notes: the "+3 draw calls" check samples the min over 6 frames per hidden/shown state and retries up to 3× — other systems add transient draw calls (drones, arcs) that make a single-sample delta flaky. The heap-flat window is pure animation frames only (camera teleports + `page.screenshot()` are harness costs, not ATMOS allocations).
- Environment note: aurora readability over a blue night sky is fragile — a teal palette at low opacity washes toward white and the green-dominant check (`g > b+8`) fails; the band palette is green-dominant (b channel well below g) so the additive contribution keeps green the max channel. If the aurora is ever re-tinted, keep `g` clearly above `b` and verify the green check still passes.


## Timeline

- time: 2026-09-16T03:17:48
  kind: decision
  summary: "Created this page: M8.1 night sky: ATMOS system — gradient dome + seeded stars + faint aurora band (camera-pinned, 3 draw calls)"
  source: M8.1 implementation
  affects: [m81-night-sky]

- time: 2026-09-16T03:19:05
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M8.1 implementation
  affects: [m81-night-sky]
