---
id: m83-light-shafts
title: "M8.3 volumetric light shafts: additive fog-off cones from nearest fiber spires + creature core in ATMOS"
category: decision
status: active
tags: [m8, atmos, shafts, lighting]
created: "2026-09-17T00:28:18"
updated: "2026-09-17T00:28:59"
---

<!-- compiled_truth -->
## Decided

- M8.3 adds volumetric-ish light shafts, owned by `ATMOS` (no new system). `ATMOS.shaftGroup` holds **4 spire slots + 1 creature core cone** — open-ended cylinders (`CylinderGeometry(rTop 0.4, rBottom 8, len 90, 10, 1, true)`), `MeshBasicMaterial` additive (`AdditiveBlending`), `fog: false`, `depthWrite: false`, shared 1×128 canvas gradient texture (bright at the tip → 0 at the base). All tunables in `CFG.atmos.shaft`.
- **Activation** — a 2 s nearest-N scan (`ATMOS._refreshShafts`, pre-allocated `_best` scratch, zero per-frame allocation) pins each slot to the nearest seeded **fiber spire** within `radius: 130` m (replayed through `WORLD.buildingAt`, so anchors are always real seeded spires). `visible = opacity > 0` ⇒ a hidden shaft costs **0 draw calls**. The core cone activates near the plaza (`coreRadius: 170` m) OR during any non-DORMANT entity state — the M9 awakening seam. Tier cap trims by slot count (`tiers: high 4 / med 2 / low 1`); opacity eases at `fade: 2.5`/s (no pop in/out).
- **Design constraint that shaped the geometry** — the spires themselves are only 4.5–6 m wide, so a cone base radius of 5 m is *barely* wider than the spire and the shaft is invisible (on/off pixel diff ≈ 0). `rBottom: 8` makes the column clearly wider than the spire; the visible part is the ±(rBottom − spireHalfWidth) band around the spire silhouette, which is what the visual gate measures.
- Smoke M8.3 section (smoke/smoke.mjs): far pose = deterministic golden-angle spiral search for a spire-free 130 m disc (200–1600 m out); near pose = street pose with a fiber spire 30–45 m out (≥30 m so the cone is not hidden behind the spire mass). Gates: far — every shaft hidden + group on/off draw-call delta 0; near — anchors replay through the seeded path, and the delta equals the **in-frame count computed as the exact renderer culling test** (6 frustum planes of P×V vs the cone bounding sphere, same as `WebGLRenderer` — a cone is drawn even when its tip projects off-frame, so tip-projection NDC tests undercount); visual — on/off screenshot pair, 2-pair averaged, cone adds light in a ±8 % vertical strip centred on the projected spire (`shots/m83-shafts-near.png`); awakening seam — AWAKE at the far pose forces the core shaft on (+1), DORMANT restores (0); heap flat across the sequence.
- **Harness trap: transient draw-call dips** — the scene animates (vehicles/drones), so a min-of-N `renderer.info.render.calls` sample is contaminated by one-frame dips (measured 69 vs 70 on an otherwise-static scene). The robust metric is a **per-pair (group on → off) delta, median of 7 pairs** (`medDelta`), which cancels slow drift and is robust to ≤3 bad pairs.


## Timeline

- time: 2026-09-17T00:28:18
  kind: decision
  summary: "Created this page: M8.3 volumetric light shafts: additive fog-off cones from nearest fiber spires + creature core in ATMOS"
  source: M8.3 implementation
  affects: [m83-light-shafts]

- time: 2026-09-17T00:28:59
  kind: decision
  summary: "M8.3 volumetric light shafts: 4 nearest-spire slots + creature core cone in ATMOS.shaftGroup (additive, fog-off), 2 s nearest-N scan with pre-allocated scratch, tier-capped, opacity-eased; exact renderer-culling in-frame count and per-pair median draw-call deltas in smoke"
  source: brain update-truth
  affects: [m83-light-shafts]
