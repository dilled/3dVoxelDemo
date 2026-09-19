---
id: m131-events-scheduler-core
title: "M13.1 EVENTS scheduler core: weighted picking, cooldowns, min/max gap, one-at-a-time + priority preemption (seeded, deterministic)"
category: decision
status: active
tags: [events, scheduler, m13]
created: "2026-09-19T15:16:24"
updated: "2026-09-19T15:17:44"
---

<!-- compiled_truth -->
The EVENTS module (index.html — between INTRO and the registerSystem boot block; `registerSystem(EVENTS)` after HUD; exposed on `window.SIM`) is the M13 emergent event director's scheduler core. M13.1 is scheduler-only — NO events are registered yet (M13.2–M13.4 add the ambient events), so the live page costs nothing (step early-returns on an empty registry).

Mechanics:
- Registry: `EVENTS.register(def)` / `unregister(id)`. def = `{ id, weight (default 1), duration (s or [min,max]), cooldown (s or [min,max], default 0), priority (default 0), eligible()?, start(a)?, update(a,dt,t)?, end(interrupted)? }` — weight/priority/cooldown are normalized at register.
- Seeded PRNG: `mulberry32(CFG.city.seed ^ CFG.events.seed)`; harness seam `EVENTS._rng = WORLD.mulberry(seed)` forces the seed.
- Own clock `_time` advances ONLY via `step(dt)`; `update(dt)` = `paused ? noop : step(dt)` — `paused` freezes the page-loop clock for the smoke harness. The clock only advances while the registry is non-empty.
- One-at-a-time: single `_active`. While idle, the next pick is at `_nextAt` (init/reset → `CFG.events.first`; after each end → `end + gap[0] + rng*(gap[1]-gap[0])`); if nothing is eligible at pick time → retry every `CFG.events.retry`.
- Priority rule: while active, every frame `_pick(t, active.def.priority)` — a STRICTLY higher priority preempts (victim `end(interrupted=true)`, the preemptor starts at EXACTLY the victim's end time, no gap); equal/lower never. Normal picks use `_pick(t, -Infinity)` (weighted).
- Cooldown: `readyAt = end + drawn cooldown`; eligibility = `t >= readyAt` AND `eligible()` gate true (the M13.4 AWAKE-window rule will use this gate).
- Manual trigger: `EVENTS.trigger(id)` starts immediately, preempting whatever is running (M13.2 operator override — ignores gap/cooldown/weight).
- `log`: `{ id, start, end, interrupted }` capped at 128 — ENDED events only (the active event is not in the log until it ends). `reset()` harness seam (clock/log/readyAt/active).
- `CFG.events = { gap: [14,30], retry: 1, first: 20, seed: 0x13E5 }`.

Smoke (M13.1 section, after M12.3, before the final zero-errors checks): synthetic evA `{w:2,cd:2,prio:1}` / evB `{w:1,cd:4,prio:1}` / evC `{w:1,dur:.5,cd:1,prio:2,gated}` — first checks the page loop drives `_time` (update wired), then `paused=true` + `reset` + forced seed `WORLD.mulberry(0x1337)` + test pacing (`CFG.events.gap=[2,4], first=0`) + 1200×`step(0.1)` (120 s): one-at-a-time (no overlaps), every gap ∈ [2,4]+step, same-id gaps ≥ max(minGap, cd), weighted picking (A>B, both ≥1), gated C never fires; priority: C preempts the running lower-priority event (victim `interrupted=true`, `c.start === victim.end` exactly), fires exactly once, gap resumes from C's end; determinism: same seed + same steps ⇒ byte-identical log. Cleanup unregisters the synthetic events and restores CFG/clock/rng.

Verified: 2 full headless smoke runs — M13.1 9/9 PASS in both (deterministic checks identical), zero page/console errors; the only failures in the runs were the documented pre-existing flakes (M8.1 stars, M9.4 vehicles, M11.2 sweep/heap, M6.2/M7.5 class).


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
