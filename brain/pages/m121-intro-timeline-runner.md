---
id: m121-intro-timeline-runner
title: "M12.1: intro cinematic engine — camera-keyframe timeline runner + beat 1 dark server corridor"
category: decision
status: active
tags: [intro, cinematic, timeline, camera, corridor]
created: "2026-09-19T10:21:43"
updated: "2026-09-19T10:44:56"
---

<!-- compiled_truth -->
The `INTRO` system (single `index.html`, exposed on `window.SIM`, registered after CAMERA / before KIT) is the M12 intro cinematic engine: a camera-keyframe timeline runner + beat 1, the dark server corridor.

**Runner (no async resources anywhere):** `INTRO.play(track, onDone)` / `INTRO.cancel()` / `INTRO.seek(t)`, driven from the central update loop. A track is keyframes `[{ t, pos: [x,y,z], look: [x,y,z] }]`, smoothstep-eased between consecutive pairs. While playing, INTRO owns the camera pose — `_applyPose` writes `camera.position` + `camera.lookAt` AFTER `CAMERA.update`, so it wins the frame; on cancel the camera returns to `CAMERA.pos` on the next frame (INTRO simply stops overwriting); at the track end `onDone(t)` fires exactly once. `seek` works playing or cancelled (clamps to [0, dur]).

**Boot:** `BOOT` state machine is LOADER → INTRO → RUNNING (→ ERROR). The intro auto-plays at module init (`if (BOOT.state === 'LOADER') BOOT.enter('INTRO')`); the rAF loop starts at the first state that renders via a `_startLoop` guard (`BOOT.looping`) because both INTRO and RUNNING entry call it. `BOOT.enter('INTRO')` adds the `intro` class to the overlay, starts the loop, and calls `INTRO.play(INTRO._beat1(), INTRO._toStreet)`. The START button during INTRO is the skip affordance (`INTRO._toStreet()`); during LOADER it enters RUNNING directly. The RUNNING branch is unchanged (`t0` anchor, `AUDIO.unlock()`, hud).

**Beat 1 corridor** (`INTRO.scene`, rendered INSTEAD of the city in `frame()` via `renderer.render(BOOT.state === 'INTRO' ? INTRO.scene : scene, camera)`): near-black bg 0x010208, FogExp2 0.022, one dim AmbientLight (0x33445c, 0.9) so the Lambert shell/racks read. Tunnel axis -Z, len 120 / width 10 / height 6, four draw calls total: merged 6-box shell (MATS.server), 48 server racks (`KIT.InstancedBox(48, [1.8,3,1.2], MATS.metalDark)`, deterministic per-instance tint salt `(i*37 + s*11) % 10`), 4 merged LED strip lines (local `MeshBasicMaterial 0x3fd4ff toneMapped:false`), 96 flowing dashes (`InstancedBox` additive `toneMapped:false` white, 26 m/s along -Z, wrap span len+8; pre-allocated `_dashZ`/`_dashLine`/`_m4` ⇒ zero per-frame allocation). The end walls close the tunnel — M12.2's "corridor opens" beat removes/opens the far one. Beat 1 track: 3 keyframes, dur `CFG.intro.beat1.dur` = 4.4 s, z +54 → 0 → -54 at eyeY 2.5, look 20 m ahead (constant offset) so the tunnel rushes by.

**Handoff:** `INTRO._toStreet()` (natural track end OR skip) sets the M0 street spawn pose — `CFG.intro.street` pos [0,4,18] look [0,2,0], fov 60, vel 0, `CAMERA.mode='GROUND'`, blend 0, orbit null, shake 0, and re-syncs `CAMERA.pos/yaw/pitch` from the camera — then `BOOT.enter('RUNNING')`; the `t0` anchor is set as before ⇒ the M9.6 auto-awaken seam is intact.

**Audio:** the intro is silent and no gesture happens during INTRO ⇒ `AUDIO.unlock()` never runs before RUNNING (M11.1's pre-gesture invariants hold; INPUT keydown is already guarded `BOOT.state !== 'RUNNING'`).

**CFG.intro** = `{ corridor: { len 120, width 10, height 6, bg 0x010208, fogDensity 0.022, rackGap 5, dashLines 4, dashesPerLine 24, dashSpeed 26, dashSize [0.25,0.15,1.4], eyeY 2.5 }, beat1: { dur 4.4 }, street: { pos [0,4,18], look [0,2,0] } }`.

**Smoke:** M12.1 section in `smoke/smoke.mjs` — fresh load auto-plays (INTRO, track 3, dur 4.4), scene composition (shell + 48 racks + strips + 96 dashes), dolly advances (t/z advance, eye height, fwd -Z), dashes flow (instance-matrix hash changes), corridor renders in exactly 4 draw calls, screenshot `shots/m121-corridor.png` (mean luminance < 40 with bright LED pixels), heap flat while the beat plays, natural end → street RUNNING at spawn, then runner start / seek mid-play / seek clamp at end / cancel mid-way / re-seek after cancel / play-to-end onDone-once — all poses verified in-page against the smoothstep formula (same frame ⇒ exact).

**M12.2 seam:** the far end wall is the "corridor opens" element; `INTRO.play`/`_beat1` generalize to multi-beat tracks.


## Timeline

- time: 2026-09-19T10:21:43
  kind: decision
  summary: "Created this page: M12.1: intro cinematic engine — camera-keyframe timeline runner + beat 1 dark server corridor"
  source: created via brain create-page
  affects: [m121-intro-timeline-runner]

- time: 2026-09-19T10:44:56
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: "M12.1 implementation + full smoke suite"
  affects: [m121-intro-timeline-runner]
