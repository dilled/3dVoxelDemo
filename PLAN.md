# QWEN FLASH // AWAKENING — Build Plan

Single self-contained HTML file (Three.js from CDN, everything else procedural).
Goal: a playable, spectacular voxel datacenter-city demo whose climax is the
awakening of a colossal AI machine-creature, with an integrated "UNSLOTH" easter egg.

## Ground rules (apply to every milestone)

- One `index.html`, no build system, no external art/audio/model assets.
- Three.js via CDN `<script>` (or ESM importmap) — the only allowed external.
- Zero hand-authored meshes: everything from `BoxGeometry`/`CylinderGeometry`
  primitives, `InstancedMesh`, merged geometry, generated `CanvasTexture`
  sprites (glow sprites, holo signs).
- No references to functions/variables before init; all subsystems register
  into one `systems` registry that boots in a fixed order.
- Draw-call budget: < ~150 draw calls at 100 % quality. Prefer
  `InstancedMesh` + vertex/instance colors over unique materials.
- Everything animated is driven by a central `update(dt, t)` loop; every
  subsystem implements `{ init, update, onQuality, onAwaken, dispose? }`.

## Architecture (lives inside the one file)

- `BOOT` — deterministic boot sequence, state machine
  `LOADER → INTRO → PLAY → (PAUSED?)`; guards against double-start.
- `CFG` — quality tiers + all tunables in one place.
- `WORLD` — chunked city generator (seeded PRNG, per-chunk cache).
- `ENTITY` — the Qwen machine-creature (root + named rig parts).
- `ATMOS` — fog, sky, lightning, volumetric-ish light shafts.
- `TRAFFIC` — drones, sky vehicles, steam/spark emitters (pooled).
- `FX` — pulses, arcs, screen flash, camera shake.
- `INPUT` — keyboard/mouse/gamepad (gamepad optional, polled).
- `CAMERA` — cinematic fly + ground cam + free orbit; transitions.
- `AUDIO` — WebAudio synth (hum, fans, rumble, discharges).
- `HUD` — stats overlay + intro/title UI (DOM, no canvas text 3D needed).
- `EVENTS` — the emergent-event director (scheduler + awakening sequence).

---

## Milestones

Rule from M6 onward: one sub-milestone (`M#.#`) = one actual, clear functional
change + its testing + one commit. No sub-milestone shipped without its
smoke-test evidence.

