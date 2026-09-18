---
id: m102-holo-sloth-drones
title: "M10.2: relaxed holo-sloth hologram on the monument antenna + soft-pink sloth drones patrolling the monument street only"
category: decision
status: active
tags: [m10, unsloth, easter-egg, world, traffic]
created: "2026-09-18T20:54:29"
updated: "2026-09-18T20:55:37"
---

<!-- compiled_truth -->
M10.2 adds the two remaining "unsloth" pieces to the M10.1 monument, both as
**standalone children of `WORLD.root`** (world space, outside the chunk pools
⇒ chunk regen / LOD / wave-restore never touch them — and deliberately NOT
children of the monument group `g`, so `g.children` stays 3 and the M10.1
smoke is untouched).

- **Relaxed holo-sloth hologram** (`WORLD.monument.holo`, a `THREE.Sprite`):
  a billboard canvas sprite on `KIT.tex.slothHolo` (`makeSlothHolo`, a STATIC
  soft-pink silhouette of a sloth hanging on an antenna arm — mast +
  crossbar + limbs + drooping body + resting head + hanging legs). Additive
  blending, `depthWrite:false`, at `(wx, hTop+13, wz)` (above the M10.1
  sign at `hTop+7.2`). The **slow breathing is a per-frame sprite scale**
  (`1 + breathAmp·sin(t·breath)`) in `WORLD._updateMonument`, NOT a canvas
  redraw — the canvas is drawn once. `CFG.kit.slothHolo = { color 0xffb3d9,
  scale 3.4, breath 1.0 rad/s, breathAmp 0.05 }`.

- **Sloth-themed maintenance drones** (`WORLD.monument.droneMesh`, one
  `InstancedMesh` reusing the M6.2 voxel-quad drone geometry, `count` up to
  `CFG.kit.slothDrone.count` = 2): bigger (`size 3.0` vs city 2.0), soft
  pink tint (`0xff9ecb`), extra slow (`speed 2.2` vs city 7–13 m/s),
  patrolling **the monument's street only** — one avenue line, not the
  general roof-dock fleet. Per-drone state `WORLD.monument.drones[] =
  { axis, c, along, dir, speed, phase, aMin, aMax, tint }`: `c` is the fixed
  cross-street coordinate (the avenue), `along` varies within
  `[streetAlong ± span]` (span 70 m) and **bounces** at the ends
  (back-and-forth patrol, not a one-way pass). World pos: axis `'z'` →
  `(c, altitude+bob, along)`; axis `'x'` → `(along, altitude+bob, c)`.
  `altitude 30 m`, slow hover bob.

- **Street line** (same priority as the M10.1 street pose / smoke):
  `m5(bz)∈{1,4}` → street runs along x at `z=streetC`; else `m5(bx)∈{1,4}` →
  runs along z at `x=streetC`. Current seed 0x51A7C3 ⇒ block (−4,+3):
  `m5(bz)=3` → bx case ⇒ `axis='z'`, `streetC=x=−108`, `streetAlong=P.z=84`
  ⇒ drones patrol z∈[14,154] at x=−108.

- **Cost:** +2 draw calls (holo sprite + drone instanced mesh), zero
  per-frame allocation (pre-allocated scratch `WORLD._slothM/_slothP/
  _slothQ/_slothS/_slothY`). `WORLD._updateMonument` now takes `(dt, t)`
  (was `(t)`) to drive the drone patrol.

- **M10.3 seam** (NOT implemented in M10.2 — exposed only):
  `WORLD.monument.{ holo, holoMat, droneMesh, drones, streetAxis, streetC }`
  — M10.3 brightens/stretches the holo (scale/`holoMat.color`) and rises the
  drones to hover, then resumes; hooks through the existing `ENTITY.eggReact`
  seam.

- **Verification** (smoke M10.2, 8 checks): registration (holo is an additive
  Sprite bound to `KIT.tex.slothHolo.tex`; 2 drones soft-pink/bigger/slow on
  the street); holo breathes (sprite scale oscillates); patrol ONLY the
  street (fixed avenue `c`, bounded + moving `along`, instance-matrix
  cross-street coord on the avenue line); patrol bounces at the span end
  (dir flips, stays ≤ aMax); street screenshot `smoke/shots/
  m102-sloth-holo-street.png` (holo sloth on the antenna + drone on the
  street); draw-call delta exactly 2; chunk regen leaves holo position +
  drone count/c/axis untouched; heap flat. The only failure is the
  documented pre-existing M7.5 headless flake (camera-shake
  `energy=1.18` baseline — untouched by M10.2).


## Timeline

- time: 2026-09-18T20:54:29
  kind: decision
  summary: "Created this page: M10.2: relaxed holo-sloth hologram on the monument antenna + soft-pink sloth drones patrolling the monument street only"
  source: created via brain create-page
  affects: [m102-holo-sloth-drones]

- time: 2026-09-18T20:55:37
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: M10.2 implementation
  affects: [m102-holo-sloth-drones]
