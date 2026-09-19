---
id: m112-looping-beds
title: "M11.2: looping beds (reactor hum / fans / distant machinery) — three always-on Web Audio beds on AUDIO.master"
category: decision
status: active
tags: [audio, webaudio, beds, ambient]
created: "2026-09-19T04:00:36"
updated: "2026-09-19T04:01:39"
---

<!-- compiled_truth -->
`AUDIO` (single `index.html`, exposed on `window.SIM`) now owns three always-on looping beds built at unlock and connected to `AUDIO.master` (the M11.1 master graph — never a second compressor or destination path):

- **Reactor hum:** two detuned sines (`f1` 55 Hz + `f2` 55.66 Hz, slow beat) + a sub sine (27.5 Hz, `subGain` 0.5) into one bed gain (0.22) on master.
- **Fans:** looped white-noise `AudioBufferSourceNode` (4 s buffer, `loop = true`) through a band-pass BiquadFilter (center 1310 Hz, Q 1.4) into a bed gain (0.16) on master.
- **Distant machinery:** looped white-noise buffer (6 s) through a low-pass BiquadFilter (300 Hz) into a bed gain (0.10) on master, plus **random low thumps**: a sine with a pitch drop (f → 0.55 f) and exponential-decay gain envelope, self-stopping, fired by a deadline scheduler.

**Bed motion is driven from the central `update(dt, t)` loop, not oscillator LFOs wired into AudioParams.** `AUDIO` is a system (registered after ATMOS, before HUD). Per frame it writes two deterministic sinusoids: the hum-gain swell (`gain · (1 + depth·sin(2π·0.07·t))`) and the band-pass center sweep (`mid ± (range/2)·sin(2π·0.05·t)`, range 420–2200 Hz). Rationale (durable): (a) the project ground rule is that everything animated is driven by the central `update(dt, t)` loop; (b) `AudioParam.value` does NOT reflect connected-input (LFO) modulation — it returns the base value — so an oscillator-LFO sweep is unobservable to the smoke harness (and hard to verify in any browser); the deterministic formula is exactly checkable. (First attempt used oscillator LFOs wired to `gain.gain` / `filter.frequency`; smoke read Δ=0.0 because of (b).)

**Thump scheduler:** `beds.machine.nextThumpAt` on the `performance.now()/1000` clock (same pattern as `ATMOS._ltTimer` / `ENTITY._autoAt`); when due, `_thump()` fires and the deadline re-arms into `every: [5, 14] s` using a seeded `mulberry32(0x51A7C3)` (stored `AUDIO._rng`). `thumpCount` counts fires. Thumps are fire-and-forget (oscillator + gain envelope, `osc.stop(...)` self-cleanup) — the only allocation in the beds, and it is a random event, not per-frame work.

**All tunables in `CFG.audio`** (`hum` / `fan` / `machine`) — the scaling point for M14.1 tier caps. Looped buffers are ≥ 4 s ⇒ no audible repeat; the beds run indefinitely (oscillators + looped buffers, no `update`-driven restart).

**Smoke (M11.2 section, 11 checks, after M11.1, page already RUNNING):** node types (OscillatorNode ×3, AudioBufferSourceNode ×2, BiquadFilterNode ×2); hum frequencies exactly from CFG; hum swell + band-pass sweep checked against the **exact deterministic formula** at two time points (0 s and 5 s) with tolerances covering ≤ ~0.1 s frame/IPC lag (0.01 gain / 40 Hz — derivatives: swell ≤ 0.024/s, sweep ≤ 280 Hz/s); fan/machine `loop === true` + buffer duration ≥ 3 s + filter types; forced thump (`nextThumpAt = now − 0.01` in-page → `thumpCount +1`, deadline re-armed into [5, 14] s); long-run window (ctx `running`, bed gains intact, zero page errors); heap flat (min-of-3, ≤ 2 MB); M-key mute → muteGain 0 with bed gains untouched. Full suite ALL PASS (299/0) in 2 consecutive runs; the "machine city within 3 s" gate is qualitative — the proxy is all three beds live at once, each with its own spectral element, running error-free over the long window.

**Seams:** M11.3 event sounds connect to `AUDIO.master` too (the pulse thump / arc crackle / steam hiss / drone whir); the M9.5 "hum settles" (DECAY/DORMANT state-entry hooks) can ramp the bed gains — `AUDIO.beds.{hum,fan,machine}.gain` are the scaling points (also used by M14.1 tiers). The "systems registered in fixed order" smoke check now expects `INPUT, CAMERA, KIT, WORLD, ENTITY, TRAFFIC, PARTS, FX, ATMOS, AUDIO, HUD`.


## Timeline

- time: 2026-09-19T04:00:36
  kind: decision
  summary: "Created this page: M11.2: looping beds (reactor hum / fans / distant machinery) — three always-on Web Audio beds on AUDIO.master"
  source: M11.2 implementation
  affects: [m112-looping-beds]

- time: 2026-09-19T04:01:39
  kind: decision
  summary: "M11.2 implemented: three always-on beds (hum / fans / machinery) on AUDIO.master; bed motion (hum swell, band sweep) driven as deterministic sinusoids from AUDIO.update() — oscillator LFOs into AudioParams are unobservable (AudioParam.value returns base value); random low-thump deadline scheduler (nextThumpAt, seeded mulberry32); CFG.audio tunables; smoke 11 checks green, full suite ALL PASS ×2"
  source: M11.2 implementation
  affects: [m112-looping-beds]
