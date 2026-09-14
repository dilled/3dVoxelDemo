---
slug: architecture
title: System architecture
role: system architecture
updated: "2026-09-15T00:48:32"
---

# System architecture

## Overview

Single self-contained `index.html` (Three.js via CDN importmap is the only external, pinned to r0.160.0 — see [[three-cdn-pin-boot-watchdog]]). Everything lives inside the one file: a `systems` registry that boots in a fixed order, a central `frame()` rAF loop calling `update(dt, t)`, and the `BOOT` deterministic state machine (`LOADER → RUNNING`, error path via watchdog). M0 skeleton in place: `CFG` (tunables), `BOOT`, `AUDIO` (gesture-gated unlock stub — M11 builds beds on it), `HUD` (FPS/state DOM), `window.SIM` dev handle.

## Module graph

```mermaid
graph TD
  CFG[CFG tunables] --> R
  BOOT[BOOT state machine LOADER / RUNNING] -->|user gesture| AUDIO[AUDIO unlock stub]
  BOOT -->|arms once| LOOP[central frame loop rAF]
  LOOP -->|update dt, t| REG[systems registry fixed order]
  REG --> HUD[HUD FPS + state DOM]
  LOOP --> R[THREE renderer ACES / sRGB]
  R --> SC[scene + camera fog, empty void]
```

## Constraints

- One file, no build system; dev-only tooling allowed under `smoke/` ([[smoke-harness-dev-tooling]]).
- Zero hand-authored meshes: `BoxGeometry`/`CylinderGeometry` primitives, `InstancedMesh`, merged geometry, canvas textures only.
- Draw-call budget < ~150 at 100 % quality; prefer instancing + instance colors.
- No references before init; every subsystem implements `{ init, update, onQuality?, onAwaken?, dispose? }`.
- M0 gate (met): START always → live 60 fps loop; page refresh never leaves a stuck state (15 s boot watchdog).
