---
id: smoke-harness-dev-tooling
title: "smoke/ headless test harness (playwright-core + system Chrome) verifies milestones without a build system"
category: decision
status: active
tags: [testing, smoke, playwright, tooling]
created: "2026-09-15T00:48:03"
updated: "2026-09-19T16:56:29"
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

- time: 2026-09-16T03:19:20
  kind: decision
  summary: "M8.1 extends the harness: fixed-order check is now …FX→ATMOS→HUD; M2 gate hides/shows ATMOS.root around its draw-call read; new M8.1 section — ATMOS registration (dome BackSide fog-off, stars additive fog-off, aurora additive fog-off), camera-follow (dome/stars track exactly, aurora at configured altitude), +3 draw calls (min-over-6-frames per state, retry ≤3 — other systems add transient calls), star drawRange tier cap, aurora spin animation, heap flat on pure animation frames, and the first multi-pose on/off visual gate: 3 camera distances (street GROUND / orbit CINE / far CINE), each an ATMOS-hidden vs visible screenshot pair decoded in-page, sky region = top 55 % at x ≥ 25 % (HUD corner excluded), asserting mean luminance (dome), bright pixels (stars), greenish pixels (aurora) all rise; on-shots saved as shots/m81-sky-{street,orbit,far}.png"
  source: M8.1 implementation
  affects: [smoke-harness-dev-tooling, m81-night-sky]

- time: 2026-09-19T02:38:36
  kind: decision
  summary: "M11.1 extends the harness: new M11.1 section (9 checks, after M10.3) reloads the page for the pre-gesture check (AUDIO.ctx null before START), verifies the master graph via the app-side AUDIO.wired flag (captured from connect() return values) + node constructor names — the headless WebAudio build exposes no inputs/outputs/connections and no DynamicsCompressor global — then M-key mute/unmute by gain value and refresh/re-entry; window.SIM now also exposes AUDIO"
  source: M11.1 implementation
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-19T04:02:20
  kind: note
  summary: "WebAudio gotcha (M11.2): AudioParam.value returns the BASE value — connected-input (oscillator LFO) modulation is NOT reflected in .value reads (headless or not). Verify bed motion driven from update() against the exact deterministic formula (tolerances for ≤ ~0.1 s frame/IPC lag); connected-LFO graphs are unobservable via .value and the graph has no inputs/outputs introspection in this build."
  source: M11.2 verification
  affects: [smoke-harness-dev-tooling, m112-looping-beds]

- time: 2026-09-19T06:22:07
  kind: decision
  summary: "M11.3 extends the harness: new M11.3 section (8 checks after M11.2, page already RUNNING) — per-type fire counters (AUDIO.events) assert each emitter's real call site fires exactly once (FX.pulse / FX.arc / PARTS._spawnSteam / TRAFFIC._spawn), all-fire-while-muted choke-point check (counters move, muteGain 0), eventsWired flags (captured from connect() return values — headless build exposes no graph introspection), heap flat. Pattern: pools are saturated at cap ⇒ free a slot with the real trim path first (PARTS._sReleaseAt(0) / TRAFFIC._releaseAt(0)) before pool.acquire(); TRAFFIC._spawn early-returns (no dock) ⇒ retry loop; synthetic src {x,z,hTop,r} is valid for _spawnSteam"
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-19T15:17:58
  kind: decision
  summary: "M13.1 extends the harness: fixed-order check is now …AUDIO→HUD→EVENTS; new M13.1 section (9 checks after M12.3, page already RUNNING, no reload) — synthetic evA/evB/evC registry, page-loop clock-advance check, then paused=true + reset + forced seed WORLD.mulberry(0x1337) + test pacing (CFG.events.gap=[2,4], first=0) + 1200×step(0.1): no overlaps / gap ∈ [2,4]+step / same-id cooldown / weighted A>B / gated-C-never; priority: gate flip preempts the running event (victim interrupted, c.start===victim.end exactly, fires once, gap resumes); determinism: same seed+steps ⇒ identical log; cleanup unregisters + restores CFG/clock/rng. Gotcha: the scheduler log holds ENDED events only — a just-preempted event is _active, not yet in the log"
  source: M13.1 implementation
  affects: [smoke-harness-dev-tooling]

- time: 2026-09-19T16:56:29
  kind: decision
  summary: "M13.2 extends the harness: boot-park block now also parks EVENTS (paused=true, no ambient events during the earlier sections); M13.1 section now unregisters the ambient events before its synthetic registry (isolation) and re-registers them in cleanup; new M13.2 section (11 checks after M13.1, page already RUNNING, no reload) — registration (both ids, dot idle-hidden in WORLD.root), manual trigger (data-pulse preempts the running power-cycle; both log entries exact), data-pulse (dot travels A-top→B-top along the Bezier — sampled at steps 5/20, final position exactly B's top because step() increments a.t before update and the final frame uses u=1; FX.pulse at departure+arrival, FX.count sampled per step), power cycle (per-chunk cloned-material multiplier dips < 0.5 then restores byte-exact to the captured base colors, E._pc IS the chunk), scheduled determinism (forced seed WORLD.mulberry(0x1322), 1200×step(0.1), identical firing order across two runs — no overlaps / min gap >= 2 (the gap is a MINIMUM: cooldown waits are legal, no upper bound) / same-id cooldown >= 12), no leftover state (all chunks at base, dot hidden, FX drained, nothing active). Gotchas: chunk EDGE distance for power-cycle reach (street spawn sits on a chunk corner; nearest chunk center is ~259 m ⇒ center-distance reach finds zero candidates); the scheduler log holds ENDED events only; a preempted data-pulse is dropped where it was (no arrival flash)"
  affects: [smoke-harness-dev-tooling, m132-ambient-events-a]
