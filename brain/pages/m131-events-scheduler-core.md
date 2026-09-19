---
id: m131-events-scheduler-core
title: "M13.1 EVENTS scheduler core: weighted picking, cooldowns, min/max gap, one-at-a-time + priority preemption (seeded, deterministic)"
category: decision
status: active
tags: [events, scheduler, m13]
created: "2026-09-19T15:16:24"
updated: "2026-09-19T23:38:21"
---

<!-- compiled_truth -->
# M13.1 — EVENTS scheduler core

**Status: done, smoke-verified headless (9-check M13.1 section, after M12.3, page already RUNNING).**

## What it is

`EVENTS` — the ambient-event scheduler the M13.2–M13.4 pages build on. One global clock, **one active event at a time**, strict-priority preemption.

## API

- `register(def)` / `unregister(id)` — defs: `{id, weight, cd:[lo,hi], dur:[lo,hi], ready?(t), start?(a,dt,t), update?(a,dt,t), end?(a,interrupted), priority?}`.
- `trigger(id)` — manual force (the M13.1 smoke uses it; ignores readiness/cooldowns, still obeys one-at-a-time + priority).
- `step(dt)` / `update(dt)` — the scheduler's one line in the fixed order (`…AUDIO → HUD → EVENTS`).
- `reset()` — clears active/log/_time (park at boot like the other systems).

## Behavior contract (verified)

- Weighted pick among ready events (weight = def.weight).
- Per-id cooldown `cd` after each end; global gap between consecutive events `gap` (default [2,4] s, test pacing [2,4] in smoke).
- **One at a time, strict priority preemption**: a higher-priority event that becomes ready immediately preempts the running one; the victim's `end(a, interrupted=true)` fires, its log entry is marked `interrupted: true`, and the new event's `start` equals the victim's `end` exactly.
- Seeded RNG (mulberry32, same seed as WORLD) ⇒ deterministic firing order for a forced seed.
- `trigger()` ignores readiness/cooldowns but still obeys one-at-a-time + priority.
- **Creature/ambient compatibility gate** (added in M13.4, [[m134-ambient-events-c]]): while `ENTITY.state !== 'DORMANT'` only creature-priority (priority > 0) events may start; running events continue; DORMANT restores ambient firing.

## Status

M13.1 is scheduler-only. All six ambient events are registered by the M13.x pages — M13.2 ([[m132-ambient-events-a]] — data-pulse, power-cycle), M13.3 ([[m133-ambient-events-b]] — cooling-emergency, drone-launch), M13.4 ([[m134-ambient-events-c]] — mech-reposition, em-discharge) — so the M13.1–M13.4 ambient-event set is complete. Each follows the same pattern: register idempotently from `EVENTS.registerAmbient()` on init, verify with the same harness pattern.


## Timeline

- time: 2026-09-19T15:16:24
  kind: decision
  summary: "Created this page: M13.1 EVENTS scheduler core: weighted picking, cooldowns, min/max gap, one-at-a-time + priority preemption (seeded, deterministic)"
  source: M13.1 implementation
  affects: [m131-events-scheduler-core]

- time: 2026-09-19T15:17:44
  kind: decision
  summary: "M13.1: EVENTS scheduler core — weighted picking, per-event cooldowns, global min/max gap, one-at-a-time, strict-priority preemption, seeded deterministic clock (step/update + paused seam), manual trigger() for M13.2, 128-capped end log; no events registered yet; smoke M13.1 section (9 checks, forced seed 0x1337, 120 s drive) green in 2 runs"
  source: M13.1 implementation
  affects: [m131-events-scheduler-core]

- time: 2026-09-19T16:56:29
  kind: decision
  summary: "M13.2 has registered the first ambient events (data-pulse, power-cycle) — the 'scheduler-only, no events registered yet' status is superseded"
  source: brain update-truth
  affects: [m131-events-scheduler-core]

- time: 2026-09-19T20:13:44
  kind: decision
  summary: "M13.3 done: scheduler now carries all four ambient events (M13.2 A-pair + M13.3 B-pair); M13.4 remains"
  source: brain update-truth
  affects: [m131-events-scheduler-core]

- time: 2026-09-19T23:38:21
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [m131-events-scheduler-core]