| Phase | Scope | Gate |
|---|---|---|
| **M0** ✅ | Single-file scaffold: full-screen canvas, Three.js via CDN, scene/renderer/camera, `BOOT` state machine with START button + audio gate, FPS counter | START always leads to a live 60 fps loop; page refresh never leaves a stuck state |
| **M1** ✅ | Core loop: fixed-order `systems` registry + `update(dt)`, `INPUT` (WASD/ZQSD, pointer-lock mouse look, wheel zoom, middle-mouse orbit, gamepad), `CAMERA` ground/cinematic modes with shake API | Fly around an empty dark void in both cameras; gamepad works; nothing throws without one |
| **M2** ✅ | Procedural voxel material kit: shared materials, canvas-texture helpers (LED grid, holo signs, glow sprites), instanced box/cylinder + merged-geometry builders, lighting rig | Kit renders a test wall/tower with animated LED faces and signs at < 10 draw calls |
| **M3** ✅ | Chunked city generation (far layer): seeded PRNG, city grid, 16×16 block chunks generated/unbuilt around player, weighted archetypes, 3-ring distance LOD | City extends beyond initial view, no visible duplication, draw calls flat as you fly out |
| **M4** ✅ | Building detail passes (near layer): 5 pooled detail InstancedMeshes per near chunk (fans, dishes, pulses, holo signs, LED facades), per-archetype detail on the M3 mass, per-building seeded salt, ring-2 silhouette stays zero-detail | Every archetype readable from 50–200 m and procedurally varied; draw calls flat (32 near) |
| **M5** ✅ | The Qwen machine-creature (dormant): plaza pedestal, full creature build from primitives, named rig parts, dormant breathing/idle state, instanced compute-node voxels | Reads as "dormant colossal machine" from street level; silhouette holds from 3 camera distances |
| **M6.1** ✅ | Generic object-pool foundation (`Pool` helper): fixed-size alloc at init, `acquire/release`, zero per-frame allocation, shared by later emitters | Pool test: 10k acquire/release cycles in smoke run, zero `new` after init, zero GC churn in stats |
| **M6.2** ✅ | Maintenance drones: small voxel quads (InstancedMesh), patrol routes between towers, dock at roof bays, capped by distance to player | Drones visibly patrol + dock from street level; cap holds at tier max; no allocation per frame |
| **M6.3** ✅ | Sky vehicles: light trails (additive sprite streak) on ring roads at 3 altitudes, capped like drones | Trails readable from all 3 altitudes; count never exceeds tier cap |
| **M6.4** | Steam vents (cooling towers, billboard sprite pool, upward drift, fade) + sparks (substations, tiny points, brief life) | Both emitters run idle-cheap; smoke shot shows steam + sparks at source buildings |
| **M6.5** | Adaptive caps: `TRAFFIC` reads current FPS tier, scales all M6 pools | Forcing LOW tier in smoke run visibly halves caps; back to HIGH restores; no spike |
| **M7.1** | Pooled `Points`/sprite particle system: steam, sparks, pulse motes, lightning motes, awakening rain — one system, one budget | One trigger key rains all particle types; idle cost ~0 in stats |
| **M7.2** | `FX.pulse(origin, radius, color)`: expanding instanced ring mesh + light-intensity ramp (+ audio hook once M11 lands) | Manual key fires a visible pulse; nothing allocated; idle = zero draw calls added |
| **M7.3** | Animated electrical arcs: Line segments regenerated every N frames between anchors (substation→substation, creature→ring) | Manual key sparks arcs between two substations and creature→ring; regen is frame-cheap |
| **M7.4** | Screen-space flash: overlay-scene additive plane (or DOM div) driven by `FX.flash(intensity)` | Manual key flashes screen; decays to zero; costs nothing idle |
| **M7.5** | Camera shake: impulse-decay system consumed by `CAMERA` | Manual key shakes camera with clean decay to still; never accumulates |
| **M8.1** | Night sky: gradient sky dome (big sphere, canvas/shader texture), stars, faint aurora band | Night mood readable from street level; dome correct from street, orbit, and far fly |
| **M8.2** | Fog depth tune + zone-tinted haze (cyan core / warm avenues) via fog color lerp | Depth readable at 500 m; zone tint visible flying across zones |
| **M8.3** | Volumetric-ish light shafts: a few additive cone/cylinder meshes from key spires + creature core (only when near / during awakening) | Shafts visible near spire, absent far away (no permanent draw calls) |
| **M8.4** | Distant lightning: random far point + brief hemi bump + flash + EM discharge ring across the city | Lightning event visible from inside the city; fires on timer + manual key |
| **M9.1** | Idle/dormant animation: tensor-ring rotation, antenna sway, breathing core, periodic "dream" LED wave across the node grid (instance-color waves) | Dream wave sweeps the node grid visibly; dormant state stays dim and still-ish |
| **M9.2** | Wake state machine: DORMANT → STIR (2 s head lift, jaw, rings speed up) → AWAKE (10–20 s) → DECAY → DORMANT, with per-state hooks | State machine smoke test: forced transitions in order, clean return to DORMANT, re-trigger safe |
| **M9.3** | Awakening beats 1–3: core-eye flare (emissive ramp + light + flash), node voxels ignite in radial waves, rings accelerate + limbs reposition (shake impulse) | Beats 1–3 play in sequence with correct timing on manual trigger |
| **M9.4** | Awakening beats 4–5: energy pulse ring from plaza + city holo-signs/LEDs following the wave (per-ring scheduled ramps), substation arcs fire, steam bursts, drones scatter/re-route, vehicles avoid | The "thousands of compute nodes illuminate" moment lands; wave visibly travels ring by ring |
| **M9.5** | Awakening beats 6–7 + decay: easter-egg reaction hook (M10), waves dim outward, hum settles, final pulse | Full sequence ends back in DORMANT with one final pulse; re-trigger immediately works |
| **M9.6** | Triggers: manual key (`F`) + HUD button, auto-play once ~30 s after intro | All three entry paths (key, button, auto) start the same sequence exactly once |
| **M10.1** | Voxel neon **sloth** monument atop one compute tower on a side avenue + rooftop "UNSLOTH" holo sign with cycling taglines ("local ≠ slow" / "why rush?") | Monument + sign readable from street; sign cycles; outside default intro framing |
| **M10.2** | Relaxed holographic sloth silhouette on the antenna arm (billboard + canvas sprite, additive, slow breathing) + 1–2 slow sloth-themed maintenance drones (bigger, soft pink) patrolling that street only | Holo sloth breathes; pink drones patrol only that street |
| **M10.3** | Awakening reaction: sign flares, holograph brightens + one slow stretch, sloth drones rise to hover for the pulse, then resume | Reaction plays during AWAKE, everything returns to idle after DECAY |
| **M11.1** | Audio master graph: compressor → user-mute gain → destination; gesture-gated start (START button), resume-safe | Audio starts only after gesture; mute key mutes all; refresh/re-entry safe |
| **M11.2** | Looping beds: reactor hum (detuned sines + sub + LFO), fans (filtered noise, band-pass sweep), distant machinery (noise + random low thumps) | Beds run indefinitely without audible repeats/bugs; identifiable as "machine city" within 3 s |
| **M11.3** | Event sounds: pulse thump, arc crackle, steam hiss, drone whir — wired to M6–M9 emitters | Each event in-game produces its sound; all silent when muted; zero cost when idle |
| **M11.4** | Spatial-ish mixing: one panner + distance gain for 2–3 nearest emitters, rest folded into ambient bed | Walking past an emitter pans/attenuates; cost bounded |
| **M12.1** | Intro engine: camera-keyframe timeline runner (no async resources) + beat 1 dark server corridor (procedural instanced LED-strip tunnel + dolly) | Corridor beat plays; timeline runner test: start/cancel/seek all clean |
| **M12.2** | Intro beats 2–5: corridor opens → wide reveal dolly over city → 1.5-orbit low orbit of dormant creature → `QWEN FLASH // AWAKENING` title card (DOM, fades) → lerp to street-level player position | Full ~12–15 s intro ends in controllable street-level camera |
| **M12.3** | Intro robustness: skippable/cancellable at any point (START/click/keypress) → 0.5 s fade to street camera; START visible after 2 s; intro never blocks play state | Finish / early-skip / late-interrupt all end in controllable camera, zero console errors |
| **M13.1** | `EVENTS` scheduler: weighted picking, cooldowns, min/max gap, event registry, one-at-a-time + priority rules | Scheduler smoke test: forced random seed yields legal firing order (no overlap, gaps respected) |
| **M13.2** | Ambient events A: data pulse (dot along conduit, both ends flash — M7 cable) + section power cycle (one ring chunk dims/brightens 3–6 s, per-chunk color multiplier) | Both events fire and resolve cleanly on manual + scheduled triggers |
| **M13.3** | Ambient events B: cooling emergency (fan spin-up, steam burst, warning LEDs, drone dispatch, 20 s, resolves) + drone launch (roof-bay panel opens, 2–4 drones fly to patrol) | Both events run start→resolve with no leftover state; visible from street level |
| **M13.4** | Ambient events C: mechanical reposition (giant fan/antenna/ring slow move + rumble + tiny shake) + distant EM discharge (far lightning + a few city arcs); awakening-compat: during AWAKE only creature-priority events fire | 3-min idle play shows ≥ 4 different events, none conflicting, none breaking perf; AWAKE window respected |
| **M14.1** | Perf monitor + quality tiers: rolling FPS, `HIGH/MED/LOW` (auto + manual); tiers scale LOD radius, particle/drone/vehicle caps, sign texture updates, light shafts, audio beds | Forcing each tier in smoke run: stats within budget, no stutter on tier switch |
| **M14.2** | HUD stats (small, corner, toggleable): FPS, visible instances, active drones, chunk id, AI state | HUD matches measured stats; toggle hides it; costs nothing hidden |
| **M14.3** | Polish pass: shake tuning, flash tuning, title fade, mute key (`M`), help overlay (`H`), cheap DOM vignette | Each control verified working; feel pass recorded (3-min run) |
| **M14.4** | Robustness pass: refresh mid-game, tab-hide/resume (dt clamp), resize mid-awakening, gamepad plug/unplug — no errors, no stuck states | Robustness checklist in smoke run fully green |
| **M14.5** | Final verification: manual 3-min screen-recording run — intro → reveal → idle life → manual awakening → easter-egg reaction → performance stable | Recording reviewed; stable frame rate through the awakening at default quality on a modern gaming GPU |

