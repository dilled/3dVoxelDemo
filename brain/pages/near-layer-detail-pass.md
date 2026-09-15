---
id: near-layer-detail-pass
title: "M4 near-layer detail: 5 pooled detail meshes per near chunk, seeded per-building salt, ring-2 zero-detail"
category: decision
status: active
tags: [m4, detail, instancing]
created: "2026-09-15T06:42:13"
updated: "2026-09-15T06:42:50"
---

<!-- compiled_truth -->
## Decision

M4 (near layer) adds per-building recognizability on top of the M3 mass,
without breaking the flat-draw-call budget. All animated/detail instances
live in **five pooled `InstancedMesh` per chunk** — `fan`, `dish`,
`pulse`, `sign`, `ledWin` — created only for ring 0/1 chunks (9 chunks,
≤ 5 extra draw calls each, ~32 total near). Everything static (pipes,
roof bits, masts) goes into the existing mass meshes (`boxA`/`boxG`/`cyl`).

- **Shared assets, no per-frame allocation.** Geometries/materials come
  from one `WORLD._detailAssets` bundle; materials are shared across all
  chunks (ledWin: 2 LED canvas variants; sign: 4 holo-sign variants)
  picked deterministically per chunk from `(cx*73856093 ^ cz*19349663)`,
  so every mesh stays one draw call.
- **Pulse is shared** across beacon / spark / fiber-dash (per-instance
  color, `instanceColor` preallocated at creation).
- **LED facade allocation is fair two-pass** (`_ledPass`): pass 1 gives
  every server/rack candidate (`h > 3`) one seeded facade (`salt & 3`),
  pass 2 a second one on a *different* seeded face; candidates sorted by
  salt for determinism. Cap 64/chunk — every candidate gets one face
  before any gets a second.
- **Per-building variation salt = the block seed** (`^ 0x9E3779B9`) —
  two neighbours can never share a detail layout.
- **Ring 2 (silhouette) gets zero detail** — the far layer stays a clean
  fog silhouette; detail only ever exists on ring 0/1.
- **Culling**: `InstancedMesh.computeBoundingSphere()` (r160) is
  instance-aware — computed once per mesh at fill time (pulse expanded
  for dash travel); per-mesh spheres make whole chunks frustum-cull.
- **Cool-pipe orientation**: pipe boxes are length along local +X and
  `add()` applies `rotY` via `setFromAxisAngle(+Y, θ)`, so the A→B pipe
  angle is `θ = −atan2(dz, dx)` (sign matters — verified against the
  kit helper source).
- **Deliberate delta**: front doors / cable trays / roof vents are not
  separate parts; lit facades + mass variation carry readability.
  Steam emitters wait on the M7 particle pool.

## Verification (headless smoke, `smoke/smoke.mjs` M4 section)

City-wide near totals: led=568, fan=151, pulse=318, sign=9, dish=8;
ring-2 all zero; detail matrices byte-identical across chunk regen;
fans+pulses animate; 32 draw calls near (flat vs M3). Screenshots:
`smoke/shots/m4-*.png`.


## Timeline

- time: 2026-09-15T06:42:13
  kind: decision
  summary: "Created this page: M4 near-layer detail: 5 pooled detail meshes per near chunk, seeded per-building salt, ring-2 zero-detail"
  source: "M4 implementation + smoke verification"
  affects: [near-layer-detail-pass]

- time: 2026-09-15T06:42:50
  kind: decision
  summary: "M4 done: near-layer detail pass design + verification"
  source: brain update-truth
  affects: [near-layer-detail-pass]
