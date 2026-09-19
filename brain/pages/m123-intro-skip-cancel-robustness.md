---
id: m123-intro-skip-cancel-robustness
title: "M12.3: intro skip/cancel robustness — any gesture, 0.5 s fade, play state never blocked"
category: decision
status: active
tags: [intro, cinematic, skip, dom]
created: "2026-09-19T14:20:58"
updated: "2026-09-19T14:21:30"
---

<!-- compiled_truth -->
M12.3 makes the intro skippable/cancellable at ANY moment, by ANY gesture. `INTRO.skip()` — idempotent, guarded by `BOOT.state === 'INTRO' && !INTRO._skip` — is wired from three places: the START button click, `pointerdown` on `window` (click anywhere), `keydown` on `window` (any key, non-repeat). It calls `AUDIO.unlock()` (the skip IS a user gesture — M11.1), sets `INTRO.playing = false` (timeline frozen: dolly/pose hold their last values, no beat FX), and starts `INTRO._skip = { t: 0, done: false }`. `INTRO._updateSkip(dt)` (called from `INTRO.update` before the play branch while `_skip` is non-null) drives the fade on the existing `#introFade` DOM element (JS-driven opacity, no CSS transition): first `CFG.intro.skip.fade/2` (0.25 s) ramps opacity 0→1 while the last intro pose holds; AT the midpoint it sets `done`, calls `INTRO._toStreet()` → `BOOT.enter('RUNNING')` — the PLAY STATE IS LIVE BEFORE THE FADE FINISHES — and ramps opacity 1→0 over the next 0.25 s; on completion `_skip = null`, opacity 0.

The START button is visible only after 2 s of the intro, as a pure function of intro time: `_applyBeatFx` toggles the `.on` class on `#startBtn` ⇔ `t ≥ CFG.intro.skip.delay` (2 s). CSS: `#overlay.intro #startBtn` is hidden (opacity 0, `pointer-events: none`) unless `.on` — before 2 s, clicks pass through to the window pointerdown listener (which also skips); after 2 s the button is clickable. `CFG.intro.skip = { fade: 0.5, delay: 2 }`.

Constraints:
- The skip fade is exactly 0.5 s (0.25 s out + 0.25 s in); the START visibility delay is exactly 2 s.
- `skip()` is idempotent while a fade is in flight (`_skip` non-null — a second gesture keeps the one fade, never restarts it); `play()` resets `_skip = null` (re-entry starts a clean intro).
- While the fade runs the timeline is frozen (`INTRO.playing = false`): no beat FX, no dolly, no pose — the fade element is the only thing animating.
- `_resetFx` (beat FX teardown, called by `_toStreet`) must NOT zero `#introFade` while a skip fade is in flight — guarded by `INTRO._skip`.
- The natural finish is unchanged (beat 5 → `_toStreet()` with no fade); the fade exists only for the skip path. Zero new objects/materials/lights: the fade reuses the existing `#introFade` element.

Smoke: M12.3 section in `smoke/smoke.mjs` (15 checks, after M12.2): hidden before 2 s (class off / pe none / opacity 0), visible-delay boundary (`seek(1.9)` off / `seek(2.1)` on), visible after 2 s (on / pe auto / opacity 1), early skip via a plain page click (in-flight: skip active + timeline frozen + still INTRO; fade animates 0<f<1 while INTRO — per-frame poll; idempotent second gesture; RUNNING entered WHILE the fade is on screen; end: RUNNING at (0,4,18), beat FX off, fade done; W-controllable), late interrupt via Escape keypress (same in-flight / live / end / controllable checks), natural finish (end + controllable).

GOTCHA: headless SwiftShader runs ~5–10 fps — the 0.5 s fade spans ~5 frames; in-flight checks must poll per frame (`waitForFunction` with rAF polling) rather than sample at a fixed offset after the gesture (a fixed +50 ms sample can land before the first fade frame, a +250 ms sample can land exactly on the midpoint frame).


## Timeline

- time: 2026-09-19T14:20:58
  kind: decision
  summary: "Created this page: M12.3: intro skip/cancel robustness — any gesture, 0.5 s fade, play state never blocked"
  source: created via brain create-page
  affects: [m123-intro-skip-cancel-robustness]

- time: 2026-09-19T14:21:30
  kind: decision
  summary: "M12.3: intro skip/cancel robustness — any gesture (START/click/keypress) → idempotent 0.5 s fade to the street camera; RUNNING entered at the fade midpoint; START visible only after 2 s"
  source: "M12.3 implementation + full smoke suite (M12.3 15/15 in 3 runs, zero console errors)"
  affects: [m123-intro-skip-cancel-robustness]