## Milestone details

### M0 — Scaffold & boot skeleton
- [x] Single HTML skeleton: full-screen canvas, no scrollbars, resize handler.
- [x] Three.js import; scene, renderer (ACES tone mapping, sRGB), camera.
- [x] `BOOT` state machine: shows "START / ENTER SIMULATION" button
      (audio unlock gate), starts renderer loop, no double-init.
- [x] Empty scene renders; resize correct; FPS counter visible.
- **Done-when:** clicking START always leads to a live 60 fps loop;
  refreshing the page never leaves a stuck state.

### M1 — Core loop, input, camera foundations ✅
- [x] Fixed-order `systems` registry + `update(dt)`; clamped `dt`.
- [x] `INPUT`: WASD/ZQSD, Shift, Space, mouse look (pointer lock), wheel zoom,
      middle-mouse orbit, key to switch camera modes.
- [x] Gamepad: poll per frame, optional, no crash without one (deadzone,
      axes for look/move, trigger for zoom).
- [x] `CAMERA`: ground/exploration mode (height-clamped, collision-lite) and
      cinematic free-fly; smooth lerp between modes; subtle shake API.
- **Done-when:** you can fly around an empty dark void in both cameras,
      gamepad moves the camera when plugged in, nothing throws without one.

### M2 — Procedural voxel material kit
- [x] Shared material library: emissive server faces, dark metal, glass,
      glow panels, cable material — all cheap (mostly `MeshLambert`/`Basic` +
      a few `Standard` for hero parts).
