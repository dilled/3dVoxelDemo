---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-18T21:17:19"
---

# Roadmap

Full per-milestone scope/gates live in `PLAN.md` (M0–M14, single-file demo "QWEN FLASH // AWAKENING"). Status: **M0–M10.2 done and smoke-verified headless** — M10.2 holo-sloth hologram + street-only sloth drones ([[m102-holo-sloth-drones]]); M10.1 unsloth monument + UNSLOTH sign ([[m101-sloth-monument]]); M9 awakening sequence ([[m92-wake-state-machine]], [[m94-city-cascade]], [[m95-awakening-decay]], [[m96-wake-triggers]]); M8 atmosphere ([[m81-night-sky]], [[m82-fog-zone-tint]], [[m83-light-shafts]], [[m84-distant-lightning]]); M7 particles + FX ([[m71-parts-particle-system]], [[m72-fx-pulse]], [[m73-fx-arcs]], [[m74-fx-flash]], [[m75-camera-shake]]); M6 traffic/ambient ([[m61-object-pool]], [[m62-traffic-drones]], [[m63-traffic-vehicles]], [[m64-steam-sparks]]); M5 dormant creature ([[entity-system-m5]]).

```mermaid
gantt
  title QWEN FLASH // AWAKENING
  dateFormat YYYY-MM-DD
  section Scaffold
  M0 scaffold + boot skeleton :done, m0, 2026-09-15, 1d
  section Core
  M1 systems registry, input, camera :done, m1, after m0, 2d
  M2 voxel material kit :done, m2, after m1, 2d
  section World
  M3 chunked city far layer :done, m3, after m2, 3d
  M4 building detail passes :done, m4, after m3, 3d
  section Creature & life
  M5 Qwen creature dormant :done, m5, after m4, 3d
  M6.1 object pool foundation :done, m61, after m5, 1d
  M6.2-6.5 traffic + ambient life :done, m6, after m61, 2d
  M7 particles + FX :done, m7, after m6, 2d
  section Climax
  M8 atmosphere :done, m8, after m7, 2d
  M9 awakening sequence :done, m9, after m8, 3d
  M10.1 unsloth monument + sign :done, m101, after m9, 1d
  M10.2 holo sloth + street drones :done, m102, after m101, 1d
  M10.3 easter-egg reaction :m103, after m102, 1d
  section Finish
  M11 procedural audio :m11, after m103, 2d
  M12 intro cinematic :m12, after m11, 2d
  M13 emergent event director :m13, after m12, 3d
  M14 perf, tiers, polish :m14, after m13, 3d
```
