---
id: m114-spatial-mixing
title: "M11.4: spatial-ish mixing — panner + distance-gain pool for the 2–3 nearest emitters; overflow folds into the ambient master"
category: decision
status: active
tags: [audio, webaudio, spatial]
created: "2026-09-19T08:22:52"
updated: "2026-09-19T08:24:05"
---

<!-- compiled_truth -->
`AUDIO` (single `index.html`, exposed on `window.SIM`) now does **spatial-ish mixing** over the M11.3 event one-shots: a small fixed pool of **3 channels**, each = a GainNode (distance gain, set at fire time) → a PannerNode (`panningModel 'equalpower'`, `distanceModel 'none'`) → `AUDIO.master` (M11.1 choke point ⇒ M-key mutes spatial events at zero cost). Only the **2–3 nearest emitters** are spatially processed; everything the pool cannot hold **folds into the ambient master** (no spatial treatment) — `AUDIO.spatialFolded` counts folds. All tunables in `CFG.audio.spatial = { channels: 3, refDistance: 6, rolloff: 1.0, minGain: 0.02, settle: 0.3 }`.

**Routing (`AUDIO._spatialSink(type, x, y, z, dur)`):** pick a free channel; if none free, steal the channel whose emitter is farthest when the new emitter is nearer (the pool always keeps the nearest emitters spatial); otherwise fold to master. Distance gain = Web Audio inverse model, floored: `d ≤ refDistance ? 1 : max(minGain, ref / (ref + rolloff·(d − ref)))`, measured from `CAMERA.pos`. The one-shot's own gain (M11.3 levels) connects to the channel gain instead of master (`_evGain(type, level, node)`); `eventsWired[type]` is set on the spatial path too, so the M11.3 "wired to master" check stays valid. Call sites pass the emitter position: `FX.pulse` → `origin`, `FX.arc` → midpoint(a,b), `PARTS._spawnSteam` → tower top `{src.x, src.hTop, src.z}`, `TRAFFIC._spawn` → drone `{px,py,pz}`.

**Listener drive (the only per-frame cost):** `AUDIO.update` writes the listener position + forward + up from `CAMERA.pos`/`yaw`/`pitch` (forward = `(−sin·cos, sin, −cos·cos)` — same convention as CAMERA.update; up = (0,1,0)) and releases channels whose hold (`dur + settle`) expired: 9 param writes + 3 comparisons/frame. Channels are reused — a spatial fire allocates only the one-shot itself. No `createPanner` support ⇒ `AUDIO.spatial` stays null and every fire folds (graceful degradation).

**Durable Web Audio gotchas:** (1) **AudioParam values are float32** — setting `gain.value = 0.4054424270396916` and reading it back yields `0.40544241666793823` (Δ≈1e-8); smoke assertions on read-back param values need ≥1e-6 tolerance (exact-integer positions like 12/3/-7 round-trip exactly). (2) **PannerNode internal attenuation is unobservable** in the headless build, so attenuation is done by the explicit channel GainNode (directly readable) and the panner is panning-only (`distanceModel 'none'`). (3) Modern API: `positionX/Y/Z` AudioParams on panner and `ctx.listener` (with `forwardX/Y/Z`, `upX/Y/Z`); legacy `setPosition`/`setOrientation` fallback kept.

**Smoke (M11.4 section, 7 checks, after M11.3, page already RUNNING):** pool exists (3× PannerNode, equalpower, wired flag from `connect()` return); listener tracks the camera (teleport → read back); **walking past an emitter attenuates it** — teleport −25/0/+25 past an emitter at origin, gain profile 0.237→1.000→0.237 checked against the exact inverse formula; channel panner sits at the emitter + channel gain IS the distance gain (1e-6 tolerance); 4 simultaneous equidistant fires ⇒ exactly 1 fold (`spatialFolded +1`); spatial fires mute at the choke point (counters move, muteGain 0); bounded cost (heap flat 5 s while the listener drives, no errors).

**Verification:** full suite 3 runs — M11.4 7/7 in all 3; M11.1–M11.3 sections green; zero page/console errors every run. Only failures are the documented pre-existing headless flakes (M7.5 shake `energy=1.18` exact baseline, M7.3 bolt cadence, M11.2-class heap Δ~2 MB, M6.2 dock / M6.4 spark / M9.4 wave-brightness observation windows — all flake-run confirmed or documented at prior HEADs).

**Seams:** M14.1 quality tiers can scale `CFG.audio.spatial.channels` / bed + event levels; M12 intro beats can drive the listener (camera) for spatialized beds if ever wanted.


## Timeline

- time: 2026-09-19T08:22:52
  kind: decision
  summary: "Created this page: M11.4: spatial-ish mixing — panner + distance-gain pool for the 2–3 nearest emitters; overflow folds into the ambient master"
  source: created via brain create-page
  affects: [m114-spatial-mixing]

- time: 2026-09-19T08:24:05
  kind: decision
  summary: "M11.4 implemented: panner + distance-gain channel pool (3 channels) for the nearest emitters, listener driven from CAMERA, overflow folds into the ambient master; smoke 7 checks, full-suite 3 runs M11.4 7/7"
  source: brain update-truth
  affects: [m114-spatial-mixing]