- [x] `makeCanvasTexture` helpers: animated LED grid, holo sign face,
      soft glow sprite, "UNSLOTH" + "QWEN" sign faces.
- [x] Instance helpers: `InstancedBox` builder (position/scale/color),
      `InstancedCylinder`, merged-geometry batcher.
- [x] Lighting rig: hemi + one key directional "moon/anti-sun",
      a few point lights reserved for hero moments only.
- **Done-when:** kit renders a test wall/tower with animated LED faces
      and signs at < 10 draw calls.

### M3 — Chunked city generation (far layer) ✅
- [x] Seeded PRNG (mulberry32), city grid: blocks, avenues, height falloff
      around the central plaza, ring roads.
- [x] Chunk = 16×16 block grid; generate on demand around player,
      unbuild behind; simple per-chunk budget (density by distance ring).
- [x] Building archetype picker with weights by zone:
      server tower, rack slab, cooling tower, substation, antenna farm,
      fiber conduit spire, holo-sign tower, residential-ish data housing.
- [x] Distance LOD: 3 rings (dense / mid / silhouetted-boxes + haze color).
- **Done-when:** city extends well beyond initial view, no visible
  duplication, draw calls stay flat as you fly further out.

### M4 — Building detail passes (near layer) ✅
- [x] Per-archetype detail builders on top of the M3 mass — five pooled
      InstancedMeshes per ring 0/1 chunk (fan / dish / pulse / sign /
      LED window; ~5 extra draw calls per near chunk, all shared
      geometries + shared materials, zero per-frame allocation):
      - server/rack: LED window facades (shared animated canvas texture;
        fair two-pass allocation — every candidate gets one seeded facade
        before any gets a second; long ±Z faces always, ±X seeded)
      - cooling towers: big animated fans (shared rotating instanced
        blades) + pipes connecting nearby towers (static mass boxes)
      - substations: spark points on the shared pulse mesh
      - antennas: masts, dishes (slow scan), blinking beacons
      - fiber spires: glowing conduit bands with scrolling emissive dash
        instances (light traveling up the spire)
      - holo-sign towers: animated canvas texture + additive billboard
      - (deliberate delta: front doors / cable trays / roof vents not
        modeled as separate parts — mass variation + lit facades carry
        readability; steam emitters wait on the M7 particle pool)
- [x] Detail level by ring (0/1 = near/full, 2 = silhouette with zero
      detail → clean far layer) + per-building seeded salt (block seed)
      → no two neighbours share a detail layout.
- [x] Distant haze: exponential fog over the clean far silhouettes
      (ring-2 chunks carry no animated/emissive detail to shimmer).
- **Done-when:** standing in the city, every archetype is readable from
  50–200 m and looks procedurally varied; FPS within target — verified:
  street-level + elevated screenshots in `smoke/shots/` (LED facade,
  QWEN/UNSLOTH signs, spinning fans, varied silhouettes); smoke M4
  section green (near-ring led=568 / fan=151 / pulse=318 / sign=9 /
  dish=8, ring-2 all zero, byte-identical regen, fans+pulses animate,
  32 draw calls near — flat vs M3).

### M5 — The Qwen machine-creature (dormant) ✅
- [x] Central plaza: darkened mega-core pedestal, creature ~ several
      buildings tall, built from: server-tower torso, cooling-tower
      shoulders, glowing compute-core head/face, mechanical limbs,
      antennas, rotating tensor torus rings (idle: almost still, dim).
- [x] Named rig parts with transform roots so M9 can animate them
      (`head`, `jaw`, `coreEye`, `ringA..C`, `armL/R`, `spine`, `antenna*`).
- [x] Dormant state: slow breathing scale on the core, 1 % dim LEDs,
      minimal particle drip (steam) — heartbeat audio stays in M11.
- [x] Thousands of compute-node voxels (single InstancedMesh, per-instance
      color + emissive via color) arranged on torso/rings — the nodes that
      will ignite at awakening.
- **Done-when:** the creature reads as "dormant colossal machine" from
  street level; silhouette holds from 3 camera distances — verified:
  street-close + street-full + mid + far screenshots in `smoke/shots/`
  (`m5-*.png`); smoke M5 section green (2,132 node voxels on one
  InstancedMesh, all named rig parts, breathing/ring-spin/eye-pulse
  animate, node matrices static, steam drip animates, 37 draw calls
  with the creature — flat vs M4).

### M6 — Traffic & ambient life (pooled)

#### M6.1 — Object-pool foundation
- [x] Generic `Pool` helper: fixed capacity allocated at init, `acquire` /
      `release`, zero `new` after init; shared by all later emitters.
