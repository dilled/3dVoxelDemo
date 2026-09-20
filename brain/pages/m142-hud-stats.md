---
id: m142-hud-stats
title: "M14.2: HUD stats — corner stats block: AI / INST / DRONE / CHUNK lines, Key I toggle, hidden HUD costs nothing"
category: decision
status: active
tags: [m14, hud, stats, perf]
created: "2026-09-20T03:37:39"
updated: "2026-09-20T03:37:39"
---

<!-- compiled_truth -->
## M14.2 — HUD stats block

The `#hud` corner block (top-left, small) now shows, alongside the pre-existing FPS / Q / STATE / CAM / mute lines:

- **AI** — the ENTITY wake state ([[m92-wake-state-machine]])
- **INST** — visible instances: sum of the live instance counts of every `InstancedMesh` in the city scene. Computed by a scene walk on the 0.5 s stats tick only (`CFG.hud.statsEvery`), zero per-frame cost
- **DRONE** — the active TRAFFIC count ([[m62-traffic-drones]])
- **CHUNK** — the player's chunk id: `WORLD.playerKey`, the same "cx,cz" key the keep-set uses ([[world-chunk-generation]])

**Toggle:** Key I (`INPUT.hudStats` edge, repeat-guarded, RUNNING only). Hidden = `display: none` AND zero cost — `HUD.update` early-returns before the accumulator, the instance walk, and any DOM write, so a hidden HUD does no stats work at all; `HUD._ticks` (stats-write counter) freezes while hidden and is the smoke's proof of that. Hint line gained `I stats`.

**Verified:** smoke section 9g (7 checks, after M14.1, before the no-errors gate) — block content + hint; values cross-checked against independent in-page ground truth (scene InstancedMesh walk, TRAFFIC.count + the traffic-drone pool inUse, chunk id replayed from CAMERA.pos, ENTITY.state — DRONE/CHUNK/AI exact, INST within ±4 for the 0.5 s staleness); HUD FPS line vs the PERF monitor (±5 fps); Key I hide (ticks + text frozen over ~2.5 stats periods while the loop runs) → restore (ticks resume) → no leftover state. Full suite 3 runs on final code: M14.2 7/7 every run, zero page/console errors; only failures are the documented pre-existing headless flakes ([[smoke-harness-dev-tooling]]).


## Timeline

- time: 2026-09-20T03:37:39
  kind: decision
  summary: "Created this page: M14.2: HUD stats — corner stats block: AI / INST / DRONE / CHUNK lines, Key I toggle, hidden HUD costs nothing"
  source: "M14.2 implementation (9551282)"
  affects: [m142-hud-stats]

- time: 2026-09-20T03:37:39
  kind: decision
  summary: "M14.2 verified: corner HUD gains AI/INST/DRONE/CHUNK stats lines + Key I zero-cost toggle; smoke section 9g green, full suite 3 runs"
  source: "M14.2 implementation (9551282)"
  affects: [m142-hud-stats]
