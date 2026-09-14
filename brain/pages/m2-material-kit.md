---
id: m2-material-kit
title: "M2 voxel material kit: KIT APIs, gate test rig, and the transparent-DoubleSide 2x draw-call trap"
category: decision
status: active
tags: [kit, materials, draw-calls, three]
created: "2026-09-15T01:41:27"
updated: "2026-09-15T02:32:16"
---

<!-- compiled_truth -->
M2's `KIT` system is the shared foundation every later visual milestone builds on:

- **Material library** `KIT.MATS` — mostly `MeshLambert`/`MeshBasic` (metalDark, server (emissive face), glass, glow (additive), cable) plus exactly one `MeshStandardMaterial` (`metalHero`) reserved for hero parts.
- **Canvas-texture factory** — `makeCanvasTexture(w,h,draw)` returns `{canvas, ctx, tex, redraw(u), frame}` (frame counts redraws; smoke seam for "it animates"). Helpers: `makeLedGrid` (per-cell flicker + scan line), `makeHoloSign` (neon text; `sub` may be a function → tagline cycling), `makeGlowTexture` (radial gradient for additive sprites).
- **Instancing builders** — `KIT.InstancedBox(capacity, [sx,sy,sz], mat)` / `KIT.InstancedCylinder(...)`: capacity up front, `.add(x,y,z, scale|[sx,sy,sz], color, rotY)` + `.commit()`, zero per-frame allocation, `frustumCulled=false`.
- **Merged batcher** — `KIT.mergeGeometries([{geo, matrix?}])` → one non-indexed BufferGeometry (position/normal/uv) for static multi-primitive meshes.
- **Lighting rig** — hemi fill + one directional "moon" key (`KIT.moon`), two `PointLight`s at intensity 0 reserved for hero moments (`KIT.heroLights`) — M5/M9/M11 claim them by setting position/intensity.
- **Gate test rig** — `KIT.buildTestRig()` at (0,0,-80): tower + wall + LED faces + QWEN/UNSLOTH signs + glow sprite, **8 draw calls** (gate: < 10). It is a *temporary* artifact: M3's city generator must absorb or relocate it (it will sit inside the city grid once M3 lands).

**Draw-call accounting rule (bit us once):** in three.js, *transparent* objects with `side: DoubleSide` render in **two passes** (back + front) → 2 draw calls each. Holo-sign billboards and sprites must stay `FrontSide` to cost one call. Verify draw calls via `renderer.info.render.calls` read between frames (autoReset resets at render start, so the post-render value is the last frame's count).


## Timeline

- time: 2026-09-15T01:41:27
  kind: decision
  summary: "Created this page: M2 voxel material kit: KIT APIs, gate test rig, and the transparent-DoubleSide 2x draw-call trap"
  source: M2 implementation
  affects: [m2-material-kit]

- time: 2026-09-15T01:41:48
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [m2-material-kit]

- time: 2026-09-15T02:32:16
  kind: decision
  summary: "M3 absorbed the test rig: it now sits inside the WORLD city grid behind a 16 m keep-out at (0,0,-80); the smoke M2 <10-draw-call gate hides WORLD.root while measuring, and the M1 fixed-order check is INPUT→CAMERA→KIT→WORLD→HUD"
  source: M3 implementation
  affects: [m2-material-kit, world-chunk-generation, smoke-harness-dev-tooling]