- **Test:** smoke run does 10k acquire/release cycles; stats show zero
      allocation after init, no GC churn.
- **Commit when:** pool lands + smoke test green.
- **Verified:** smoke M6.1 section green — `POOL.make` allocated the full
      capacity exactly once (factory called 64×); 10k-cycle burst run
      (39,994 acquire/release ops) handed out only pre-created refs
      (zero `new` after init), JS heap delta 0 bytes across the run;
      exhaustion returns null (cap hit, no throw), double/foreign
      releases are counted no-ops, pool returns to full, aggregate
      stats via `POOL.stats()` sane for M6.5 caps / M14.2 HUD.

#### M6.2 — Maintenance drones ✅
- [x] Small voxel-quad drones (one InstancedMesh), patrol routes between
      towers, dock at roof bays; cap by distance to player and FPS tier.
- **Test:** from street level drones visibly patrol and dock; count never
      exceeds tier cap; no allocation per frame.
- **Commit when:** drones verified on screen at the cap limit.
- **Verified:** smoke M6.2 section green — fleet grows to the HIGH cap
  (16) on the `traffic-drone` M6.1 pool (fixed capacity, every live
  drone is a pre-created pool item ⇒ zero `new` after init); docked +
  airborne + routed drones all observed, positions advance across
  frames, JS heap flat across the live-fleet window (min-of-3-sample
  churn ≤ 2 MB);
  `TIER.set('low')` trims the fleet to 5 (excess released to the pool,
  pool inUse === count), `TIER.set('high')` regrows it to 16; draw calls
  stay inside budget (< 150) with the fleet at cap; street-level
  screenshot `smoke/shots/m62-drones-street.png` — pose chosen by an
  analytic line-of-sight check against the instanced building boxes so
  the drone is provably in frame (dense core city otherwise hides any
  given tower). Docks/waypoints are deterministic — `WORLD.buildingAt`
  replays the exact M3 seeded path (occupancy → archetype → mass) for a
  block, so routes always land where mass actually is; docks at
  `info.hTop + 7 m` (hTop = true roof incl. crowns; 7 m clears M4 roof
  signs), so drones hover visibly ABOVE the roof — a dock on `info.h`
  sat inside the server crown and was invisible; docks capped to a
  260 m player annulus, release past 299 m; one merged-geometry voxel
  quad per drone (chassis + 4 rotors + sensor nub) on a single
  InstancedMesh = one draw call; cyan/amber per-instance tints,
  per-frame re-set so swap-remove stays in sync.

#### M6.3 — Sky vehicles with light trails ✅
- [x] Vehicles on ring roads at 3 altitudes, additive sprite-streak
      trails; capped like drones.
- **Test:** trails readable from all 3 altitudes; count never exceeds
      tier cap.
- **Commit when:** trails verified at each altitude.
- **Verified:** smoke M6.3 section green — fleet grows to the HIGH cap
  (12) on the `traffic-vehicle` M6.1 pool (fixed capacity, every live
  vehicle a pre-created pool item ⇒ zero `new` after init); all 3
  ring-road altitudes (70/95/120 m) occupied at once; trails verified
  analytically from the instance matrices (two additive segments per
  vehicle on the shared `MATS.pulseGlow` material: bright head slot
  i*2 spanning 0..0.5L + 0.45× dim tail slot i*2+1 spanning 0.5L..L
  behind the hull); JS heap flat across the live-fleet window
  (min-of-3-sample churn ≤ 2 MB); sampled cap hold never exceeded 12;
  `TIER.set('low')` trims the fleet to 3 (excess released to the pool,
  pool inUse === count), `TIER.set('high')` regrows to 12; draw calls
  stay inside budget (39) with the fleet at cap — the whole fleet
  costs exactly 2 draw calls (one hull InstancedMesh + one trail
  InstancedMesh); per-altitude streak screenshots
  `smoke/shots/m63-vehicles-alt{0,1,2}.png` with the pose chosen by an
  analytic line-of-sight check against the instanced building boxes
  plus a side-on filter (reject near end-on streaks that read as
  blobs), retry loop while the fleet cycles. M2 smoke gate now also
  hides the TRAFFIC meshes (the +2 vehicle draw calls would otherwise
  break the < 10 KIT-only gate).

#### M6.4 — Steam vents + sparks
- [ ] Steam vents from cooling towers (billboard sprite pool, upward
      drift, fade); sparks from substations (tiny points, brief life).
- **Test:** smoke screenshot shows steam + sparks at their source
      buildings; both emitters idle-cheap in stats.
- **Commit when:** screenshot + idle-cost check pass.

#### M6.5 — Adaptive caps by FPS tier
- [ ] `TRAFFIC` reads current FPS tier and scales all M6 pool sizes.
- **Test:** forcing LOW tier in smoke run visibly halves caps; switching
      back to HIGH restores; no frame spike on switch.
