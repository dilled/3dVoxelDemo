---
id: m64-steam-sparks
title: "M6.4 ambient emitters: steam vents (cooling towers) + sparks (substations) in TRAFFIC — pooled, tier-capped, 2 draw calls"
category: decision
status: active
tags: [m6, traffic, pool, tier, steam, sparks]
created: "2026-09-15T17:24:52"
updated: "2026-09-15T17:25:47"
---

<!-- compiled_truth -->
## Decided

- Steam vents + sparks join `TRAFFIC` (same system as M6.2 drones / M6.3 vehicles), same cap/pool pattern: per-puff/per-spark state is an item of M6.1 pools `traffic-steam` (HIGH cap 48) / `traffic-spark` (HIGH cap 64) ⇒ zero `new` after init. `CFG.traffic.steam`: tiers {high:48, med:28, low:12}, spawnInterval 0.12 s, radius 200 m, inner 20 m, life 5–8 s, rise 2.2–3.2 m/s, size 2.2–3.8 m grow 1.6. `CFG.traffic.spark`: tiers {high:64, med:36, low:18}, spawnInterval 0.3 s, radius 170 m, burst 1–3, life 0.35–0.9 s, gravity 3.2 m/s². Tier cap trims the FARTHEST items to the pool; `TIER.set('low')` trims steam 48→12 / sparks 64→18, HIGH regrows (M6.5 scales all M6 pools through the same seam).
- Cost: exactly TWO draw calls — `TRAFFIC.smesh` (steam — unit plane, billboard = camera yaw/pitch quaternion, unlit additive so per-instance color IS the alpha fade) + `TRAFFIC.spoints` (sparks — `THREE.Points`, warm glow texture, additive, `setDrawRange(0, pcount)` ⇒ 0 live sparks cost 0 draw calls — same invariant as count-0 InstancedMesh).
- Steam motion: rise + gentle sway drift + grow + sin-fade (0→tint→0 over life). Sparks: brief ballistic life (up-out velocity, gravity), flicker, fade to zero.
- Source selection: NOT blind random-block probing — a 200 m radius holds only ~10 source blocks, so a 14-draw blind search finds a vent ~5% per draw and starves the emitters (steady state ≈ rate×life lands well under the cap ⇒ the cap is never the gate). Instead `TRAFFIC._coolList`/`_subList` hold the nearby source buildings (rebuilt every 4 s from the same seeded `WORLD.buildingAt` path, R=210 m), and `_findSource` does a uniform random pick from the list filtered to [inner, radius].
- Spawn timers accumulate the frame remainder (`while (timer <= 0) { timer += interval; spawn }`), NOT `if`-reset — an if-reset discards the negative remainder, so at 17 fps a 0.12 s interval becomes one spawn per 3 frames (5.7/s, not 8.3/s) and the field plateaus ~40 instead of saturating 48.
- Consequence: M6.4 adds 2 always-present draw calls (count-0 / drawRange-0 cost 0 idle), so the M2 smoke gate now ALSO hides `T.smesh` + `T.spoints` alongside the M6.2/6.3 meshes.
- Smoke M6.4 section: pool/zero-`new` identity, steam field saturates the cap (pool = gate), analytic source match by replaying the seeded M3 block seeds (every live puff above a cooling-tower vent, every spark above a substation), upward drift, spark stream turnover, heap flat (min-of-3 vs 2 MB), sampled cap hold, LOW trims / HIGH regrows, idle-cheap stats (additive + drawRange tracks live count), draw calls < 150, and one street-level screenshot `smoke/shots/m64-steam-sparks-street.png`.
- Screenshot pose (extends M6.2/6.3 analytic line-of-sight): a live puff above a resolvable vent 50–170 m out (mid-life, risen clear of the tower cap), whose substation neighbour ≤ 70 m carries a live spark; camera 70 m out on the radial bearing at y=2, aim at the puff; LOS against the instanced building boxes rejects occluded candidates; retry loop (40 × 500 ms) while the emitters cycle.
- Smoke-test gotcha: the s0 sample must read all sync stats BEFORE `await heapMin()` — the page keeps running during the 1.2 s heap sample, so anything sampled after it is from a later instant and false-fails the pool-identity / zero-`new` checks.

## Constraints / follow-ups

- `smesh`/`spoints` share textures with the M6.1 glow kit (steam uses the glow texture, sparks use `KIT.makeGlowTexture(64,'255,225,170')`) — material/texture changes affect all additive emitters; keep them white-base + per-instance tint.
- Source lists are the M6.4 seam for M7.1 (pooled `Points`/sprite particle system): steam/sparks/pulse-motes/lightning-motes/awakening-rain will share the same live-source-list + tier-cap + frame-rate-independent timer pattern.


## Timeline

- time: 2026-09-15T17:24:52
  kind: decision
  summary: "Created this page: M6.4 ambient emitters: steam vents (cooling towers) + sparks (substations) in TRAFFIC — pooled, tier-capped, 2 draw calls"
  source: M6.4 implementation
  affects: [m64-steam-sparks]

- time: 2026-09-15T17:25:47
  kind: decision
  summary: "M6.4 shipped: steam vents + sparks ambient emitters in TRAFFIC — pooled, tier-capped, 2 draw calls, source lists + frame-rate-independent spawn timers"
  source: M6.4 implementation
  affects: [m64-steam-sparks]
