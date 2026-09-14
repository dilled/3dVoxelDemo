---
id: three-cdn-pin-boot-watchdog
title: "Three.js pinned to 0.160.0 via jsDelivr importmap + 15 s boot watchdog"
category: decision
status: active
tags: [three, cdn, boot, robustness]
created: "2026-09-15T00:47:41"
updated: "2026-09-15T01:18:39"
---

<!-- compiled_truth -->
Three.js is pinned to `three@0.160.0` via a `<script type="importmap">` pointing at jsDelivr (`cdn.jsdelivr.net`) — the only permitted external resource; no build system, everything else lives in the single `index.html`.

Boot robustness contract: an inline classic script arms a 15 s watchdog (`window.__SIM_BOOT_DEADLINE__`) before the module loads; unless `window.__SIM_BOOTED__` is set, a visible BOOT STALL banner appears instead of a stuck page; module success clears the timer. The START button is the single user-gesture gate (audio unlock + no-double-init guard). A subsystem that throws in `update()` is disabled and reported via the BOOT failure banner rather than silently killing the rAF loop.


## Timeline

- time: 2026-09-15T00:47:41
  kind: decision
  summary: "Created this page: Three.js pinned to 0.160.0 via jsDelivr importmap + 15 s boot watchdog"
  source: M0 implementation
  affects: [three-cdn-pin-boot-watchdog]

- time: 2026-09-15T01:18:39
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [three-cdn-pin-boot-watchdog]
