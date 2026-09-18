---
id: m63-traffic-vehicles
title: "M6.3 sky vehicles: ring-road light trails at 3 altitudes in TRAFFIC (2 draw calls, pooled, tier-capped)"
category: decision
status: active
tags: [m6, traffic, pool, tier, vehicles]
created: "2026-09-15T15:52:21"
updated: "2026-09-18T07:44:38"
---

<!-- compiled_truth -->
## Decided

- Sky vehicles join `TRAFFIC` (same system as M6.2 drones), same cap/pool pattern: per-vehicle state is an item of the M6.1 pool `traffic-vehicle` (fixed capacity = HIGH tier cap 12 ⇒ zero `new` after init). `CFG.traffic.vehicle`: tiers {high:12, med:7, low:3}, spawnInterval 0.6 s, hold radius 300 m, release past radius × 1.25, altitudes [70, 95, 120] m, speed 26–44 m/s, hull size 1.6 m, trailLen 10–16 m, trailW 1.1 m. Tier cap trims the FARTHEST vehicles to the pool; `TIER.set('low')` trims to 3, HIGH regrows to 12 (M6.5 scales all M6 pools through the same seam).
- The whole fleet costs exactly TWO draw calls: `TRAFFIC.vmesh` (hull — merged hull+wing+tailfin voxel craft, unlit `MeshBasicMaterial` so per-instance color IS the tint) + `TRAFFIC.tmesh` (trails — unit box on the SHARED additive `MATS.pulseGlow` material, 2 instances per vehicle).
- Trail = two additive box segments BEHIND the hull: bright head at slot `i*2` (center −dir·0.25L, spans 0..0.5L behind the hull) + dim tail (0.45× tint) at slot `i*2+1` (center −dir·0.75L, spans 0.5L..L). The box has height (trailW × 0.6·trailW), so the streak is not edge-on from street level. Slot layout is per-SLOT: matrices + colors are re-set every frame for every live vehicle (swap-remove in `_vReleaseAt` moves items between slots — same invariant as drones / M5 nodes).
- Motion: constant speed along one avenue line. Ring-road avenue centerlines are at `120k + 12 m` (block 0 is an avenue, 24 m blocks — the exact grid `WORLD._skipBlock` keeps clear). Spawn on the FAR side of the player (0.65–1.0 × radius) so each vehicle flies across the player's view before release; axis 0 = z-line (x fixed at lane), axis 1 = x-line.
- Altitudes 70/95/120 m sit above every building and the creature, so trails read from street level.
- Consequence: M6.3 adds 2 always-present draw calls to the scene (count-0 `InstancedMesh`es cost 0, live fleet costs 2), so the M2 smoke gate now ALSO hides the TRAFFIC meshes (`mesh`, `vmesh`, `tmesh`) — the gate measures the KIT test wall/tower alone (< 10 calls; reads 8).
- Smoke M6.3 section: pool/zero-`new` identity, fleet→cap, all-3-altitudes-occupied-at-once, analytic trail check read from the instance matrices themselves (head slot i*2 / tail slot i*2+1 — an earlier revision of the check read the wrong slots and false-failed), movement, heap flat (min-of-3-sample vs 2 MB), sampled cap hold, LOW trims / HIGH regrows, draw calls < 150, and one screenshot PER altitude (`smoke/shots/m63-vehicles-alt{0,1,2}.png`).
- Screenshot pose selection (extends the M6.2 analytic line-of-sight test): camera 150 m further out on the plaza→vehicle bearing at y=2, LOS against the instanced building boxes, PLUS a side-on filter — the streak runs along the avenue line while the camera sits on the radial bearing, so reject candidates with |radial·travel| > 0.5 (near end-on the streak reads as a blob, not a trail); retry loop (40 × 500 ms) because the fleet keeps cycling and any altitude may momentarily have no vehicle in the 60–260 m ring.

## Constraints / follow-ups

- `tmesh` shares `MATS.pulseGlow` with M4 building pulses and the M5 creature tip — material changes (color/opacity) affect all three; keep it white-base + per-instance tint.
- Vehicle lanes ignore the creature plaza (avenues pass at 12 m offset from block 0); at 70–120 m altitude they clear it — no avoidance needed (M9.4 will add avoidance paths on trigger).
- Trails are boxes, not sprites: readable from all angles at the cost of being geometric (accepted — matches the voxel aesthetic, zero texture).


## Timeline

- time: 2026-09-15T15:52:21
  kind: decision
  summary: "Created this page: M6.3 sky vehicles: ring-road light trails at 3 altitudes in TRAFFIC (2 draw calls, pooled, tier-capped)"
  source: created via brain create-page
  affects: [m63-traffic-vehicles]

- time: 2026-09-15T15:53:24
  kind: decision
  summary: "M6.3 shipped: sky vehicles with additive light trails in TRAFFIC — ring-road lanes at 3 altitudes, M6.1 pool, tier caps, exactly 2 draw calls"
  source: M6.3 implementation
  affects: [m63-traffic-vehicles]

- time: 2026-09-18T07:44:38
  kind: decision
  summary: "M9.4 beat 5: sky vehicles take avoidance offsets off their lanes — lateral ox (signed, away from the plaza) + oalt altitude bump, level av eases in/out over avoidRamp while avoidT > 0. Render pose only (hull + trail offset); the analytic lane state is untouched and the offset eases back to exactly 0. awakenEnd() zeroes avoidT so offsets ease out."
  source: M9.4 implementation
  affects: [m63-traffic-vehicles, m94-city-cascade]
