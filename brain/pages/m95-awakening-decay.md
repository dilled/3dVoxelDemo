---
id: m95-awakening-decay
title: "M9.5 awakening beats 6–7 + decay: easter-egg reaction hook, outward dim, one final pulse, back to DORMANT"
category: decision
status: active
tags: [m9, entity, decay, egg, fx]
created: "2026-09-18T16:31:25"
updated: "2026-09-18T16:32:12"
---

<!-- compiled_truth -->
## Decided

- **M9.5 beats 6–7 extend the M9.2/M9.3/M9.4 sequence (no new system)** —
  the decay half of the awakening, all tunables in `CFG.entity.beats`:
  - **Beat 6** (the Unsloth easter-egg reaction hook for M10.3) fires at
    AWAKE + `egg.delay` (4.2 s): `ENTITY.eggReact(fn)` registers a
    reaction; `fn('start', t)` at the fire, `fn('end', t)` at DORMANT
    entry. Gated on `ENTITY._ignited && state === 'AWAKE'` (a forced
    non-sequence AWAKE never fires it), one fire per sequence
    (`_eggFired`), timer from `_awakeT0`, re-armed at STIR entry, beat
    time in `_beatAt.egg`. **Nothing is visible until M10 lands** — M10.3
    is the only consumer; the smoke registers a fake reaction to verify
    the hook.
  - **Beat 7** (decay) is two things: (a) the ignited node grid **dims
    outward** during DECAY — a dim front travels outward from head level
    (speed `ENTITY._dimSpeed = (maxR + ignite.width) / (wake.decay ·
    decayDim.at)`, computed in init) and each node's lit excess scales by
    `(1 − dm)` as the front passes (smoothstep over `ignite.width`); the
    front passes the farthest node + width at `decayDim.at` (0.85)
    fraction of DECAY ⇒ the DORMANT-entry byte-exact restore is
    **pop-free**. (b) **one final pulse** fires at the DECAY→DORMANT
    transition: `FX.pulse((0, 0.4, 0), finalPulse.radius 820, 0x9fdcff,
    life 5)` — radius deliberately ≠ the M9.4 cascade pulse radius (660)
    so the teardown drop check keeps a distinct signature.
  - The **"hum settles" audio is M11.3** — no audio system exists yet;
    the DECAY/DORMANT state-entry hooks (`ENTITY.hook`) are the seam.
- **The final pulse fires only for a real sequence**: the transition
  block captures `wasIgnited = ENTITY._ignited` before
  `_enterState('DORMANT')` clears it; a forced non-sequence state never
  ignited the grid, so it never gets a final pulse. `_finalPulseIt`
  holds the pool item until the next STIR entry (cleared there, not at
  DORMANT entry — the pulse is still alive then).
- **Impact on pre-existing smoke checks (by design)**: a live final
  pulse at DORMANT entry adds the shared ring's +1 draw call (ring
  `visible` flag is always true, so the visible-set checks are
  unaffected — only call counts and `FX.count` move): M9.2 checks 7/8
  now expect `reg.calls + 1`; M9.4 check 10 expects `fx === 1` (and it
  is the final pulse: radius 820, origin 0/0.4/0), check 12 `fx >= 1`;
  M9.3/M9.4/M9.5 section starts wait out the previous section's final
  pulse (`FX.count === 0`, 5 s life) before baselines.
- **Gate**: full sequence ends in DORMANT with exactly one final pulse
  (fx === 1, the 820 m one), node colors byte-exact, pose exact, egg
  reaction got `['start','end']`, visible set back to baseline; the
  final pulse resolves clean (fx === 0); immediate re-trigger re-arms
  beat 6 (`_eggFired` false at STIR) and re-fires everything
  (`['start','end','start','end']`, second final pulse, count 8).
  No screenshot gate — the analytic checks are strictly stronger than
  a picture (the dim is a brightness ramp, the pulse is the shared
  ring).
- **Note**: the pre-existing timing-sensitive flakes (M6.2 heap-flat,
  M7.3 bolt regen, M7.5 key-N shake, M8.1 star brightness, M9.4
  vehicle ease-out) flake in this headless environment (rAF/keyboard
  latency / GC noise) — re-verified to fail identically at the
  pre-M9.5 HEAD baseline (M7.5 `energy=1.18` vs the 1.2 threshold),
  environmental, not M9.5 regressions.


## Timeline

- time: 2026-09-18T16:31:25
  kind: decision
  summary: "Created this page: M9.5 awakening beats 6–7 + decay: easter-egg reaction hook, outward dim, one final pulse, back to DORMANT"
  source: M9.5 implementation
  affects: [m95-awakening-decay]

- time: 2026-09-18T16:32:12
  kind: decision
  summary: "M9.5: beats 6-7 + decay implemented and verified (full truth)"
  source: brain update-truth
  affects: [m95-awakening-decay]
