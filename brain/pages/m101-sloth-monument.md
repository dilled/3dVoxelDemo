---
id: m101-sloth-monument
title: "M10.1: unsloth monument — voxel neon sloth + UNSLOTH sign on one side-avenue compute tower (standalone, deterministic pick)"
category: decision
status: active
tags: [m10, unsloth, easter-egg, world]
created: "2026-09-18T19:39:25"
updated: "2026-09-18T19:40:29"
---

<!-- compiled_truth -->
M10.1 adds the unsloth monument as a **standalone** child of `WORLD.root`
(outside the chunk pools ⇒ chunk regen / LOD / `_waveRestore` / the
M9.4/9.5 sign+LED wave never touch it).

- **Deterministic pick** (`WORLD._pickMonument`, seeded city ⇒ same pick
  every run/refresh): scan bz 3..12, bx −8..8 — plaza south side (bz > 0 ⇒
  behind the spawn camera ⇒ outside the default intro-reveal framing),
  avenue-adjacent only (m5(bx)∈{1,4} or m5(bz)∈{1,4} ⇒ on a side avenue),
  mid-distance 100–300 m, first `buildingAt(bx,bz,0,['server'],minH)` hit
  with `CFG.kit.slothMonument.minH = 30`. Current seed 0x51A7C3 ⇒ block
  (−4, +3), world (−84, +84), h ≈ 32.1 m, crown top hTop ≈ 37.9 m,
  nearest avenue x = −108.
- **Build** (`WORLD._buildMonument`, from `WORLD.init`): one Group at
  (wx, info.hTop, wz) with 3 meshes = **+3 draw calls**, zero per-frame
  allocation:
  1. dark merged mesh (pedestal + body + head + 2 arms + 2 legs + tail +
     2 eyes + nose) on `MATS.metalDark`,
  2. neon merged mesh (face plate + chest stripe + pedestal trim) on a
     `MeshBasicMaterial` `CFG.kit.slothMonument.neon` 0xff6fb2,
  3. billboard sign plane — shared `WORLD._detailAssets.signGeo`
     (PlaneGeometry(1,1)) scaled 8×3 m at local (0, 7.2, 0), material
     `MATS.signMat.unsloth` (map = `KIT.tex.signUnsloth`) ⇒ the
     "UNSLOTH" text + tagline cycle ("LOCAL ≠ SLOW" / "WHY RUSH?", 8 s,
     `KIT._tagline`) + 8 Hz flicker redraw animate for free.
  Facing baked into the merged geometries (`rotateY(atan2(−wx,−wz))` ⇒
  face the plaza); the group itself is unrotated so the sign billboard
  stays a plain local quaternion.
- **Per-frame** (`WORLD._updateMonument`, end of both `WORLD.update`
  paths — the old early-return was restructured to if/else): billboard
  the sign horizontally (setFromUnitVectors from pre-allocated
  `WORLD._monD`, M4 pattern) + slow neon pulse
  `neonBase × (0.8 + 0.2 sin(1.3 t))`.
- Deliberate delta: subtle by design (M10 header — "subtle, integrated");
  scale is consistent with the M4 city holo-signs (6–10 m). The
  awakening reaction (sign flare / holo sloth / drones) is M10.3 and
  hooks through the existing `ENTITY.eggReact` seam — nothing consumes
  it yet.
- **Verification** (smoke M10.1, 8 checks): registration (side avenue,
  south, mid-distance, server arch, on roof, sign bound to the shared
  unsloth texture); outside the spawn-pose framing via `SIM.project`
  NDC; tagline flips within 20 s + texture frame advances; street pose
  (nearest avenue, street level) — monument+sign inside NDC and
  sign-region mean luminance on/off (8.2 → 9.6) with screenshots
  `smoke/shots/m101-sloth-street.png` / `m101-sloth-off.png`; draw-call
  delta exactly 3; chunk regen leaves `sign.matrixWorld` byte-identical;
  heap flat.


## Timeline

- time: 2026-09-18T19:39:25
  kind: decision
  summary: "Created this page: M10.1: unsloth monument — voxel neon sloth + UNSLOTH sign on one side-avenue compute tower (standalone, deterministic pick)"
  source: M10.1 implementation
  affects: [m101-sloth-monument]

- time: 2026-09-18T19:40:29
  kind: decision
  summary: Rewrote compiled_truth to the new best understanding
  source: brain update-truth
  affects: [m101-sloth-monument]
