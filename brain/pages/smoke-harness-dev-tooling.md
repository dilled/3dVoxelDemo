---
id: smoke-harness-dev-tooling
title: "smoke/ headless test harness (playwright-core + system Chrome) verifies milestones without a build system"
category: decision
status: active
tags: [testing, smoke, playwright, tooling]
created: "2026-09-15T00:48:03"
updated: "2026-09-15T01:18:39"
---

<!-- compiled_truth -->
The smoke harness lives in `smoke/` (dev tooling only, not part of the product): `node smoke/smoke.mjs [url]` serves the project root on :8377 and drives `index.html` in headless Chrome via `playwright-core` (pinned in `smoke/node_modules`, system Chrome at /usr/bin/google-chrome). It asserts the M0 boot contract (LOADER → START → RUNNING, live loop, double-init guard, resize, refresh/re-entry) and the M1 core loop (fixed system order INPUT→CAMERA→HUD, clean-without-gamepad, fake-gamepad movement, keyboard W/Space, wheel FOV zoom, V GROUND/CINE toggle with blend, middle-mouse orbit, shake impulse/decay, zero page errors).

Testing seams: `window.SIM` dev handle exposes BOOT/INPUT/CAMERA/HUD/CFG/renderer/scene/camera/systems; gamepads are faked by stubbing `navigator.getGamepads()` in-page with a standard-mapping pad object.

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
