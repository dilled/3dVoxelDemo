---
id: m111-audio-master-graph
title: "M11.1: Web Audio master graph (master→compressor→muteGain) + gesture gate + M-key mute"
category: decision
status: active
tags: [audio, webaudio, master-graph, mute, gate]
created: "2026-09-19T02:37:50"
updated: "2026-09-19T02:38:27"
---

<!-- compiled_truth -->
`AUDIO` (single `index.html`, exposed on `window.SIM`) is the Web Audio master graph, built inside the START-click gesture and never before:

- **Graph:** `master` (GainNode, 0.8) → `comp` (DynamicsCompressor) → `muteGain` (GainNode, 1.0) → `ctx.destination`. Everything the game makes (M11.2 beds, M11.3 event sounds, M11.4 spatial sources) connects to `AUDIO.master`; the compressor and the mute gain are the only two choke points. Muting is `muteGain` (the last stage before destination) ⇒ "mute key mutes everything" at zero cost.
- **Gesture gate:** `AUDIO.unlock()` is only ever called from `BOOT.enter('RUNNING')` (the START click — see [[three-cdn-pin-boot-watchdog]]). No `AudioContext` exists before that gesture; `unlock()` is idempotent (second call = resume path).
- **Mute:** `M` key (INPUT keydown, repeat-guarded, RUNNING-guarded) → `AUDIO.toggleMute()` → `setMuted(on)` → `muteGain.gain.setTargetAtTime(0|1, t, 0.02)`; `AUDIO.muted` flag. HUD shows `MUTED` / `mute: M`; hint line reads `F awaken · M mute`.
- **Resume-safe:** `_resume()` calls `ctx.resume()` (with `.catch`) when state is `suspended`; wired once at unlock via `pointerdown`/`keydown`/`visibilitychange` listeners (`_gestureWired` guard — zero cost before the first gesture). Refresh / re-entry just rebuilds the module fresh and hits the same path.
- **Wiring verification (headless gotcha):** the headless smoke Chrome build exposes NO `inputs`/`outputs`/`connections` on `AudioNode` and no `DynamicsCompressor` global, so the smoke harness cannot introspect the graph. Instead the app captures `AUDIO.wired` at build time from `connect()` return values (spec: returns the destination node): `wired = (master.connect(comp)===comp) && (comp.connect(muteGain)===muteGain) && (muteGain.connect(destination)===destination)`. Smoke asserts node constructor names (`GainNode` / `DynamicsCompressorNode` / `AudioDestinationNode`) + `wired` + gain values + behavior.
- **Smoke (M11.1 section, 9 checks, after M10.3):** reloads the page (pre-gesture check needs a fresh LOADER page), asserts `AUDIO.ctx === null` before START, graph/types/wired + `state === 'running'` after, M-key mute→0 / unmute→1 by gain value, refresh → fresh module (ctx null again) → re-entry unlocks a fresh running context, no page/console errors. After the reload it re-parks `ATMOS._ltTimer` + `ENTITY._autoAt` like the other sections.
- M11.2+ seam: connect beds/events to `AUDIO.master`; per-source panners (M11.4) go on `master` too — never a second compressor or destination path.


## Timeline

- time: 2026-09-19T02:37:50
  kind: decision
  summary: "Created this page: M11.1: Web Audio master graph (master→compressor→muteGain) + gesture gate + M-key mute"
  source: M11.1 implementation
  affects: [m111-audio-master-graph]

- time: 2026-09-19T02:38:27
  kind: decision
  summary: "M11.1 implemented: master graph (master 0.8 → compressor → muteGain → destination), START-click gesture gate, M-key mute, resume-safe; headless WebAudio exposes no node introspection ⇒ app-side AUDIO.wired flag from connect() return values; smoke M11.1 9 checks green in 3 runs"
  source: M11.1 implementation
  affects: [m111-audio-master-graph]
