---
id: m62-traffic-drones
title: "M6.2 maintenance drones: TRAFFIC system, TIER seam, seeded roof docks via WORLD.buildingAt"
category: decision
status: active
tags: [m6, traffic, pool, tier]
created: "2026-09-15T13:31:05"
updated: "2026-09-20T02:12:04"
---

<!-- compiled_truth -->
## Decided

- Maintenance drones live in the `TRAFFIC` system (registered after ENTITY, before HUD). All drones share ONE `InstancedMesh` (merged-geometry voxel quad: chassis + 4 rotors + sensor nub, unlit `MeshBasicMaterial` so the per-instance color IS the visible tint) = one draw call for the whole fleet. Per-drone state is an item of the M6.1 pool `traffic-drone` (fixed capacity = HIGH tier cap 16); state machine `docked → patrol → return`, routes are replanned at every dock, never baked.
- `TIER` seam (`TIER.set/active()`, default `high`): `TRAFFIC` reads `CFG.traffic.drone.tiers[TIER.active()]` every frame, so a tier change trims (farthest drones released to the pool) / regrows the fleet. M6.5 scaled ALL M6 pools through this same seam. M14.1 landed the driver: FPS-based auto-detect and the F1–F4 manual keys all funnel through the same `TIER.set()`, so nothing downstream changed ([[m141-perf-monitor-quality-tiers]]).
- Docks are DETERMINISTIC: `WORLD.buildingAt(bx, bz, ring)` replays the exact M3 seeded path of `_fill` (occupancy → archetype → mass) into a no-op sink chunk, so routes land where mass actually is. Contract: `ring` must be the block's CURRENT player-relative chunk ring (occupancy depends on it), computed exactly like `WORLD._sync` assigns rings (`TRAFFIC._ringFor`).
- `info.h` is the main-mass top only. `info.hTop` (added in M6.2) is the true silhouette top incl. crowns (server 1.18h, fiber h+2, cool h+1.8, antenna mast tip, holo pad). Drone dock altitude = `hTop + dockHover (7 m)` — the 7 m must also clear M4 roof detail (holo roof-sign top is ~3.9 m above its hTop). A drone docked on `info.h` sits INSIDE the crown/sign and is invisible — this was the actual M6.2 bug found via the street screenshot.
- Spatial caps: docks picked in a 260 m annulus around the player (26 m inner), drones released back to the pool past 260 m × 1.15; tier cap trims the FARTHEST drones. Zero `new` per frame: scratch Matrix4/Vector3/Color on TRAFFIC, `wps` pre-allocated Float32Array(12).
- Smoke M6.2 section: fleet→cap, zero-`new` pool identity, dock+patrol states, heap flat (min-of-3-sample vs 2 MB bound), LOW trims to 5 / HIGH regrows to 16, draw calls < 150, and the street screenshot pose is chosen by an analytic line-of-sight test against the instanced building boxes (unit-box bases; scale/center read from instance matrices) because the dense core city otherwise hides any given tower from its bearing.

## Constraints / follow-ups

- Instance colors are per-SLOT: `setColorAt` is re-set every frame for every live drone (swap-remove in `_releaseAt` moves items between slots) — same invariant class as M5 compute nodes.
- Dock heights assume the block keeps the same chunk ring; if a chunk re-rings far/near while a drone is docked, that roof can change height (rare edge, accepted).


## Timeline

- time: 2026-09-15T13:31:05
  kind: decision
  summary: "Created this page: M6.2 maintenance drones: TRAFFIC system, TIER seam, seeded roof docks via WORLD.buildingAt"
  source: created via brain create-page
  affects: [m62-traffic-drones]

- time: 2026-09-15T13:31:49
  kind: decision
  summary: "M6.2 shipped: TRAFFIC drone system (pool-backed, tier-capped, seeded roof docks); TIER seam introduced"
  source: M6.2 implementation
  affects: [m62-traffic-drones]

- time: 2026-09-15T15:53:51
  kind: decision
  summary: "M6.3 follow-up resolved: sky vehicles joined TRAFFIC (see [[m63-traffic-vehicles]])"
  source: M6.3 handoff
  affects: [m62-traffic-drones]

- time: 2026-09-15T15:53:51
  kind: note
  summary: "M6.3 follow-up fulfilled: sky vehicles joined TRAFFIC with the same pool/cap pattern — see [[m63-traffic-vehicles]]"
  source: M6.3 handoff
  affects: [m62-traffic-drones, m63-traffic-vehicles]

- time: 2026-09-18T07:44:37
  kind: decision
  summary: "M9.4 beat 5: TRAFFIC.awaken() assigns reaction roles via seeded roll — state 3 scatter (fly outward from the plaza to pre-allocated rx/ry/rz, then back to the dock) and state 4 escort (re-route to a hover ring at creature height, hold roleT s, then back); other drones hold normal patrol. States 3/4 handled in the existing flight update; TRAFFIC.awakenEnd() sends reaction drones straight home (state 2)."
  source: M9.4 implementation
  affects: [m62-traffic-drones, m94-city-cascade]

- time: 2026-09-20T02:12:04
  kind: decision
  summary: "M14.1 fulfilled the forward-looking note: TIER.set() is now driven by PERF auto-detect + F1–F4 manual keys and fans out to WORLD/KIT/AUDIO; no downstream M6 change ([[m141-perf-monitor-quality-tiers]])"
  source: M14.1 implementation
  affects: [m62-traffic-drones]
