---
id: entity-system-m5
title: "M5 ENTITY: the Qwen machine-creature (dormant) — plaza rig parts, node voxels, dormant idle state"
category: decision
status: active
tags: [entity, m5, creature, instancing]
created: "2026-09-15T08:12:39"
updated: "2026-09-15T08:12:40"
---

<!-- compiled_truth -->
ENTITY is the 6th system in the fixed boot order (INPUT → CAMERA → KIT → WORLD → **ENTITY** → HUD), registered between WORLD and HUD in `index.html`. It builds the dormant Qwen machine-creature at the central plaza (WORLD already keeps ±2 blocks = 48 m clear) in `ENTITY.root`, a `THREE.Group` added directly to the scene — independent of `WORLD.root`.

## Structure (procedural, whole scene ≈ 37 draw calls / ~69 k tris)
- **pedestal**: 3-step darkened mega-core platform (cyls 0 → 5.6 m, r 21 / 17.5 / 14), one merged mesh, near-black Lambert (0x141c2a).
- **spine / torso / head / jaw / shoulderL·R / armL·R / antenna1..4**: merged-geometry meshes (`KIT.mergeGeometries`) on a dedicated Standard "hero body" material (0x5b6b82, rough 0.5, metal 0.7, faint emissive 0x0a1826 × 0.5 so the silhouette volume reads on key-light-opposite faces). Layout: spine 5.6–18.6 m (3 tiers), torso 18.6–43.6 m (14 → 12 → 9.5 m tiers + neck 4.5 m), head Group at neck pivot y 43.6 (skull + brow + crown to 52.6 m), `coreEye` 5.2×1.8 unlit emissive bar at z 4.0 / y ≈ 47.2 (color IS the emissive), jaw Group pivoted at its top edge, shoulders = cooling-tower cyls (base 30 m, caps to 39.8 m) at x ±12.5, arms hang at x ≈ ±13–15 down to ~15 m (pad / upper / elbow / forearm / hand / fingers), antennas: 2 head masts to 64.6 m + 2 shoulder masts to 47.8 m with additive-glow tips.
- **ringA/B/C**: tori (R 8.5/11/14.5, tube 0.45/0.4/0.35) at y 46.8/43/33, base-tilt quaternion (Euler x 1.25 / −1.3 / 1.52, y 0 / 0.55 / −0.4), shared dim unlit Basic (0x1d4c60); idle spin about local z at 0.06 / −0.045 / 0.035 rad/s, set as absolute `t * speed` ⇒ deterministic.
- **computeNodes**: ONE `InstancedMesh` (`KIT.InstancedBox`, capacity 4200, **2,132 instances** at M5) with `MeshBasicMaterial` white + per-instance color (unlit ⇒ color IS emissive). Seeded placement `mulberry32(CFG.city.seed ^ 0x51A7E5)`: ±X/±Z grids on torso / spine / head facades (eye zone on the +Z head face skipped), circles on pedestal rims (r 13.3/16.8/20.3), node bands on the ring planes (in-plane basis from the ring quaternions), shoulder caps, arm columns, crown. Dormant colors ≈ 1 % dim (brightness 0.004–0.073; ~5 % amber / ~73 % cyan / rest blue-violet; 7 % dead nodes).
- **steamDrip**: one `Points` (32 pooled puffs, 4 vents: 2 shoulder caps + 2 chest vents), additive glow-sprite `PointsMaterial` (size 2.6, vertexColors, depthWrite off); per-puff loop life 6–10 s (seeded offsets), rises 7 m with sway, per-vertex alpha (black = invisible).
- **lighting**: claims `KIT.heroLights[0]` (color 0x6fd8ff, pos (0, 47.2, 5.5), intensity 0.9 + 0.3·k); `heroLights[1]` stays reserved for the M9 flare.

## Named rig parts (M9 contract)
`ENTITY.parts`: pedestal, spine, core (the breathing Group), torso, head (Group, pivot at neck y 43.6), coreEye (mesh), jaw (Group, pivot at top edge), shoulderL/R (Groups at y 30), armL/R (Groups at y 37.5), antenna1..4 (Groups at base positions), ringA/B/C (Groups; `children[0]` is the torus mesh whose `rotation.z` is the spin), steam. `ENTITY.state = 'DORMANT'`; `window.SIM` exposes ENTITY.

## Dormant animation (`update(dt, t)`)
- breathing: `core.scale = 1 + 0.008·sin(t·0.6)` (period ≈ 10.5 s); the core Group holds torso + chest panels + head + jaw — spine / shoulders / arms / pedestal stay put.
- coreEye dim pulse: Basic color lerped 0x173d52 → 0x3f96cc with k = 0.5+0.5·sin(t·0.6); hero light #0 pulses on the same k.
- rings: `children[0].rotation.z = t * speed` (absolute, deterministic).
- **node matrices are static while dormant** — no per-frame instance upload; M9 will animate the nodes via instance color (radial ignition wave).
- steam: 32 points updated per frame (trivial).

## Smoke (`smoke/smoke.mjs` "M5" section, all green)
- fixed order now includes ENTITY; all 17 named parts present; one InstancedMesh with ≥ 2000 nodes + instanceColor; breathing scale moves and stays in [0.98, 1.05]; ring A/B counter-spin; coreEye hex changes over ~1.2 s; node matrices byte-static; steam moves; draw calls < 150 (measured 37 — M4 was 32; the extra creature calls are partly frustum-culled at street range).
- screenshots `smoke/shots/m5-street-close.png` (45 m, dwarfed-up), `m5-street-full.png` (~90 m), `m5-mid.png` (~180 m), `m5-far.png` (~250 m). Fog (FogExp2 0.004) swallows the creature beyond ~250 m, so "far" stays inside the fog limit. Visual gate verified: reads as a dormant colossal machine from street level; silhouette (pedestal + tapered torso + ringed head + antennas) holds at all three distances.

## Ripples into earlier checks (deliberate)
- M1 fixed-order check expects `INPUT, CAMERA, KIT, WORLD, ENTITY, HUD`.
- M2 gate hides `WORLD.root` **and `ENTITY.root`** to measure the KIT test rig alone (still 8 calls).
- M3 7d (flat draw calls when flying far) hides `ENTITY.root` during measurement: the 65 m creature is frustum-wise pose-dependent (head / antennas / rings clip above the 30° vertical half-FOV at street range ⇒ culled at spawn but fully in-frame at 1600 m), which would pollute the city-LOD flatness signal.
- HUD shows an `AI DORMANT` state line (M9/M14 will use it).

## Open / next (M9 onward)
- M9: awakening beats on the same parts — head lift, jaw, ring speed-up, node ignition via instanceColor, coreEye flare + `heroLights[1]`, arcs; state machine DORMANT → STIR → AWAKE → DECAY. Heartbeat audio is M11.
- M14: quality tiers can scale node count / steam (single InstancedMesh — cheap to slice).


## Timeline

- time: 2026-09-15T08:12:39
  kind: decision
  summary: "Created this page: M5 ENTITY: the Qwen machine-creature (dormant) — plaza rig parts, node voxels, dormant idle state"
  source: created via brain create-page
  affects: [entity-system-m5]

- time: 2026-09-15T08:12:40
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: "M5 implementation + smoke verification, branch feature/auto-milestones-20260915-003726"
  affects: [entity-system-m5]