- **Commit when:** tier-switch test passes.

**Phase done-when:** city feels inhabited; caps never exceed tier;
pools never allocate per frame.

### M7 — Particle & FX system

#### M7.1 — Pooled particle system
- [ ] One pooled `Points`/sprite system covering: steam, sparks, pulse
      motes, lightning motes, rain-of-energy (awakening).
- **Test:** one dev trigger key rains all particle types; idle cost ~0
      in stats.
- **Commit when:** trigger key works and idle cost verified.

#### M7.2 — `FX.pulse`
- [ ] `FX.pulse(origin, radius, color)`: expanding instanced ring mesh +
      light-intensity ramp (+ audio thump once M11.3 lands).
- **Test:** manual key fires a visible pulse; zero allocation; zero
      added draw calls while idle.
- **Commit when:** pulse verified on key press.

#### M7.3 — Animated electrical arcs
- [ ] Line segments regenerated every N frames between anchor points
      (substation → substation, creature → ring).
- **Test:** manual key sparks arcs between two substations and
      creature→ring; regeneration cost stays frame-cheap.
- **Commit when:** arcs verified at both anchor types.

#### M7.4 — Screen-space flash
- [ ] Full-screen additive plane in a small overlay scene (or DOM div)
      driven by `FX.flash(intensity)`.
- **Test:** manual key flashes and decays to zero; nothing costs while
      idle.
- **Commit when:** flash verified.

#### M7.5 — Impulse camera shake
- [ ] Impulse-decay shake system consumed by `CAMERA`.
- **Test:** manual key shakes camera, decays cleanly to still, never
      accumulates under repeated triggers.
- **Commit when:** shake verified.

**Phase done-when:** every effect has a manual trigger key and costs
nothing while idle.

### M8 — Atmosphere: night, fog, sky, light shafts

#### M8.1 — Night sky dome
- [ ] Gradient sky dome (big sphere with canvas/shader texture), stars,
      faint aurora band.
- **Test:** night mood readable from street level; dome renders correct
      from street, orbit, and far-fly cameras.
- **Commit when:** sky verified from 3 camera distances.

#### M8.2 — Fog depth + zone tint
- [ ] Fog tuned for depth; haze tinted by zone (cyan core / warm avenues)
      via fog color lerp.
- **Test:** depth readable at 500 m; zone tint visible while flying
      across zones.
- **Commit when:** both verified on screen.

#### M8.3 — Light shafts
- [ ] A few additive cone/cylinder meshes from key spires and the
      creature core; only when near or during awakening.
- **Test:** shafts visible standing near a spire, absent far away (no
      permanent draw calls).
- **Commit when:** near/far toggle verified in stats.

#### M8.4 — Distant lightning events
- [ ] Random far point + brief hemi intensity bump + flash; EM discharge
      rings visible across the city.
- **Test:** lightning event (timer + manual key) visible from inside the
      city.
- **Commit when:** event verified from inside the city.

**Phase done-when:** depth and mood readable from street level;
lightning event visible from inside the city.

### M9 — Creature animation & awakening sequence (the climax)

#### M9.1 — Idle/dormant animation
- [ ] Slow tensor-ring rotation, antenna sway, breathing core, occasional
      "dream" LED wave across the node grid (shader-less: animate
      instance colors in waves).
- **Test:** dream wave visibly sweeps the node grid on its timer; dormant
      state stays dim and still-ish.
- **Commit when:** wave verified on screen.

#### M9.2 — Wake state machine
- [ ] DORMANT → STIR (2 s: head lift, jaw, rings speed up) → AWAKE
      (10–20 s) → DECAY → DORMANT, with per-state hooks.
- **Test:** smoke test forces transitions in order, verifies clean
      return to DORMANT and safe immediate re-trigger.
- **Commit when:** state-machine test green.

#### M9.3 — Awakening beats 1–3 (creature-level power)
- [ ] Beat 1: core eye flares (emissive ramp + light + flash).
- [ ] Beat 2: node voxels ignite in radial waves (instance color updates).
- [ ] Beat 3: tensor rings accelerate + tilt; limbs reposition
      (shake impulse).
- **Test:** on manual trigger, beats 1–3 play in sequence with correct
      timing (visual check + state timestamps in smoke run).
- **Commit when:** beats 1–3 verified.

#### M9.4 — Awakening beats 4–5 (city-level cascade)
- [ ] Beat 4: energy pulse ring launches from the plaza; city holo-signs
      and building LEDs follow the wave (scheduled per-ring color ramps —
      the "thousands of compute nodes illuminate" moment).
- [ ] Beat 5: substation arcs fire; steam vents burst; drones scatter and
      some re-route to the creature; sky vehicles change to avoidance
      paths.
