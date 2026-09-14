---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-15T00:48:32"
---

# Roadmap

## Milestones

Full per-milestone scope/gates live in `PLAN.md` (M0–M14, single-file demo "QWEN FLASH // AWAKENING"). Status below; M0 scaffold is done and smoke-verified headless.

```mermaid
gantt
  title QWEN FLASH // AWAKENING
  dateFormat YYYY-MM-DD
  section Scaffold
  M0 scaffold + boot skeleton :done, m0, 2026-09-15, 1d
  section Core
  M1 systems registry, input, camera :active, m1, after m0, 2d
  M2 voxel material kit :m2, after m1, 2d
  section World
  M3 chunked city far layer :m3, after m2, 3d
  M4 building detail passes :m4, after m3, 3d
  section Creature & life
  M5 Qwen creature dormant :m5, after m4, 3d
  M6 traffic + ambient life :m6, after m5, 2d
  M7 particles + FX :m7, after m6, 2d
  section Climax
  M8 atmosphere :m8, after m7, 2d
  M9 awakening sequence :m9, after m8, 3d
  M10 unsloth easter egg :m10, after m9, 1d
  section Finish
  M11 procedural audio :m11, after m10, 2d
  M12 intro cinematic :m12, after m11, 2d
  M13 emergent event director :m13, after m12, 2d
  M14 perf, tiers, polish :m14, after m13, 3d
```
