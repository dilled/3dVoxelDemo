---
id: m71-parts-particle-system
title: "M7.1 PARTS: one pooled particle system for every particle — 5 pools, one shared budget, Key P dev trigger"
category: decision
status: active
tags: [m7, parts, pool, particles, tier]
created: "2026-09-15T19:16:13"
updated: "2026-09-18T07:44:38"
---

<!-- compiled_truth -->
## Decided

- `PARTS` is the ONE particle system for the whole demo (M7.1): EVERY particle — steam, sparks, pulse motes, lightning motes, awakening rain — is an item of a M6.1 pool (`parts-steam`/`parts-spark`/`parts-pulse`/`parts-light`/`parts-rain`, fixed capacity = HIGH tier cap 48/64/48/40/80 ⇒ zero `new` after init). Registered in the systems registry between TRAFFIC and HUD; exposed as `window.SIM.PARTS`.
- The ONE budget is `CFG.parts.tiers` {high:280, med:160, low:72} = the exact sum of the five per-type tier caps at every tier (smoke asserts the sum at all tiers); it is enforced per type by the same farthest-release trim the M6 fleets use (per-type caps in `CFG.parts.<type>.tiers[TIER.active()]`).
- The M6.4 steam + spark emitters MOVED from TRAFFIC into PARTS in M7.1 (config `CFG.traffic.steam/spark` → `CFG.parts.steam/spark`; pools `traffic-steam/spark` → `parts-steam/spark`; source lists `_coolList`/`_subList` + `_refreshSources`/`_findSource`/`_ringFor` now live on PARTS). TRAFFIC is drones + vehicles again. All M6.4 behavior is unchanged (see [[m64-steam-sparks]]).
- Event types (0 live at idle ⇒ 0 draw calls, so idle cost ~0): pulse motes (rising cyan Points — M13.2 data-pulse seam), lightning motes (fast-falling white Points from the far sky 250–450 m / 160–260 m — M8.4 seam), rain (falling energy streaks, thin additive boxes on the shared `MATS.pulseGlow` material — M9 awakening seam). They only spawn while a trigger rain is active (`PARTS._rainT > 0`); ambient steam/spark spawn unconditionally.
- Dev trigger: Key `P` (INPUT edge `rainTrigger`, consumed in `PARTS.update`) → `PARTS.rainAll()`: one-time bursts of ALL five types (`CFG.parts.rain.burst` steam 10 / spark 14 / pulse 24 / light 14) + streak/mote trickles for `CFG.parts.rain.dur` (5 s) around the player. HUD hint line documents `P particles`.
- Renderers (one draw call each; 0 live ⇒ 0 draw calls): steam = billboard glow-sprite InstancedMesh (camera yaw/pitch quaternion, additive ⇒ per-instance color IS the alpha), spark/pulse/light = `THREE.Points` with `setDrawRange(0, count)`, rain = InstancedMesh of unit boxes (scale 0.4 × len × 0.4) on `MATS.pulseGlow`.
- Consequence: the M2 smoke gate now hides the five PARTS meshes (`smesh`/`spoints`/`mpoints`/`lpoints`/`rmesh`) alongside the TRAFFIC meshes; the M6.4/M6.5 smoke sections read the emitters from `S.PARTS` + `S.CFG.parts` (traffic-steam/spark pools are gone — smoke fails if reverted to the old names).
- Smoke M7.1 section: 5 pools + exact budget sum at all tiers, idle 0 live / 0 drawRange / 0 inUse (ambient still running), Key P rains all five types, zero-`new` pool identity across all 5 types, rain streaks visibly fall (refs kept in `window.__m71` page-global — evaluate args are serialized copies), sampled cap hold, heap flat, draw calls < 150 at rain cap, screenshot `smoke/shots/m71-particles-rain.png`, LOW tier caps the trigger rain (rain 20 / pulse 12 / light 10), HIGH restores past the LOW cap, clean resolve to 0 live with drawRange/count back to 0.


## Timeline

- time: 2026-09-15T19:16:13
  kind: decision
  summary: "Created this page: M7.1 PARTS: one pooled particle system for every particle — 5 pools, one shared budget, Key P dev trigger"
  source: M7.1 implementation
  affects: [m71-parts-particle-system]

- time: 2026-09-15T19:17:08
  kind: decision
  summary: "M7.1 shipped: PARTS owns every particle in the demo — 5 M6.1 pools, one shared budget (CFG.parts.tiers = exact sum of per-type tier caps), Key P rains all five types, event types 0 live at idle"
  source: M7.1 implementation
  affects: [m71-parts-particle-system]

- time: 2026-09-18T07:44:38
  kind: decision
  summary: "M9.4: new public API PARTS.steamBurst(n) — n steam puffs burst from the ambient cooling-tower vents (pool cap is the gate; excess silently dropped). Also the M13.3 cooling-emergency seam."
  source: M9.4 implementation
  affects: [m71-parts-particle-system, m94-city-cascade]