- **Test:** wave visibly travels ring by ring; traffic reacts (scatter /
      re-route / avoidance all observed).
- **Commit when:** cascade verified end-to-end.

#### M9.5 — Awakening beats 6–7 + decay
- [ ] Beat 6: Unsloth easter egg reacts (M10.3 hook).
- [ ] Beat 7: decay — waves dim outward, hum settles, one final pulse,
      back to DORMANT.
- **Test:** full sequence ends in DORMANT with one final pulse;
      re-trigger immediately works.
- **Commit when:** full-sequence test passes.

#### M9.6 — Triggers (manual + auto)
- [ ] Manual: key (e.g. `F`) + HUD button. Auto: plays once ~30 s after
      intro for audience that presses nothing.
- **Test:** all three entry paths (key, button, auto) start the same
      sequence exactly once; auto never re-fires.
- **Commit when:** trigger test passes.

**Phase done-when:** a first-time viewer reads the sequence as a clear
narrative (dormant → stir → awake → pulse → settle) in ≤ 30 s.

### M10 — Unsloth easter egg (subtle, integrated)

#### M10.1 — Sloth monument + "UNSLOTH" sign
- [ ] One side avenue, mid-distance: voxel **neon sloth** monument atop
      a compute tower + rooftop "UNSLOTH" holo sign, tagline cycles
      ("local ≠ slow" / "why rush?").
- **Test:** monument + sign readable from street; tagline cycles; both
      outside the default intro-reveal framing.
- **Commit when:** verified on screen + framing check.

#### M10.2 — Holographic sloth + sloth drones
- [ ] Relaxed holographic sloth silhouette on the tower's antenna arm,
      slow breathing (billboard + canvas sprite, additive).
- [ ] 1–2 sloth-themed maintenance drones (extra slow, slightly larger,
      soft pink light) patrolling that street only.
- **Test:** holo sloth breathes; pink drones patrol only that street.
- **Commit when:** both verified.

#### M10.3 — Awakening reaction
- [ ] Sign flares, holograph brightens + one slow stretch animation,
      sloth drones rise to hover nearby for the pulse, then resume
      patrolling.
- [ ] Constraint: never competes with the creature in the default
      framing of the intro reveal; max ~5 % of attention budget.
- **Test:** reaction plays during AWAKE; everything returns to idle after
      DECAY.
- **Commit when:** reaction verified in a full awakening run.

**Phase done-when:** a local-LLM fan spots it within seconds and it
feels like it belongs to the world, not pasted on.

### M11 — Procedural audio (Web Audio only)

#### M11.1 — Master graph + gesture gate
- [ ] Compressor → user-mute gain → destination; starts only on user
      gesture (START button), resume-safe.
- **Test:** no audio before gesture; mute key mutes everything; refresh /
      re-entry safe, no errors.
- **Commit when:** gate + mute verified.

#### M11.2 — Looping beds
- [ ] Reactor hum (2 detuned sines/triangles + sub sine, slow LFO); fans
      (filtered noise loop, band-pass sweep); distant machinery (filtered
      noise + random low thumps).
- **Test:** beds run for minutes without audible repeats/bugs; mix
      identifiable as "machine city" within 3 s.
- **Commit when:** long-run listen test passes.

#### M11.3 — Event sounds
- [ ] Pulse thump (sine drop + noise hit), arc crackle (short filtered-
      noise bursts), steam hiss, drone whir — wired to the M6–M9
      emitters.
- **Test:** each corresponding in-game event produces its sound; all
      silent when muted; zero cost when idle.
- **Commit when:** every event sound verified in-game.

#### M11.4 — Spatial-ish mixing
- [ ] One panner + distance gain for the 2–3 nearest emitters;
      everything else folded into the ambient bed.
- **Test:** walking past an emitter pans/attenuates it; cost stays
      bounded in stats.
- **Commit when:** spatial behavior verified.

**Phase done-when:** muting audio costs nothing; mix identifiable as
"machine city" within 3 seconds.

### M12 — Intro cinematic

#### M12.1 — Intro engine + corridor beat
- [ ] Camera-keyframe timeline runner (no async resources anywhere).
- [ ] Beat 1: dark server corridor — near-black tunnel of LED strips
      rushing by (procedural instanced wall + camera dolly).
- **Test:** corridor beat plays; timeline-runner smoke test: start,
      cancel mid-way, re-seek — all clean, zero errors.
- **Commit when:** engine + beat 1 verified.

#### M12.2 — Beats 2–5: reveal, orbit, title, drop
- [ ] Beat 2: corridor opens → wide reveal dolly out over the city.
- [ ] Beat 3: low orbit around the dormant creature (1.5 orbits).
- [ ] Beat 4: title card `QWEN FLASH // AWAKENING` (DOM overlay, fades).
- [ ] Beat 5: lerp into player position at street level → gameplay.
- **Test:** full ~12–15 s intro plays to a controllable street-level
      camera.
