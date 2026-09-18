---
id: m72-fx-pulse
title: "M7.2 FX.pulse: expanding instanced ring + pooled light-intensity ramp (Key R, tier-capped, idle 0 draw calls)"
category: decision
status: active
tags: [m7, fx, pulse, pool, tier]
created: "2026-09-15T21:30:21"
updated: "2026-09-18T07:45:05"
---

<!-- compiled_truth -->
<!-- compiled_truth -->
## Decided

- `FX` is the new FX system (M7.2; later arcs M7.3, flash M7.4, shake M7.5). Registered in the systems registry between PARTS and HUD; exposed as `window.SIM.FX`. public API: `FX.pulse(origin, radius, color, life?)` (M9.4 added the optional `life` override in s; seams: M9.4 plaza pulse, M13.2 data pulse, dev trigger) and `FX.dropPulse(it)` (M9.4: swap-remove + pool release of one live pulse even mid-life, no-op for foreign/released items).
- A pulse = expanding ground ring on ONE shared `InstancedMesh` (`RingGeometry(0.92, 1.0, 48)` rotated to ground plane, XZ instance scale = ring radius; shared additive `MATS.pulseGlow` ⇒ per-instance color = tint × sin-fade IS the light) + a light-intensity ramp: one pooled `PointLight` per live pulse (slot i ⇔ `_live[i]` every frame, `intensity = CFG.fx.pulse.light.intensity × sin²(u·π)`, hidden at 0).
- State lives in the M6.1 pool `fx-pulse` (fixed capacity = HIGH tier cap 6 ⇒ zero `new` after init); tier caps `CFG.fx.pulse.tiers` {high:6, med:4, low:2} enforced by the same farthest-release trim the M6/M7 fleets use. Defaults: radius 40 m, life 1.6 s, tint 0x66e0ff; `radius ≤ 0`/null falls back to defaults; color accepts `THREE.Color` or hex.
- Zero-allocation by construction: scratch `Matrix4/Vector3/Color`/`Quaternion` on `FX` are reused; 0 live ⇒ `ring.count = 0` (three r160 skips count-0 InstancedMesh ⇒ 0 draw calls added) + all lights hidden/intensity 0 ⇒ idle cost is exactly zero added draw calls.
- Dev trigger: Key `R` (INPUT edge `pulseTrigger`, consumed in `FX.update`) fires a pulse 32 m ahead of the player on the ground (yaw-based, camera-relative). HUD hint line now reads `P particles · R pulse`.
- Audio thump: deliberately NOT wired yet — the seam is the `pulse()` call site, wired in M11.3.
- Consequence: the M2 smoke gate hides `FX.ring` alongside the TRAFFIC + PARTS meshes (the +1 ring draw call would otherwise break the < 10 KIT-only gate).
- Smoke M7.2 section: FX registered in fixed order (…PARTS, FX, HUD), pool capacity = HIGH cap, idle 0 live / ring count 0 / lights hidden / 0 inUse; idle parity — calls identical with the ring hidden vs shown at 0 live; Key R ⇒ exactly +1 draw call (the ring) with the pooled light on; zero-`new` pool identity (`inUse === count`); ring visibly expands tracking the eased-out radius; light intensity tracks the sin² peak; pulse resolves clean (0 live, ring count 0, lights hidden + intensity 0, pool drained); `FX.pulse` honours radius + color (sRGB → working space via the r160 EOTF, defaults honoured); LOW trims 6 fired pulses to the LOW cap (2) with excess released, HIGH restores 6; heap flat across the sequence; draw calls < 150; screenshot `smoke/shots/m72-pulse-ring.png` (ring + light peak in frame).


## Timeline


## Timeline

- time: 2026-09-15T21:30:21
  kind: decision
  summary: "Created this page: M7.2 FX.pulse: expanding instanced ring + pooled light-intensity ramp (Key R, tier-capped, idle 0 draw calls)"
  source: M7.2 implementation
  affects: [m72-fx-pulse]

- time: 2026-09-15T21:30:51
  kind: decision
  summary: "Created this page: M7.2 FX.pulse — expanding instanced ring + pooled light-intensity ramp"
  source: M7.2 implementation
  affects: [m72-fx-pulse]

- time: 2026-09-18T07:44:37
  kind: decision
  summary: "M9.4: FX.pulse gains an optional 4th arg `life` (s; default CFG.fx.pulse.life) and a new public API FX.dropPulse(it) — swap-remove + pool release of one live pulse even mid-life (no-op for foreign/released items). Used by the M9.4 cascade teardown at DORMANT entry to drop the plaza pulse ring."
  source: M9.4 implementation
  affects: [m72-fx-pulse, m94-city-cascade]

- time: 2026-09-18T07:45:05
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M9.4 implementation
  affects: [m72-fx-pulse]
