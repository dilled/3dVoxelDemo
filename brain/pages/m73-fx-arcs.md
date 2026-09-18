---
id: m73-fx-arcs
title: "M7.3 FX arcs: one shared LineSegments, per-N-frame bolt regen, two anchor types (Key T, tier-capped, idle 0 draw calls)"
category: decision
status: active
tags: [m7, fx, arcs, pool, tier]
created: "2026-09-16T00:05:39"
updated: "2026-09-18T07:44:37"
---

<!-- compiled_truth -->
## Decided

- M7.3 extends `FX` with electric arcs: ONE shared `THREE.LineSegments` (`FX.arcs`) with pre-allocated position+color `Float32Array`s (cap 8 arcs × 42 verts × 3) and a `LineBasicMaterial` (vertexColors, additive, `depthWrite:false`). `drawRange.count = arcCount × 42`. **`FX.arcs.visible = arcCount > 0` every frame** — three r160 does NOT skip drawRange-0 `LineSegments` (a visible 0-range mesh still costs a draw call; the M6.4/M7.1 "count-0 Points is free" assumption does not generalize to lines), so hiding the mesh at 0 live is what makes idle cost exactly zero added draw calls.
- An arc = a bolt: main 12-seg jittered polyline (sin-tapered perpendicular jitter, 0 at the anchors) + 3 forks (attached at main points 3/6/9, 3 segs each, brightness 0.55) = 21 segs = 42 verts. Pool `fx-arc` (M6.1), capacity = HIGH tier cap 8 (`CFG.fx.arcs.tiers` {high:8, med:5, low:3}); item `{ax..bz, age, life:2.2, cR..cB, j: Float32Array(48)}` — the 48-float jitter scratch is pre-allocated (46 used: main 22 + forks 24).
- Regeneration is the point of the milestone: every `N = CFG.fx.arcs.regenFrames` (3) frames, each live arc's jitter array `j` is refilled with `Math.random` and its 42-vert slot rebuilt in place — zero `new` per frame, verified: over 12 rAF frames `_arcTick` hits 0 exactly 4× and the position-buffer hash changes exactly 4×. `FX._arcTick` advances only while `arcCount > 0`.
- Per-vertex color = tint × sin(πu) × brightness (main 1.0, forks 0.55) — the bolt is brightest mid-span and dark at the anchors (this is why a bolt whose visible span is only its endpoint zone is nearly invisible). Tier trim = farthest-by-midpoint release (same pattern as pulse/fleets).
- `FX.arc(a, b, color)` is the public API (seams: M9.4 substation cascade, M13.4 EM discharge; audio crackle M11.3). Dev trigger: Key `T` (`INPUT.arcTrigger`, consumed in `FX.update`) fires exactly 2 arcs: (1) substation↔substation — the two nearest `PARTS._subList` buildings to `CAMERA.pos` (nearest-two selection with `da/db` init **Infinity** — a -1 init silently selects nothing with `<` comparisons), anchors at `hTop + 0.5`; (2) creature→ring — `ENTITY.parts.antenna1` world tip +12.4 m y → a point on the ring lane `x = CFG.traffic.ringLane` (132) at a random vehicle altitude [70, 95, 120], |z| ≤ 60. HUD hint now reads `P particles · R pulse · T arcs`.
- Smoke M7.3 section: FX registered (cap 8, 42 verts, drawRange 0 idle); idle parity — arcs hidden at 0 live + stable call count; Key T ⇒ both anchor types with endpoints on the real substations (distinct) / antenna tip / ring lane (`sub=true/true, aOk, bOk`), exactly +1 draw call (the one shared mesh); zero-`new` pool identity; regen every-N (MUST be sampled before the 60-frame delta window — arcs expire at 2.2 s and headless runs ~28 fps ⇒ 60 frames ≈ 2.1 s); frame-cheap rAF deltas (≤ 2× baseline, 100 ms floor); LOW trims 8→3; HIGH holds all 8 (arcs do not respawn like fleets — "restore" is re-fire 5 while the 3 survivors are alive); clean resolve; heap flat; screenshot `smoke/shots/m73-arcs.png`.
- Screenshot pose is deterministic: city is seeded (0x51A7C3, identical every run/refresh), camera (-180, 40, 180) vel 0, **fov reset to 60** (the 6e wheel-zoom smoke test leaves fov ≈ 57.8 for the rest of the run, which scales projections outward from screen center and pushed the tight endpoint off-frame), yaw 2.22, pitch -0.35, 900×600. The check projects all 4 live arc endpoints and asserts in-frame (`inFrame`); tightest endpoint has 106 px margin. The sub bolt reads clearly (zigzag + fork); the creature→ring bolt's tip is visible and its mid-section is occluded by the mid-blocks (correct depth test — the ring lane sits behind them from this corner).
- Also fixed in the M7.3 pass: the M7.2 screenshot state read (`shotSt`) moved BEFORE the screenshot — reading the light after the screenshot delay let u drift past the sin² peak and flaked the `light > 4000` assertion.


## Timeline

- time: 2026-09-16T00:05:39
  kind: decision
  summary: "Created this page: M7.3 FX arcs: one shared LineSegments, per-N-frame bolt regen, two anchor types (Key T, tier-capped, idle 0 draw calls)"
  source: M7.3 implementation
  affects: [m73-fx-arcs]

- time: 2026-09-16T00:06:44
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M7.3 implementation
  affects: [m73-fx-arcs]

- time: 2026-09-18T07:44:37
  kind: decision
  summary: "M9.4: new public API FX.dropArc(it) — swap-remove + pool release of one live arc item even mid-life (no-op for foreign/released items). Used by the M9.4 cascade teardown to drop live substation bolts at DORMANT entry."
  source: M9.4 implementation
  affects: [m73-fx-arcs, m94-city-cascade]
