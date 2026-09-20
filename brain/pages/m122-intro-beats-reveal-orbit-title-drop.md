---
id: m122-intro-beats-reveal-orbit-title-drop
title: "M12.2: intro beats 2–5 — corridor opens, wide reveal dolly, 1.5-orbit low orbit, title card, street drop"
category: decision
status: active
tags: [intro, cinematic, timeline, camera, dom]
created: "2026-09-19T12:31:37"
updated: "2026-09-20T05:40:46"
---

<!-- compiled_truth -->
The M12.2 full intro (single `index.html`, `INTRO` system on `window.SIM`) extends the M12.1 runner to beats 2–5. `BOOT.enter('INTRO')` now plays `INTRO._track()` (32 keyframes, 15.2 s) instead of `_beat1()`, still with `INTRO._toStreet` as onDone.

**Track (`INTRO._track`, all times s):** B1 0→4.4 corridor dolly (the 3 `_beat1` kfs). B2 4.4→7.2 "corridor opens": at t=4.4 the far end wall (`INTRO.endWall`, now a separate mesh — the shell merge dropped it) hides and the portal glow (`INTRO.portal`, 24×16 unlit quad at (0,8,−60.2), hidden until 4.4, opacity 0→1 over 0.6 s) floods the opening; the camera rushes to the wall (4.4→5.2), passes it (5.2→5.8) while a white DOM flash (`#introFade`, JS-driven opacity 0→1 5.2→5.8) ramps; AT the switch time tSw=5.8 the keyframe list carries a DUPLICATE time — corridor pose and city pose both at 5.8 — and the pair search (first pair with `t < next.t`) makes the city pose win exactly at 5.8; from tSw `INTRO._inCity` is true and `frame()` renders the CITY scene: `renderer.render(BOOT.state === 'INTRO' && !INTRO._inCity ? INTRO.scene : scene, camera)`; flash fades out 5.8→6.6 while a wide reveal dolly runs (0,160,300) look (0,26,0) → (0,260,460) look (0,18,0) by t=7.2. B3 7.2→11.6: dive 7.2→8.0 to the orbit start (0,64,104) (the +Z street side), then EXACTLY 1.5 orbits — 18 keyframes of 30° each, `ease: 'linear'` (constant angular speed), radius 104, height 64, look (0,32,0) (the creature is ~65 m tall at the plaza origin; r=104/h=64 clears the tallest possible spire there, a ~51 m fiber tower = 68·fall). B4 11.6→13.6: the DOM title card (`#introTitle`, text from `CFG.intro.beat4.text` = `QWEN FLASH // AWAKENING`, set in `INTRO.init`) fades in 0.7 s / holds 0.6 s / out 0.7 s (**M14.3 tuning**: 0.5/0.6 → 0.7/0.7, gentler) while the orbit drifts on — 4 more 30° linear kfs rising h 64→72. B5 13.6→15.2: smoothstep lerp from the orbit end (−90.1,72,52) into the M0 street spawn (0,4,18) look (0,2,0); the B5 start kf deliberately carries NO ease (the `orbitKf` spread is not reused for it) so the drop eases in AND out.

**Runner extension:** keyframes may carry `ease: 'linear'` (default smoothstep) — `_applyPose` uses `a.ease === 'linear' ? u : u·u·(3−2·u)`. Duplicate keyframe times at scene/beat boundaries are supported by the existing search unchanged.

**Beat FX are a pure function of `INTRO.t`** (`INTRO._applyBeatFx`, called from play/seek/update): `endWall.visible = t < 4.4`, `portal.visible = t >= 4.4` + opacity ramp, `#introFade.style.opacity` piecewise (0 → 1 over [5.2,5.8), 1 → 0 over [5.8,6.6)), `_inCity = t >= 5.8`, `#introTitle.style.opacity` piecewise over [11.6,13.6). ⇒ seeking to any time reproduces the exact beat state. GOTCHA: on natural end the update loop must NOT re-apply beat FX after onDone — at t=dur `_applyBeatFx` would re-open the corridor and re-set `_inCity`, clobbering `_toStreet`'s `_resetFx` (end wall visible, portal hidden, both DOM opacities 0, `_inCity` false); the end branch therefore skips it. `cancel()` also calls `_resetFx`.

