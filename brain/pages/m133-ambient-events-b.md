---
id: m133-ambient-events-b
title: "M13.3 — Ambient Events B: Cooling Emergency + Drone Launch"
category: project
status: active
tags: [m13, events, ambient, world, drones, steam]
created: "2026-09-19T20:12:16"
updated: "2026-09-19T20:13:07"
---

<!-- compiled_truth -->
# M13.3 — Ambient Events B: cooling emergency + drone launch

**Status: done, smoke-verified headless (13-check M13.3 section, after M13.2, page already RUNNING).**

The second pair of ambient events registered on the M13.1 scheduler ([[m131-events-scheduler-core]]), alongside the M13.2 events ([[m132-ambient-events-a]]). Both are registered idempotently from `EVENTS.init()` via `registerAmbient()`. All event-owned visuals are **children of `WORLD.root`** and **hidden while idle** (0 extra draw calls at rest).

## Cooling emergency (overheating cooling tower)

- Target: nearest **fan par** of a visible cooling tower within reach [40, 220] m of the player — candidate cached 5 s on the scheduler clock (`_ceRefresh`), sorted, stable, deterministic.
- **Fan spin-up**: the fan par's phase `p.ph` accumulates an *extra* angle (`p.sp` is never mutated, so restore is trivial — just stop accumulating). Extra speed ramps up over 2 s to `sp·(boost−1)` (boost 3 ⇒ 3× total), holds, ramps down over 3 s. `WORLD._updateDetail` recomposes `angle = ph + t·sp`, so the accumulated phase is the only state.
- **Steam**: pooled bursts from the specific vent via `PARTS.steamBurstAt(src, n)` (new; the existing `steamBurst(n)` is the M9.4 multi-vent API) — 6 puffs at start, 4 puffs at 35 % and 70 %.
- **Warning LEDs**: one InstancedMesh (3 small unlit emissive boxes) on the tower, box-chase over the event; hidden while idle.
- **Drone dispatch**: 1–2 nearest live `TRAFFIC` drones → **state 4** (fly to a hover ring at the tower, `hoverAlt 8` / `hoverR 7`, hold for `roleT`), reset to state 2 at end (natural or interrupted).
- Duration 18–24 s.

## Drone launch (rooftop bay opens, drones stage)

- Target: nearest **server/holo building** with `h ≥ 12` within reach [40, 220] m — candidate cached 5 s (`_dlRefresh`), sorted, stable, deterministic.
- **Bay panel**: two meshes on `WORLD.root` — a bright panel (3.2×0.35×3.2) that slides out + a dark recess (2.6×0.5×2.6). `u = open·close` where `open = min(1, t/open)`, `close = min(1, (dur−t)/close)` (open 1.5 s, close 1.5 s) — **u = 0 at both endpoints** so the event's own boundaries are clean. (First draft used `open·(1−close)` which was inverted — u=0 mid-event, panel open only at the very end; caught by smoke.)
- **Drones**: 2–4 nearest live `TRAFFIC` drones → state 4 at the bay ring (`r 4`, `y = hTop+6`), hold for `roleT`, reset to state 2 at end.
- Duration 8–12 s.

## Gotchas (verification-learned)

- **Fan `sp` can be negative** (some fans spin clockwise). Smoke asserts `|Δph| > 1e-3`, not `Δph > 0`.
- **Drones use TRAFFIC state 4** (fly to `rx/ry/rz`, hold `roleT`, then → state 2). `end()` forces any state-4 drone back to state 2, so a preempted/interrupted event leaves no drone holding a role.
- **Preemption**: `EVENTS.trigger(id)` ignores readiness/cooldown and preempts the active event — the victim's `end()` runs first, so the new event's `startAt` equals the victim's `end` (smoke asserts this exactly).
- **Street-level screenshots** use an analytic line-of-sight search (M6.2 pattern): 8 bearings × 3 distances at y=1.7, first pose with a clear sightline against the instanced building boxes; aim ~2 m above the roofline/fan so the target is *above* its own box (aiming at the box top makes the tower "occlude" itself).
- Determinism: forced seed `WORLD.mulberry(0x1333)` + 1200×`step(0.1)` ⇒ identical firing order across all four ambient events.
- **No leftover state**: at end (natural or interrupted) warn/panel/bay hidden, no drone in state 4, `_ce`/`_dl` null, nothing active.


## Timeline

- time: 2026-09-19T20:12:16
  kind: decision
  summary: "Created this page: M13.3 — Ambient Events B: Cooling Emergency + Drone Launch"
  source: M13.3 implementation
  affects: [m133-ambient-events-b]

- time: 2026-09-19T20:13:07
  kind: decision
  summary: "M13.3 implemented: second pair of ambient events on the M13.1 scheduler — cooling emergency (fan spin-up + steam + warning LEDs + drone dispatch) + drone launch (rooftop bay open + drone hold); 13-check smoke section, headless green"
  source: brain update-truth
  affects: [m133-ambient-events-b]
