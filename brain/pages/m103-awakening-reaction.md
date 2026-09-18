---
id: m103-awakening-reaction
title: "M10.3: the unsloth awakening reaction — sign flares, holo brightens + one slow stretch, sloth drones rise to hover for the pulse, then return to idle"
category: decision
status: active
tags: [m10, unsloth, easter-egg, world, entity]
created: "2026-09-18T23:39:07"
updated: "2026-09-18T23:39:07"
---

<!-- compiled_truth -->
M10.3 implements the Unsloth easter-egg **awakening reaction** on the M10.1/M10.2
monument, hooked through the existing `ENTITY.eggReact` seam (M9.5): beat 6
fires `'start'` at AWAKE + `egg.delay` (4.2 s), the DORMANT entry fires
`'end'`.

- **Wiring** — `WORLD.wireEgg()` (NEW) is called from boot AFTER
  `for (const s of systems) if (s.init) s.init();` (WORLD boots BEFORE ENTITY,
  so not in `WORLD.init`; `ENTITY._eggReact = []` is created in
  `ENTITY.init`). It registers the reaction and reads `WORLD.monument.egg =
  { on, t0, endT, stretchT0 }` (state init in `_buildMonument`): `'start'` →
  `on=true, t0=t, stretchT0=t`; `'end'` → `on=false, endT=t`.
- **Level** — `_updateMonument(dt, t)` computes an eased level: `on` →
  `min(1,(t−t0)/ramp)`; else `endT>0` → `max(0,1−(t−endT)/settle)`; then
  smoothstep. Ramps in on `'start'`, holds through AWAKE/DECAY, eases back on
  `'end'` — so the drones are still hovering for the final pulse.
- **CFG.kit.slothEgg** = `{ ramp 1.2, settle 2.0, stretchDur 2.2,
  stretchAmp 0.22, holoBoost 1.25, signBoost 1.6, hoverAlt 15, hoverOff 3.5 }`
  (modest amplitudes by design — the reaction never competes with the
  creature; the monument is outside the default intro-reveal framing, M10.1).
- **Visuals** (all in `_updateMonument`, driven by the level):
  - sign/neon flare: neon `k = (0.8+0.2·sin(1.3t))·(1+signBoost·lvl)`
    (extends the M10.1 pulse); sign material `setScalar(1+signBoost·0.75·lvl)`
    — `MATS.signMat.unsloth` is monument-only (city/core are clones), so the
    boost never leaks to city signs.
  - holo brightens: `holoMat.color.setScalar(1+holoBoost·lvl)` (additive
    blending ⇒ color > 1 = brighter).
  - one slow stretch — one-shot from `stretchT0` over `stretchDur`:
    `s=sin(π·u)` → `scale.y ×(1+stretchAmp·s)`, `scale.x ×(1+0.5·stretchAmp·s)`,
    multiplied into the existing breathing scale (M10.2).
  - sloth drones rise to hover nearby: patrol `along` advances ×`(1−lvl)`
    (frozen while hovering ⇒ seamless resume); position lerps
    patrol→hover by `lvl`, yaw slerps patrol→`hoverYaw`
    (`θ=atan2(−wx,−wz)`, face the plaza). Per-drone hover point
    (precomputed in `_buildMonument`): `(wx + sgn·hoverOff, hTop+hoverAlt,
    wz)` — staggered ±3.5 m across the street, 15 m above `hTop` (above the
    holo); `sgn = i%2 ? 1 : −1`. New scratch `WORLD._slothQ2`.
- **Cost:** +0 draw calls, +0 visible objects, zero per-frame allocation.
- **Verification** (smoke M10.3, 6 checks, after M10.2): registered + idle at
  DORMANT (`M.egg` present, `ENTITY._eggReact.length ≥ 1`, holo/sign at base,
  drones on the street); full awakening run during AWAKE — sign flares, holo
  brightens (`color.r > 1+1.25·0.99`), stretch, drones rise to hover
  (`y > 35`, < 8 m from the tower, > 10 m off the street line), calls ≤
  baseline+2, screenshot `smoke/shots/m103-sloth-awaken.png`; holds through
  DECAY (drones still up for the pulse); after DORMANT — everything back at
  base, patrol resumes (`along` moves), visible set identical (ATMOS-shafts
  excluded — they fade on a 2 s camera scan and the street-pose change can
  catch them mid-fade: environment, not the reaction); re-trigger plays again
  and returns to idle; heap flat. The only recurring failure is the
  documented pre-existing M7.5 headless flake; occasional screenshot/timing
  flakes (M7.3 bolt tick window, M8.1 star brightness, M9.4 wave brightness)
  are unrelated to M10.3.
- **Smoke harness note:** the M9.5 cleanup drops its fake reaction by
  **splicing only it** out of `ENTITY._eggReact` — clearing the whole array
  (`length = 0`) would also wipe the real M10.3 reaction registered at boot
  (that bug made the M10.3 reaction silently never fire mid-suite).


## Timeline

- time: 2026-09-18T23:39:07
  kind: decision
  summary: "Created this page: M10.3: the unsloth awakening reaction — sign flares, holo brightens + one slow stretch, sloth drones rise to hover for the pulse, then return to idle"
  source: created via brain create-page
  affects: [m103-awakening-reaction]

- time: 2026-09-18T23:39:07
  kind: decision
  summary: "M10.3 implemented: awakening reaction wired through ENTITY.eggReact (WORLD.wireEgg at boot), eased level drives sign flare / holo brighten + one slow stretch / drone rise-to-hover, returns to idle after DECAY; +0 draw calls, verified in smoke"
  source: brain update-truth
  affects: [m103-awakening-reaction]
