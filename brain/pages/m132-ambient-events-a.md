---
id: m132-ambient-events-a
title: "M13.2 — Ambient Events A: Data Pulse + Section Power Cycle"
category: project
status: active
tags: [m13, events, ambient, world, fx]
created: "2026-09-19T16:54:44"
updated: "2026-09-19T16:55:41"
---

<!-- compiled_truth -->
# M13.2 — Ambient Events A: data pulse + section power cycle

**Status: done, smoke-verified headless (11-check M13.2 section, after M13.1, page already RUNNING).**

## What it is

The first two ambient events registered on the M13.1 scheduler ([[m131-events-scheduler-core]]). Both are registered idempotently from `EVENTS.init()` via `registerAmbient()`; `EVENTS.update` is gated on `BOOT.state === 'RUNNING'` so nothing fires during the intro.

## Data pulse (tower-to-tower light dot)

- Endpoints: two **fiber-spire conduit dashes** (chunk `pulse` k===3) that are camera-visible now; dot = 0.35-unit box mesh with its own additive cyan material (fog-off, depthWrite off), **child of `WORLD.root`** (so the M2 gate hides it), hidden while idle.
- Path: quadratic Bezier A-top → B-top, control = midpoint + 15% of separation up. Duration 2.5–4 s. `FX.pulse` ([[m72-fx-pulse]]) at A's base on departure and at B's base on arrival — **arrival only when it naturally ends; a preempted pulse is dropped where it was** (no arrival flash, dot hidden).
- Selection: nearest A within reach [60, 320] m, then nearest B with separation [50, 260] m and reach — sorted, stable, deterministic; candidate pair cached 5 s on the scheduler clock (`_dpRefresh`).
- `step()` increments `a.t` **before** `update`, so the final frame uses u=1 and the dot lands exactly at B's top.

## Section power cycle (one ring chunk dims/brightens)

- Target: one **visible detail-ring chunk (ring ≤ 1) with mass** near the player — nearest by distance to the chunk **edge** (0–300 m; the player's own chunk is 0). **Edge distance, not chunk-center distance**: the street spawn sits on a chunk corner and the nearest chunk CENTER is ~259 m away, so center-distance reach found zero candidates.
- Mechanism: per-chunk **cloned materials** (`ch.pw.dark` / `ch.pw.server`, cloned from `MATS` at chunk spawn; base colors captured at clone time) multiplied by `m = 1 − 0.75·sin(πu)` over 3–6 s (dip 0.25), restored **byte-exact** at end (natural or interrupted). `WORLD.setChunkPower(ch, m)` applies to boxA/boxG/cyl/fan/dish; unbuild resets to 1. No lighting change.

## Gotchas (verification-learned)

- **The gap is a MINIMUM**: with per-id cooldowns [12, 24] s the scheduler legitimately *waits* (retry every 1 s) when both events are in cooldown — inter-event gaps exceed max gap [2, 4] s legally. Smoke asserts gap ≥ 2, same-id gap ≥ 12, no overlaps — no upper bound.
- Scheduler log holds ENDED events only ([[m131-events-scheduler-core]]).
- `E._pc` IS the chunk (not `{ch}`).
- Determinism: forced seed `WORLD.mulberry(0x1322)` + 1200×`step(0.1)` ⇒ identical firing order (11 events: 6 data-pulse, 5 power-cycle).


## Timeline

- time: 2026-09-19T16:54:44
  kind: decision
  summary: "Created this page: M13.2 — Ambient Events A: Data Pulse + Section Power Cycle"
  source: M13.2 implementation
  affects: [m132-ambient-events-a]

- time: 2026-09-19T16:55:41
  kind: decision
  summary: "M13.2 implemented: first two ambient events on the M13.1 scheduler — data pulse (tower-to-tower light dot) + section power cycle (per-chunk dim/restore); 11-check smoke section, headless green"
  source: brain update-truth
  affects: [m132-ambient-events-a]
