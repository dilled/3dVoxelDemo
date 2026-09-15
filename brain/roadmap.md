---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-15T06:50:46"
---

# Roadmap

Full per-milestone scope/gates live in `PLAN.md` (M0–M14, single-file demo "QWEN FLASH // AWAKENING"). Status below; M0–M4 done and smoke-verified headless (M4: near-layer detail pass, see [[near-layer-detail-pass]]).

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
  M13 emergent event director :m13, after m12, 3d
  M14 perf, tiers, polish :m14, after m13, 3d
```

## Notes

- M3 landed `WORLD`: mulberry32-seeded 16×16-block chunks in a 5×5 keep-set, 8 weighted archetypes, 3 LOD rings, ≤ 3 instanced draw calls per chunk with frustum culling — the M2 gate test rig is absorbed inside the city (keep-out at (0,0,-80)).
- M4 added the near-layer detail pass: five pooled detail InstancedMesh per ring 0/1 chunk (fan / dish / pulse / sign / LED window), per-building seeded salt, fair two-pass LED facade allocation, ring-2 silhouette stays zero-detail; 32 draw calls near, byte-identical regen preserved.
- The central plaza (±2 blocks) is reserved for the M5 creature pedestal.
- Hero point lights are reserved in `KIT.heroLights` (intensity 0) for M5/M9/M11.
