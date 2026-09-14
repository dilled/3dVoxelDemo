---
slug: architecture
title: System architecture
role: system architecture
updated: "2026-09-15T01:42:40"
---

# System architecture

Single self-contained `index.html` (Three.js via CDN importmap is the only external, pinned to r0.160.0 — see [[three-cdn-pin-boot-watchdog]]). Everything lives inside the one file: a `systems` registry that boots in a fixed order, a central `frame()` rAF loop calling `update(dt, t)`, and the `BOOT` deterministic state machine (`LOADER → RUNNING`, error path via watchdog). M0–M1 skeleton in place: `CFG` (tunables), `BOOT`, `AUDIO` (gesture-gated unlock stub — M11 builds beds on it), `HUD` (FPS/state DOM), `window.SIM` dev handle. M2 adds the `KIT` material kit: shared `MATS` library, canvas-texture factory (LED grid, holo signs, glow), `InstancedBox`/`InstancedCylinder` builders, merged-geometry batcher, lighting rig (hemi + moon key + 2 reserved hero point lights), and a temporary gate test wall/tower at (0,0,-80) rendered at 8 draw calls [[m2-material-kit]].

## Module graph

```mermaid
graph TD
  CFG[CFG tunables] --> R
  BOOT[BOOT state machine LOADER / RUNNING] -->|user gesture| AUDIO[AUDIO unlock stub]
  BOOT -->|arms once| LOOP[central frame loop rAF]
  LOOP -->|update dt, t| REG[systems registry fixed order: INPUT, CAMERA, KIT, HUD]
  REG --> HUD[HUD FPS + state DOM]
  KIT[KIT material kit: MATS / canvas textures / instanced builders / lighting rig] --> SC
  KIT -->|test wall+tower rig 8 draw calls| SC
  LOOP --> R[THREE renderer ACES / sRGB]
  R --> SC[scene + camera fog, dark void]
```

## Constraints

- One file, no build system; dev-only tooling allowed under `smoke/` ([[smoke-harness-dev-tooling]]).
- Zero hand-authored meshes: `BoxGeometry`/`CylinderGeometry` primitives, `InstancedMesh`, merged geometry, canvas textures only.
- Draw-call budget < ~150 at 100 % quality; prefer instancing + instance colors.
- No references before init; every subsystem implements `{ init, update, onQuality?, onAwaken?, dispose? }`.
- three.js renders transparent `DoubleSide` objects in two passes — billboards/signs/sprites stay `FrontSide` ([[m2-material-kit]]).
- M0 gate (met): START always → live 60 fps loop; page refresh never leaves a stuck state (15 s boot watchdog).
- M2 gate (met): KIT renders test wall/tower with animated LED faces + signs at 8 draw calls (< 10).
