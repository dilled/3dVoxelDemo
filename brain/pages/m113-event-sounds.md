---
id: m113-event-sounds
title: "M11.3: event sounds (pulse thump / arc crackle / steam hiss / drone whir) — fire-and-forget Web Audio one-shots wired to the M6–M9 emitter call sites"
category: decision
status: active
tags: [audio, webaudio, events]
created: "2026-09-19T06:21:07"
updated: "2026-09-19T06:21:07"
---

<!-- compiled_truth -->
`AUDIO` (single `index.html`, exposed on `window.SIM`) now owns the four M11.3 **event sounds**, fired from the real M6–M9 emitter call sites as **fire-and-forget Web Audio one-shots**:

- **Pulse thump** (`AUDIO.pulseThump()`) ← `FX.pulse()` — sine pitch drop (`f: [130, 38]` Hz, exponential) + a short low-passed (420 Hz) noise hit, gain 0.50 on master.
- **Arc crackle** (`AUDIO.arcCrackle()`) ← `FX.arc()` — 5 sharp on/off band-passed (2400 Hz) noise bursts over 0.5 s, gain 0.16.
- **Steam hiss** (`AUDIO.steamHiss()`) ← `PARTS._spawnSteam(it, src)` — band-passed (3200 Hz) noise, fast attack, 1.2 s decay, gain 0.05 (one per puff).
- **Drone whir** (`AUDIO.droneWhir()`) ← `TRAFFIC._spawn(it)` — band-passed noise with a rising center sweep (700→1800 Hz, rotor spin-up), gain 0.07 (one per drone launch).

All tunables in `CFG.audio.events`. Every one-shot's output gain connects to `AUDIO.master` (the M11.1 choke point ⇒ the M key mutes all event sounds at zero cost; never a second compressor/destination). `FX.flash` is deliberately silent (out of M11.3 scope — lightning/arc events carry the crackle). Zero cost when idle: nothing added to `AUDIO.update` — each one-shot stops its own sources. A shared 2 s noise buffer (`AUDIO._evNoise`, one buffer at unlock) feeds every noise one-shot; per event only the self-stopping one-shot nodes are allocated.

**Durable Web Audio gotcha — self-stopping ≠ collected:** a one-shot subgraph wired into `AUDIO.master` stays reachable from the graph forever (the graph holds strong references), so `osc.stop()`/`src.stop()` alone leaks every fired event (at ambient steam rate ~8 puffs/s this is a visible heap growth). Fix: on the LAST source's `onended`, call `g.disconnect()` on the one-shot's output gain — the whole subgraph becomes unreachable and is collected. Applied to all four M11.3 one-shots AND the M11.2 machine thump (same pattern). Verified with an A/B heap experiment: 370 forced one-shots → +0.27 MB net, ambient 10 s window flat, with-events vs without-events 3×8 s windows indistinguishable.

**Wiring verification (headless gotcha, same as M11.1/M11.2):** the headless smoke Chrome build exposes no `inputs`/`outputs`/`connections` on `AudioNode`, so the app captures `AUDIO.eventsWired = { pulse, arc, steam, drone }` from `connect()` return values (`gain.connect(AUDIO.master) === AUDIO.master`) and keeps per-type fire counters `AUDIO.events = { pulse, arc, steam, drone }` — "each event produces its sound" = each emitter's call site increments its counter exactly once per fire.

**Smoke (M11.3 section, 8 checks, after M11.2, page already RUNNING):** counters + shared noise buffer exist; pulse thump / arc crackle fire from the real `FX.pulse` / `FX.arc` call sites (counter +1, then `dropPulse`/`dropArc` cleanup); steam hiss from `PARTS._spawnSteam` (synthetic `src {x,z,hTop,r}`; the steam pool is saturated at cap ⇒ free a slot with the real trim path `_sReleaseAt(0)` first); drone whir from `TRAFFIC._spawn` (pool at cap ⇒ `_releaseAt(0)` first; `_spawn` early-returns when the seeded dock search finds no dock ⇒ retry loop); all silent when muted (fire every type while the M-key mute is on — counters still move, muteGain 0, choke point); `eventsWired` all true; heap flat (min-of-3, ≤ 2 MB, no errors).

**Verification:** full suite 3 runs — M11.3 8/8 in 2 runs (the single failure was the heap-flat check, same environmental class); all other failures are the documented pre-existing headless flakes (M7.3 bolt cadence, M7.5 shake `energy=1.18`, M8.1 star brightness, M9.4 vehicle ease-out, M11.2/M6.2-class heap). The M11.2 "heap flat" check was re-verified to flake identically at the pre-M11.3 HEAD baseline (git worktree run: Δ=2.55 MB FAIL vs Δ=-5.08 MB PASS) ⇒ environmental GC noise, not an M11.3 regression.

**Seams:** M11.4 spatial-ish mixing (one panner + distance gain for the 2–3 nearest emitters) wraps these same one-shot call sites; M14.1 tiers can scale `CFG.audio.events` levels.


## Timeline

- time: 2026-09-19T06:21:07
  kind: decision
  summary: "Created this page: M11.3: event sounds (pulse thump / arc crackle / steam hiss / drone whir) — fire-and-forget Web Audio one-shots wired to the M6–M9 emitter call sites"
  source: created via brain create-page
  affects: [m113-event-sounds]

- time: 2026-09-19T06:21:07
  kind: decision
  summary: "M11.3 implemented: four event one-shots (pulse thump / arc crackle / steam hiss / drone whir) wired to the FX.pulse / FX.arc / PARTS._spawnSteam / TRAFFIC._spawn call sites, all on AUDIO.master; onended→disconnect() collection fix (self-stopping ≠ collected); eventsWired + fire counters for headless verification; smoke 8 checks"
  source: brain update-truth
  affects: [m113-event-sounds]
