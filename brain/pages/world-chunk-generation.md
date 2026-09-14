---
id: world-chunk-generation
title: "M3 chunked city: seeded WORLD grid, 16×16-block chunks, 8 archetypes, 3-ring LOD, flat draw calls"
category: decision
status: active
tags: [world, city, chunks, prng, instancing]
created: "2026-09-15T02:26:04"
updated: "2026-09-15T02:26:04"
---

<!-- compiled_truth -->
The `WORLD` system (registered between KIT and HUD) generates the far-layer city deterministically:

- **Determinism:** `mulberry32` PRNG; per-block seed = integer hash of (bx, bz) mixed with `CFG.city.seed` (0x51A7C3) → any chunk rebuilt later is byte-identical (smoke asserts `instanceMatrix` equality after `WORLD.regen(key)`). No visible duplication, no shimmer.
- **Grid:** 24 m blocks; avenues every 5 blocks radiating from center (they trace the ring roads); central plaza ±2 blocks kept clear for the M5 creature; small keep-out preserves the M2 test rig at (0,0,-80).
- **Chunks:** 16×16 blocks (384 m); 5×5 keep-set around the player chunk (Chebyshev R=2), on-demand build / unbuild-behind with a buffer pool (retired chunks are pooled, never disposed); per-chunk budget = building occupancy by LOD ring [0.92, 0.85, 0.78].
- **Archetypes (8):** server, rack, cool, sub, antenna, fiber, holo, housing — weights by zone (core <220 m / mid <520 m / outer), height falloff `0.35 + 0.65·e^(−d·0.0045)` from the plaza.
- **LOD rings:** 0 dense (mass + upper stages + cylinders), 1 mid, 2 silhouette (single box per building, tint pre-lerped 0.55 toward haze 0x16273f).
- **Draw calls:** ≤ 3 InstancedMesh per chunk (structural boxes / emissive boxes / cylinders) with per-instance colors; each mesh is frustum-culled via its own `computeBoundingSphere()` → flat as you fly (measured 37 near / 34 far; budget < 150).
- **Ground:** one 6240 m Lambert plane with a 120 m-period block-grid CanvasTexture (26 periods ⇒ lines stay world-aligned to the block grid).

Far layer = mass only; per-archetype detail (LED windows, fans, arcs, signs) is M4. The M2 gate rig is now inside the city (keep-out area) and the smoke M2 draw-call check hides `WORLD.root` while measuring.


## Timeline

- time: 2026-09-15T02:26:04
  kind: decision
  summary: "Created this page: M3 chunked city: seeded WORLD grid, 16×16-block chunks, 8 archetypes, 3-ring LOD, flat draw calls"
  source: M3 implementation
  affects: [world-chunk-generation]

- time: 2026-09-15T02:26:04
  kind: decision
  summary: "Created this page: M3 chunked city generation parameters and invariants"
  source: M3 implementation
  affects: [world-chunk-generation]
