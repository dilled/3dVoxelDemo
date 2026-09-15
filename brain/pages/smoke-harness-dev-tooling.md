---
id: smoke-harness-dev-tooling
title: "smoke/ headless test harness (playwright-core + system Chrome) verifies milestones without a build system"
category: decision
status: active
tags: [testing, smoke, playwright, tooling]
created: "2026-09-15T00:48:03"
updated: "2026-09-15T09:30:36"
---

<!-- compiled_truth -->
The smoke harness lives in `smoke/` (dev tooling only, not part of the product): `node smoke/smoke.mjs [url]` serves the project root on :8377 and drives `index.html` in headless Chrome via `playwright-core` (pinned in `smoke/node_modules`, system Chrome at /usr/bin/google-chrome). It asserts the M0 boot contract (LOADER → START → RUNNING, live loop, double-init guard, resize, refresh/re-entry), the M1 core loop (fixed system order INPUT→CAMERA→KIT→HUD, clean-without-gamepad, fake-gamepad movement, keyboard W/Space, wheel FOV zoom, V GROUND/CINE toggle with blend, middle-mouse orbit, shake impulse/decay), and the M2 gate (KIT registration: MATS/builders/textures/lighting rig; full test scene < 10 draw calls read from `renderer.info.render.calls`; LED `frame` counter advancing; two screenshots 0.4 s apart differing), always ending with zero page errors.

Testing seams: `window.SIM` dev handle exposes BOOT/INPUT/CAMERA/KIT/HUD/CFG/renderer/scene/camera/systems; gamepads are faked by stubbing `navigator.getGamepads()` in-page with a standard-mapping pad object.

Known gotchas (Chrome CDP / Playwright): `Input.dispatchMouseEvent`'s `buttons` enum has no `middle` — omit `buttons` and pass only `button:'middle'`; DOM `button` value for middle is 1 (0=left, 2=right). Playwright's `mouse.down({button:'middle'})` does emit the real middle button, but for middle-button *drags* the harness uses a CDP session (`page.context().newCDPSession`).


## Timeline

- time: 2026-09-15T00:48:03
  kind: decision
  summary: "Created this page: smoke/ headless test harness (playwright-core + system Chrome) verifies milestones without a build system"
  source: M0 implementation
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-15T01:18:39
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-15T01:41:57
  kind: decision
  summary: "M2 extends the harness: fixed-order check is now INPUT→CAMERA→KIT→HUD; new M2 checks assert KIT registration (MATS>=5, builders, LED/QWEN/UNSLOTH/glow textures, hemi+moon+2 hero lights), gate scene < 10 draw calls via renderer.info.render.calls, LED frame counter advancing, and two screenshots 0.4 s apart differing (animated render)."
  source: M2 implementation
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-15T01:42:17
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-15T02:32:16
  kind: decision
  summary: "M3 extends the harness: WORLD checks — mulberry32 known-vector + distinct per-block seeds, 5×5 keep-set (25 chunks, ring 1/8/16, ≥1900 m, >2500 instances), byte-identical chunk regeneration (WORLD.regen + instanceMatrix compare), flat draw calls after flying to (0,4,1600) (far ≤ near+8, <150), and unbuild-behind/ahead on chunk change; M2 gate now hides WORLD.root around the <10 draw-call read"
  source: M3 implementation
  affects: [smoke-harness-dev-tooling, world-chunk-generation]

- time: 2026-09-15T09:30:36
  kind: decision
  summary: "M6.1 extends the harness: POOL section — 64-item test pool (factory called 64×), 10k-cycle burst acquire/release in one synchronous evaluate with perf.memory bracket (heap delta must stay ≤ 64KB), zero-new-identity check via pre-captured Set, exhaustion→null drain, double/foreign release no-op check, POOL.list + POOL.stats() aggregate sanity; window.SIM now also exposes POOL"
  source: M6.1 implementation
  affects: [smoke-harness-dev-tooling, m61-object-pool]