- **Commit when:** full intro verified end-to-end.

#### M12.3 — Skip/cancel robustness
- [ ] Skippable/cancellable at any moment (START/click/keypress) → 0.5 s
      fade to street camera; START always visible after 2 s; intro can
      never block the play state.
- **Test:** finish / early-skip / late-interrupt — all three paths end
      in a controllable camera with zero console errors.
- **Commit when:** all three paths verified.

**Phase done-when:** intro finishes, skips, or is interrupted — all
paths end in a controllable camera, zero console errors.

### M13 — Emergent event director

#### M13.1 — Scheduler core
- [ ] Weighted picking, cooldowns, min/max gap, event registry,
      one-at-a-time + priority rules.
- **Test:** smoke test with a fixed random seed yields a legal firing
      order — no overlaps, gaps respected, priorities held.
- **Commit when:** scheduler test green.

#### M13.2 — Ambient events A: data pulse + power cycle
- [ ] Data pulse: light dot travels between two towers along a conduit
      path, both ends flash (uses M7 cables).
- [ ] Section power cycle: one ring chunk dims/brightens over 3–6 s
      (per-chunk material color multiplier — cheap).
- **Test:** both events fire and resolve cleanly on manual + scheduled
      triggers; no leftover state.
- **Commit when:** both verified.

#### M13.3 — Ambient events B: cooling emergency + drone launch
- [ ] Cooling emergency: one cooling tower fans spin up, steam burst,
      warning LEDs, drones dispatch, ~20 s, resolves.
- [ ] Drone launch: a roof bay opens (animated panel), 2–4 drones fly
      to patrol.
- **Test:** each event runs start→resolve with no leftover state; both
      visible from street level.
- **Commit when:** both verified.

#### M13.4 — Ambient events C + awakening compatibility
- [ ] Mechanical reposition: one giant fan/antenna/ring moves slowly
      with rumble audio + tiny shake.
- [ ] Distant EM discharge: lightning far off + a few arcs in the city.
- [ ] Awakening compatibility: during AWAKE only creature-priority events
      may fire.
- **Test:** 3-minute idle play shows ≥ 4 different events, none
      conflicting, none breaking perf; AWAKE-window rule respected.
- **Commit when:** 3-min idle run + AWAKE rule verified.

**Phase done-when:** 3 minutes of idle play shows at least 4 different
events, none conflicting, none breaking perf.

### M14 — Performance, quality tiers, polish pass

#### M14.1 — FPS monitor + quality tiers
- [ ] Rolling FPS monitor; tiers `HIGH / MED / LOW` (auto + manual).
      Tiers scale: far-chunk LOD radius, particle caps, drone/vehicle
      counts, holo-sign texture updates, light shafts, audio beds.
- **Test:** forcing each tier in the smoke run keeps stats within budget;
      no stutter on tier switch; frustum + ring culling verified via
      stats.
- **Commit when:** all three tiers verified.

#### M14.2 — HUD stats
- [ ] Small corner HUD, toggleable: FPS, visible instances, active
      drones, chunk id, AI state.
- **Test:** HUD values match measured stats; toggle hides it; hidden HUD
      costs nothing.
- **Commit when:** values cross-checked.

#### M14.3 — Polish pass
- [ ] Camera shake tuning, flash tuning, title fade, mute key (`M`),
      help overlay (`H`), vignette via cheap DOM gradient.
- **Test:** each control verified working; short feel pass recorded.
- **Commit when:** polish checklist green.

#### M14.4 — Robustness pass
- [ ] Page refresh mid-game, tab-hide/resume (dt clamp), window resize
      mid-awakening, gamepad plug/unplug — no errors, no stuck states.
- **Test:** robustness checklist in the smoke run fully green.
- **Commit when:** checklist green.

#### M14.5 — Final verification run
- [ ] Manual 3-minute screen-recording run: intro → reveal → idle life →
      manual awakening → easter egg reaction.
- **Test:** recording reviewed — stable frame rate through the awakening
      sequence at default quality on a modern gaming GPU.
- **Commit when:** recording approved + final tag.

**Phase done-when:** on a modern gaming GPU the whole thing runs at a
stable frame rate through the awakening sequence at default quality.

---

## Definition of done (whole file)

1. Opens from disk in a modern browser, no console errors.
2. START always works, first click starts audio, second (re)entry safe.
3. Awakening is the emotional peak; Unsloth is the smile.
4. First-time viewer reaction target: "how did a local model generate this?"

## Out of scope (deliberately)

- No ray tracing / real reflections — emissive + additive + fog only.
- No physics collision (camera is collision-lite).
- No saving, no networking, no mobile touch.