**CFG.intro** gains `beat2 {dur 2.8, rush 0.8, fade 0.6, fadeOut 0.8}`, `beat3 {dur 4.4, dive 0.8, orbits 1.5, radius 104, height 64}`, `beat4 {dur 2.0, fadeIn 0.7, fadeOut 0.7, rise 8, text}` (**M14.3 tuning**: fadeIn/fadeOut 0.5/0.6 → 0.7/0.7, gentler, 0.6 s hold), `beat5 {dur 1.6}` (total 15.2 s). The corridor now renders in 5 draw calls (shell / endWall / racks / strips / dashes; portal hidden until beat 2). DOM: `#introTitle` + `#introFade` live in `.ui` after `#overlay`, `pointer-events: none`, opacity-driven (no CSS transitions — deterministic from the timeline).

**Smoke:** M12.2 section in `smoke/smoke.mjs` (17 checks, after M12.1): full track auto-plays (32 kfs, dur 15.2, title text), corridor opens (wall hidden + portal ≈ ⅓ + rush + on-curve), flash ramp at 5.5 (0.5, still corridor), scene switch at 5.8 (`_inCity`, flash 1.0, city pose (0,160,300)), flash released + reveal dolly + screenshot `shots/m122-reveal.png` (city mean/bright window), low orbit (r=104, h=64, lookDot at creature — read SAME-FRAME as the seek: `I.seek` + `camera.updateMatrixWorld()` + read in one evaluate, because matrixWorld lags one render and the intro advances between round-trips), exactly 1.5 orbits at t=11.6 → (0,64,−104), 18 linear r=104 kfs inside the beat-3 window, title card (opacity 1 + text + y rising; keyframe on the r=104 circle at 12.6; **M14.3-updated windows**: fade in ≈0.64 at 12.05 / out ≈0.29 at 13.4 — tuned beat4 0.7/0.7, peak at 12.3 s still exactly 1) + screenshot `shots/m122-title.png`, drop lerp on-curve, full natural play → street RUNNING at (0,4,18) with beat FX off (wall back, portal hidden, opacities 0, `!_inCity`) and a CONTROLLABLE camera (W key moves z 18→≈6.7), heap flat. The M12.1 section was updated for the new track: 32 kfs / dur 15.2, 5 corridor draw calls, RUNNING wait 30 s.

**M12.3 seam:** skip/cancel already lands in `_toStreet` (START click during INTRO); `_resetFx` is the FX teardown; M12.3 adds the 0.5 s fade to the street camera + START visible-delay + never-blocks-play guarantees.


## Timeline

- time: 2026-09-19T12:31:37
  kind: decision
  summary: "Created this page: M12.2: intro beats 2–5 — corridor opens, wide reveal dolly, 1.5-orbit low orbit, title card, street drop"
  source: created via brain create-page
  affects: [m122-intro-beats-reveal-orbit-title-drop]

- time: 2026-09-19T12:33:15
  kind: decision
  summary: "M12.2: intro beats 2–5 — corridor opens (endWall+portal), white-flash scene switch to the city, wide reveal dolly, 1.5-orbit low orbit (r=104/h=64), DOM title card, smoothstep drop to the street spawn; beat FX pure-fn-of-t; 32-kf/15.2 s track"
  source: "M12.2 implementation + full smoke suite (M12.2 17/17 in 3 runs)"
  affects: [m122-intro-beats-reveal-orbit-title-drop]

- time: 2026-09-20T05:40:46
  kind: decision
  summary: "M14.3 tuning: CFG.intro.beat4 fadeIn/fadeOut 0.5/0.6 → 0.7/0.7 (gentler, 0.6 s hold); M12.2 smoke title-fade expectations updated to the tuned windows (12.05 → ≈0.64, 13.4 → ≈0.29, peak 12.3 still exactly 1)"
  source: "M14.3 polish pass (99ebced)"
  affects: [m122-intro-beats-reveal-orbit-title-drop]
