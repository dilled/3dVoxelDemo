---
id: m94-city-cascade
title: "M9.4 awakening beats 4–5: the city-level cascade (plaza pulse + per-ring LED/sign wave + traffic reaction)"
category: decision
status: active
tags: [m9, entity, cascade, traffic, fx]
created: "2026-09-18T07:42:25"
updated: "2026-09-18T13:08:44"
---

<!-- compiled_truth -->
<!-- compiled_truth -->
## Decided

- **M9.4 beats 4–5 extend the M9.2/M9.3 sequence (no new system)** with the
  city-level cascade, all tunables in `CFG.entity.beats.cascade`:
  - **Beat 4** fires at AWAKE + `pulse.delay` (2.2 s): the plaza energy-pulse
    ring (`FX.pulse` at `(0, 0.4, 0)`, R = `pulse.radius` 660 m,
    life = `pulse.life` 4 s, tint `pulse.color` 0x66e0ff) **and** the city
    holo-sign / LED-facade wave.
  - **Beat 5** fires at AWAKE + `traffic.delay` (3.2 s): the traffic
    cascade (see TRAFFIC page).
  - Both fires are gated on `ENTITY._ignited && state === 'AWAKE'` (a forced
    non-sequence AWAKE never cascades), one fire per sequence
    (`_cascadeFired` / `_trafficFired`), timers measured from `_awakeT0`,
    re-armed at STIR entry, beat times in `_beatAt.cascade` / `.traffic`.
- **Wave owner = WORLD**: `WORLD.awakenWave(t)` arms
  (`_waveT0` = wavefront t0, `_waveActive` = true), `WORLD.awakenWaveEnd()`
  ends it exactly (idempotent). Per-instance brightness =
  `1 + (bright − 1)·_waveEnv(tau, atk, hold, release)` where
  `tau = ((t − _waveT0)·speed − d)/speed` (s since the front passed the
  instance, ≤ 0 = not yet; `d` = distance from the plaza **precomputed at
  fill** in `pars[i].d` — zero per-frame cost),
  `atk = width/speed` (165 m/s front, 26 m width), smoothstep attack →
  1.2 s lit hold → 1.6 s smoothstep release ⇒ back to exactly 1.0.
  The wave self-terminates when front + release have passed the farthest
  visible instance, then restores. This is the "thousands of compute
  nodes illuminate" moment: each city ring lights as the front crosses it.
- **sign + ledWin detail meshes now carry a pre-allocated instanceColor**
  (`col: true` in the M4 `_detailMesh` call): 1.0 = idle; a (re)filled
  chunk's sign/ledWin slots are reset to exactly 1.0 (stale pooled-slot
  invariant). Restore (`WORLD._waveRestore`) writes exactly 1.0 to every
  visible chunk's sign/ledWin slots — byte-exact, one pass, only at wave
  end.
- **Beat 5 owner = TRAFFIC**: `TRAFFIC.awaken()` / `TRAFFIC.awakenEnd()`
  — drones scatter (state 3: fly outward from the plaza to
  `rx/ry/rz`, then back to the dock), escort (state 4: re-route to a hover
  ring at creature height, hold `escortHold` s, then back), or hold normal
  patrol; sky vehicles take eased avoidance offsets (lateral `ox` away
  from the plaza + `oalt` altitude bump, level `av` eases in/out over
  `avoidRamp` while `avoidT > 0` — **render pose only**, the analytic
  lane state is untouched and the offset eases back to exactly 0);
  up to 3 staggered substation bolts (0 / `arcStagger` / 2·`arcStagger`
  s) between the 4 nearest substations (pre-allocated `_arcPairs` /
  `_arcSel` / `_arcSubs`); a steam burst via `PARTS.steamBurst(12)`.
  New drone pool fields: `rx/ry/rz` (reaction target), `roleT` (escort
  hover remaining), states 3/4 handled in the existing flight update.
