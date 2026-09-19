---
id: m134-ambient-events-c
title: "M13.4 — Ambient Events C: Mechanical Reposition + Distant EM Discharge (and the creature/ambient compatibility gate)"
category: project
status: active
tags: [m13, events, ambient, creature, audio]
created: "2026-09-19T23:37:31"
updated: "2026-09-19T23:37:58"
---

<!-- compiled_truth -->
# M13.4 — Ambient Events C: mechanical reposition + distant EM discharge

**Status: done, smoke-verified headless (12-check M13.4 section, after M13.3, page already RUNNING). This completes the M13 ambient-event set (M13.1–M13.4); all six ambient events now live on the scheduler ([[m131-events-scheduler-core]]).**

The third pair of ambient events, registered idempotently from `EVENTS.registerAmbient()` alongside the M13.2 ([[m132-ambient-events-a]]) and M13.3 ([[m133-ambient-events-b]]) pairs. Both defs: **priority 0, weight 0.7**, cooldowns 60–120 s (mech) / 45–90 s (EM). Both are "far, quiet" beats — the longest ambient cooldowns, so the city breathes between creature-scale moments.

## Mechanical reposition (tensor ring slews its base)

- The plaza ring slowly slews its **base quaternion q0→q1** over 6–10 s: a *permanent* reposition, **no restore** — the ring ends elsewhere and the new pose becomes the base. Preemption leaves it mid-slew with no snap (interrupted state is simply the current quaternion).
- Small 0.25 camera shake + new **`AUDIO.rumble(pos)`** one-shot: sine pitch drop under low-passed looped noise, self-stopping, spatial sink (new `CFG.audio.events.rumble`).
- Eligibility: player within **10–320 m** of the plaza.
- `CFG.events.mechReposition`.

## Distant EM discharge

- Seeded **far-point** strike via `ATMOS._fireLightning` (the M8.4 strike seam) plus **2–3 staggered city arcs between consecutive nearest substations** (0.4 s stagger, pooled `FX.arc`); natural end in 3–5 s. No restore needed — arcs and the far flash decay to zero.
- `CFG.events.emDischarge`.

## Durable rule — creature/ambient compatibility gate (the reason M13.4 exists)

While the creature is awakened, ambient events must not compete with it. The gate lives in **`EVENTS._pick` and `trigger`**:

- While `ENTITY.state !== 'DORMANT'`, only **creature-priority (priority > 0)** events may start.
- Ambient events already running **continue** (no forced interruption of in-flight ambients).
- Returning to `DORMANT` **restores** ambient firing automatically — no re-registration.

This is the project-wide rule for any future creature-vs-ambient conflict: gate starts, let running events finish, restore on DORMANT.

## Smoke notes

- The M13.1 synthetic section now **unregisters** the two C events (isolation of scheduler behavior under forced seeds).
- New M13.4 section: 12 checks incl. a **3-minute gate** (1800×0.1 s real-CFG drive, forced seed ⇒ ≥4 distinct ambient ids fired, no overlaps, gap ≥14 s, per-id cooldowns held, deterministic, no leftover state) and a perf proxy (draw calls 63–67 < 150 over a 14 s live window).


## Timeline

- time: 2026-09-19T23:37:31
  kind: decision
  summary: "Created this page: M13.4 — Ambient Events C: Mechanical Reposition + Distant EM Discharge (and the creature/ambient compatibility gate)"
  source: M13.4 implementation
  affects: [m134-ambient-events-c]

- time: 2026-09-19T23:37:58
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [m134-ambient-events-c]
