---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-15T09:31:03"
---

# Roadmap

Full per-milestone scope/gates live in `PLAN.md` (M0–M14, single-file demo "QWEN FLASH // AWAKENING"). Status below: M0–M5 + M6.1 done and smoke-verified headless (M5: dormant Qwen machine-creature, see [[entity-system-m5]]; M6.1: generic object-pool foundation, see [[m61-object-pool]]).

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
  M6.2-6.5 traffic + ambient life :m6, after m61, 2d
  M7 particles + FX :m7, after m6, 2d
  section Climax
  M8 atmosphere :m8, after m7, 2d
  M9 awakening sequence :m9, after m8, 3d
  M10 unsloth easter egg :m10, after m9, 1d
  section Finish
  M11 procedural audio :m11, after m10, 2d
  M12 intro cinematic :m12, after m11, 2d
  M13 emergent event director :m13, after m12, 3d
  M14 perf, tiers, polish :m14, after m13, 3d
```