- **DORMANT entry tears the whole cascade down**: `WORLD.awakenWaveEnd()`,
  the plaza pulse item dropped even mid-life (only if it still matches the
  cascade signature — a released item may have been re-acquired by a dev
  trigger: `ox === 0 && oz === 0 && R === pulse.radius`), `TRAFFIC.awakenEnd()`
  (reaction drones → state 2, vehicle offsets ease out, not-yet-fired
  bolts cancelled, live bolts dropped via `FX.dropArc`). New `FX.dropPulse(it)`
  / `FX.dropArc(it)` public APIs (swap-remove + pool release, no-op for
  foreign/released items).
- Zero new persistent draw calls (wave reuses sign/ledWin meshes;
  pulse/arc/steam/drones/vehicles reuse existing FX + TRAFFIC + PARTS
  pools); all per-instance/per-drone data pre-allocated ⇒ heap flat.
- **Smoke M9.4 section** (12 checks, smoke/smoke.mjs, after M9.3):
  registration (cfg sane, DORMANT idle, all colors 1.0); beat 4 — plaza
  pulse live (origin, R, owned by `ENTITY._pulseIt`) + wave armed at
  `_beatAt.cascade`, Δ from ignite = 2.2 s; ring-by-ring travel — two
  scheduled rings (A ≥ 60 m, B ≥ A+100 m) sampled inside their waits:
  A lit (>1.5) while B exactly 1.0 with ahead-dim verified, then both lit
  with front radius advanced A→B; beat 5 — scatter + escort roles
  assigned, every live vehicle got full avoidance at fire (snapshotted
  via wait-predicate side-effect `__m94av0`), bolts queued, steam burst,
  Δ from ignite = 3.2 s; live arcs observed; per-drone monotonicity
  (scatter radial outward, escort closing on hover target — the mean over
  the shrinking in-flight set is NOT monotonic, completers drop out);
  vehicle avoidance invariants (rendered lateral ≈ `ox·av` within one
  lane step, altitude exact, at-rest vehicles exactly on lane); heap flat
  across the full cascade; visual gate — street pose, wavefront pinned to
  400 m, region anchored on a lit instance projected into frame; the LED/sign
  canvas textures are FROZEN for the off/on pair (the 15 Hz LED flicker +
  scanline and 8 Hz sign flicker otherwise animate between the two shots and
  confound the brightness delta — the facade texture is a deterministic
  function of sim time, so freezing makes the pair clean), and the SUM of the
  per-candidate region-mean Δ over the 20 nearest lit instances is used (not
  the best — an occluded candidate's region reads Δ≈0 and per-facade LED-cell
  flicker averages out over the sum); pass if ΣΔ > 0.25
  (`smoke/shots/m94-city-cascade.png`); forced
  AWAKE→DECAY→DORMANT — colors byte-exact 1.0, wave off, pulse dropped
  mid-life (FX 0), bolts dropped, no drone states 3/4, hero light back in
  dormant range, visible-object SET identical to baseline; vehicle
  offsets eased out to exactly 0 (hulls back on analytic lanes);
  re-trigger re-arms (count 6) + second full forced cycle fires + resolves
  clean.
- M6.3 harness flake fix (same commit): the at-cap vehicle wait requires
  the at-cap state to be **stable** — no live vehicle within a few metres
  of the release boundary (a vehicle is released the moment it flies
  past the hold radius, so a transient at-cap sample can read one short).


## Timeline

- time: 2026-09-18T07:42:25
  kind: decision
  summary: "Created this page: M9.4 awakening beats 4–5: the city-level cascade (plaza pulse + per-ring LED/sign wave + traffic reaction)"
  source: created via brain create-page
  affects: [m94-city-cascade]

- time: 2026-09-18T07:44:00
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M9.4 implementation
  affects: [m94-city-cascade]

- time: 2026-09-18T13:08:44
  kind: decision
  summary: "Visual gate fix: freeze LED/sign canvas textures for the off/on pair (the 15 Hz LED flicker/scanline otherwise animates between the shots and confounds the delta) and use the SUM of per-candidate region-mean Δ (not the best) with threshold 0.25"
  source: M9.4 visual gate fix
  affects: [m94-city-cascade]
