---
id: m92-wake-state-machine
title: "M9.2 wake state machine: DORMANT → STIR → AWAKE → DECAY → DORMANT with per-state hooks"
category: decision
status: active
tags: [m9, entity, state-machine, wake]
created: "2026-09-17T19:28:50"
updated: "2026-09-18T07:44:38"
---

<!-- compiled_truth -->
## Decided

- M9.2 extends the M5 `ENTITY` (no new system) with the **wake state
  machine**: `DORMANT → STIR (2 s) → AWAKE (10–20 s) → DECAY (3 s) →
  DORMANT`. All tunables in `CFG.entity.wake` (`stir: 2`, `awake:
  [10, 20]`, `decay: 3`, `headLift: 0.10` rad, `headRise: 0.8` m,
  `jawOpen: 0.22` rad, `ringBoost: 8`). `ENTITY.state` /
  `ENTITY.stateT` (entry time, `performance.now()/1000` clock) are the
  single source of truth; transitions are made only inside
  `ENTITY.update` when `t - stateT` passes the state duration.
- **Trigger API**: `ENTITY.wake()` — a no-op unless `state === 'DORMANT'`
  (safe re-trigger; M9.6 wires the key/HUD button/auto trigger to it).
  `ENTITY._enterState(s, t)` is the only state entry point: sets
  state+stateT, and on STIR does `_wakeCount++` + calls every system's
  `onAwaken()` (the ground-rule interface — fired exactly once per
  sequence start).
- **Per-state hooks**: `ENTITY.hook(state, fn)` registers `fn(state, t)`
  on entry to that state (`_wakeHooks` = 4 pre-allocated arrays). This is
  the seam M9.3–M9.5 (awakening beats) and M10.3 (easter-egg reaction)
  hang off.
- **STIR pose** (the M9.2 visual): a 0..1 level `wakeP` — smoothstep up
  over STIR, exactly 1 in AWAKE, smoothstep down over DECAY, exactly 0
  in DORMANT — drives `head.rotation.x = -wakeP·headLift` (up-tilt),
  `head.position.y = 43.6 + wakeP·headRise`, `jaw.rotation.x =
  wakeP·jawOpen`. Applied absolute every frame ⇒ the pose restores
  **exactly** (byte-exact 0 / 43.6 / 0) at DORMANT entry.
- **Rings**: the M5 absolute `t·ringSpin` was replaced by integrated
  angles `ENTITY._ringAng[i] += dt·ringSpin[i]·(1+(ringBoost-1)·wakeP)`
  so the STIR speed-up is continuous (no angle jump); DORMANT multiplier
  is exactly 1.
- The AWAKE hold is picked at the STIR→AWAKE transition by a seeded
  `ENTITY._wakeRng` (`mulberry(city.seed ^ 0x51A7E5 ^ 0xA9C2)` — distinct
  xor so it decorrelates from `_dreamRng`); deterministic per run.
- Hero light `+1.5·wakeP`, coreEye lerp `+0.5·wakeP` on top of the
  dormant/dream terms (M9.3 beat 1 builds the flare on top of this
  baseline; M9.5 decay reuses the DECAY pose). The M9.1 dream wave stays
  gated on `state === 'DORMANT'` (a wave cannot start mid-wake; the
  M8.3 core light shaft is already driven by `state !== 'DORMANT'`).
- **Smoke-forcing contract**: transitions are forced by fast-forwarding
  `ENTITY.stateT` past a duration — the machine itself makes every
  transition (no teleport API). A raw `ENTITY.state = ...` write is
  invalid: with a stale `stateT` the machine self-transitions out on the
  next frame. The M8.3 smoke seam was converted to
  `_enterState('AWAKE', now)` + `_awakeDur = 1e9` hold +
  `_enterState('DORMANT', now)`.
- **Smoke M9.2 section** (9 checks, smoke/smoke.mjs): registration (cfg
  sane, DORMANT idle, hooks API, draw-call baseline); `wake()` ⇒ STIR
  with `onAwaken` fired once (fake system pushed onto `S.systems`,
  popped at cleanup) + STIR hook; STIR pose monotone within bounds +
  ringA angular velocity > idle spin; forced STIR→AWAKE with the picked
  hold in [10, 20] s; AWAKE full pose exact + ring Δang vs
  `spin·boost·Δt` (tol 0.02) + mid-sequence `wake()` no-op (count
  unchanged); forced AWAKE→DECAY (hook order exact); forced DECAY→
  DORMANT clean — pose exactly 0/43.6/0, node instance colors
  byte-exact at base, hook order `[STIR, AWAKE, DECAY, DORMANT]`,
  draw calls back to baseline, hero light back to dormant range;
  immediate re-trigger ⇒ STIR again (count 2, onAwaken 2) + a second
  full forced cycle resolving clean (re-trigger-safe). The dream wave is
  parked (+60 s) around the section since M9.1 leaves its re-seeded
  deadline only 14–26 s out.


## Timeline

- time: 2026-09-17T19:28:50
  kind: decision
  summary: "Created this page: M9.2 wake state machine: DORMANT → STIR → AWAKE → DECAY → DORMANT with per-state hooks"
  source: created via brain create-page
  affects: [m92-wake-state-machine]

- time: 2026-09-17T19:29:56
  kind: decision
  summary: "M9.2 wake state machine: DORMANT→STIR(2s)→AWAKE(10–20s)→DECAY(3s)→DORMANT on ENTITY — wake() trigger, _enterState, per-state hooks, onAwaken, wakeP pose (head lift/jaw/ring boost), integrated ring angles, seeded AWAKE hold, stateT fast-forward smoke contract"
  source: brain update-truth
  affects: [m92-wake-state-machine]

- time: 2026-09-18T07:44:38
  kind: decision
  summary: "M9.4: beats 4–5 (city-level cascade) hang off the machine — fires at AWAKE + cascade.pulse.delay / traffic.delay, gated on _ignited, one fire per sequence (re-armed at STIR entry), torn down at DORMANT entry (wave restored exactly, plaza pulse dropped mid-life, traffic roles cleared). Beat times in _beatAt.cascade/.traffic; see m94-city-cascade."
  source: M9.4 implementation
  affects: [m92-wake-state-machine, m94-city-cascade]
