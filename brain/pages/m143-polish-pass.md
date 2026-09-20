---
id: m143-polish-pass
title: "M14.3: polish pass — static DOM vignette, Key H help overlay, tuned shake/flash/title fade (feel pass)"
category: decision
status: active
tags: [m14, polish, ui, fx, tuning]
created: "2026-09-20T05:38:35"
updated: "2026-09-20T05:39:00"
---

<!-- compiled_truth -->
## M14.3 — Polish pass

M14.3 finishes the demo's feel/UI polish (last item before the M14.4 robustness pass):

- **Vignette** = `#vignette`, a STATIC DOM radial gradient (`radial-gradient(ellipse at 50% 46%, transparent 0/55%, rgba(2,5,12,0.45) 100%)`), `position:fixed`, `pointer-events:none`, z-index 5 — above the canvas, below the z-10 UI layer. **No JS ever writes it** (computed style verified invariant across frames): one composited layer, zero per-frame cost. Durable choice: post-style visual effects live in static DOM layers, not shaders/JS per-frame work.
- **Help overlay** = `#help`, centred control-list panel in `.ui`, hidden by default (`display:none` ⇒ zero cost), `pointer-events:none` (pass-through). Key H (`INPUT.help` edge, repeat-guarded, RUNNING only) → `HUD.update` consumes it **BEFORE** the hidden-stats early return, so the toggle works in every stats state; `.on` class + `aria-hidden`. The overlay carries the 6-line control list; the hint line gained `· H help`.
- **Mute key M** re-verified working (the M11.1 choke point: mute gain → 0 and back).
- **Tuning decisions** (deliberate, feel-pass-verified): `CFG.input.shakeAmp` 0.22 → 0.18 m (subtle, no nausea; shakeDecay 2.4 / shakeCap 1.5 / shakeImpulse 1.0 deliberately UNCHANGED to keep the M7.5 cap-hold margin ⇒ [[m75-camera-shake]]); `CFG.fx.flash.decay` τ 0.30 → 0.22 s (crisper, no lingering ⇒ [[m74-fx-flash]]); `CFG.intro.beat4` fadeIn/fadeOut 0.5/0.6 → 0.7/0.7 (gentler title fade, 0.6 s hold ⇒ [[m122-intro-beats-reveal-orbit-title-drop]]; the M12.2 smoke title-fade expectations were updated to the tuned windows, peak at 12.3 s still exactly 1).
- **Verification:** smoke section 9h (11 checks, after M14.2, before the no-errors gate) — vignette static/radial/pe-none/z-order + provably 0 JS writes; help hidden default → H shows (control list, pass-through) → works with the stats block hidden → H hides (no leftover edge); mute M; tuned shake (Key N: monotone → exactly 0 in < 0.8 s, measured ~0.35 s, camera exactly on pose one frame later); tuned flash (Key B: monotone → exactly 0 in < 1.6 s, measured ~1.13 s, plane hidden); tuned title fade (`_applyBeatFx` pure-function sampling + `_resetFx` restore); no leftover state. Full suite 3 runs on final code: M14.3 11/11 every run, zero page/console errors; only failures are the documented pre-existing headless flakes ([[smoke-harness-dev-tooling]]).


## Timeline

- time: 2026-09-20T05:38:35
  kind: decision
  summary: "Created this page: M14.3: polish pass — static DOM vignette, Key H help overlay, tuned shake/flash/title fade (feel pass)"
  source: "M14.3 implementation (99ebced)"
  affects: [m143-polish-pass]

- time: 2026-09-20T05:39:00
  kind: decision
  summary: "M14.3 polish pass: static DOM vignette (never JS-written, zero per-frame cost), Key H help overlay consumed before the hidden-stats early return, tuned shakeAmp/flash τ/title fade (M7.5 cap-hold margin preserved), smoke section 9h"
  source: "M14.3 implementation (99ebced)"
  affects: [m143-polish-pass]
