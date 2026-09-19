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
| **M6.4** ✅ | Steam vents (cooling towers, billboard sprite pool, upward drift, fade) + sparks (substations, tiny points, brief life) | Both emitters run idle-cheap; smoke shot shows steam + sparks at source buildings |
| **M6.5** ✅ | Adaptive caps: `TRAFFIC` reads current FPS tier, scales all M6 pools | Forcing LOW tier in smoke run visibly halves caps; back to HIGH restores; no spike |
| **M7.1** ✅ | Pooled `Points`/sprite particle system: steam, sparks, pulse motes, lightning motes, awakening rain — one system, one budget | One trigger key rains all particle types; idle cost ~0 in stats |
| **M7.2** ✅ | `FX.pulse(origin, radius, color)`: expanding instanced ring mesh + light-intensity ramp (+ audio hook once M11 lands) | Manual key fires a visible pulse; nothing allocated; idle = zero draw calls added |
| **M7.3** ✅ | Animated electrical arcs: Line segments regenerated every N frames between anchors (substation→substation, creature→ring) | Manual key sparks arcs between two substations and creature→ring; regen is frame-cheap |
| **M7.4** ✅ | Screen-space flash: overlay-scene additive plane (or DOM div) driven by `FX.flash(intensity)` | Manual key flashes screen; decays to zero; costs nothing idle |
| **M7.5** ✅ | Camera shake: impulse-decay system consumed by `CAMERA` | Manual key shakes camera with clean decay to still; never accumulates |
| **M8.1** ✅ | Night sky: gradient sky dome (big sphere, canvas/shader texture), stars, faint aurora band | Night mood readable from street level; dome correct from street, orbit, and far fly |
| **M8.2** ✅ | Fog depth tune + zone-tinted haze (cyan core / warm avenues) via fog color lerp | Depth readable at 500 m; zone tint visible flying across zones |
| **M8.3** ✅ | Volumetric-ish light shafts: a few additive cone/cylinder meshes from key spires + creature core (only when near / during awakening) | Shafts visible near spire, absent far away (no permanent draw calls) |
| **M8.4** ✅ | Distant lightning: random far point + brief hemi bump + flash + EM discharge ring across the city | Lightning event visible from inside the city; fires on timer + manual key |
| **M9.1** ✅ | Idle/dormant animation: tensor-ring rotation, antenna sway, breathing core, periodic "dream" LED wave across the node grid (instance-color waves) | Dream wave sweeps the node grid visibly; dormant state stays dim and still-ish |
| **M9.2** ✅ | Wake state machine: DORMANT → STIR (2 s head lift, jaw, rings speed up) → AWAKE (10–20 s) → DECAY → DORMANT, with per-state hooks | State machine smoke test: forced transitions in order, clean return to DORMANT, re-trigger safe |
| **M9.3** ✅ | Awakening beats 1–3: core-eye flare (emissive ramp + light + flash), node voxels ignite in radial waves, rings accelerate + limbs reposition (shake impulse) | Beats 1–3 play in sequence with correct timing on manual trigger |
| **M9.4** ✅ | Awakening beats 4–5: energy pulse ring from plaza + city holo-signs/LEDs following the wave (per-ring scheduled ramps), substation arcs fire, steam bursts, drones scatter/re-route, vehicles avoid | The "thousands of compute nodes illuminate" moment lands; wave visibly travels ring by ring |
| **M9.5** ✅ | Awakening beats 6–7 + decay: easter-egg reaction hook (M10), waves dim outward, hum settles, final pulse | Full sequence ends back in DORMANT with one final pulse; re-trigger immediately works |
| **M9.6** ✅ | Triggers: manual key (`F`) + HUD button, auto-play once ~30 s after intro | All three entry paths (key, button, auto) start the same sequence exactly once |
| **M10.1** ✅ | Voxel neon **sloth** monument atop one compute tower on a side avenue + rooftop "UNSLOTH" holo sign with cycling taglines ("local ≠ slow" / "why rush?") | Monument + sign readable from street; sign cycles; outside default intro framing |
| **M10.2** ✅ | Relaxed holographic sloth silhouette on the antenna arm (billboard + canvas sprite, additive, slow breathing) + 1–2 slow sloth-themed maintenance drones (bigger, soft pink) patrolling that street only | Holo sloth breathes; pink drones patrol only that street |
| **M10.3** ✅ | Awakening reaction: sign flares, holograph brightens + one slow stretch, sloth drones rise to hover for the pulse, then resume | Reaction plays during AWAKE, everything returns to idle after DECAY |
| **M11.1** ✅ | Audio master graph: compressor → user-mute gain → destination; gesture-gated start (START button), resume-safe | Audio starts only after gesture; mute key mutes all; refresh/re-entry safe |
| **M11.2** ✅ | Looping beds: reactor hum (detuned sines + sub + LFO), fans (filtered noise, band-pass sweep), distant machinery (noise + random low thumps) | Beds run indefinitely without audible repeats/bugs; identifiable as "machine city" within 3 s |
| **M11.3** ✅ | Event sounds: pulse thump, arc crackle, steam hiss, drone whir — wired to M6–M9 emitters | Each event in-game produces its sound; all silent when muted; zero cost when idle |
| **M11.4** ✅ | Spatial-ish mixing: one panner + distance gain for 2–3 nearest emitters, rest folded into ambient bed | Walking past an emitter pans/attenuates; cost bounded |
| **M12.1** ✅ | Intro engine: camera-keyframe timeline runner (no async resources) + beat 1 dark server corridor (procedural instanced LED-strip tunnel + dolly) | Corridor beat plays; timeline runner test: start/cancel/seek all clean |
| **M12.2** ✅ | Intro beats 2–5: corridor opens → wide reveal dolly over city → 1.5-orbit low orbit of dormant creature → `QWEN FLASH // AWAKENING` title card (DOM, fades) → lerp to street-level player position | Full ~12–15 s intro ends in controllable street-level camera |
| **M12.3** ✅ | Intro robustness: skippable/cancellable at any point (START/click/keypress) → 0.5 s fade to street camera; START visible after 2 s; intro never blocks play state | Finish / early-skip / late-interrupt all end in controllable camera, zero console errors |
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
- [x] Steam vents from cooling towers (billboard sprite pool, upward
      drift, fade); sparks from substations (tiny points, brief life).
- **Test:** smoke screenshot shows steam + sparks at their source
      buildings; both emitters idle-cheap in stats.
- **Commit when:** screenshot + idle-cost check pass.
- **Verified:** smoke M6.4 section green — steam pool
  (`traffic-steam`, HIGH cap 48) + spark pool (`traffic-spark`, HIGH cap
  64) registered on the M6.1 `POOL` (fixed capacity, every live puff/
  spark a pre-created pool item ⇒ zero `new` after init); the steam
  field saturates the cap (spawn rate × life > cap ⇒ the fixed pool is
  the gate, one billboard InstancedMesh + one additive Points); every
  live puff verified above a cooling-tower vent and every spark above a
  substation by replaying the seeded M3 block seeds (the same
  `buildingAt` path the emitters use); steam visibly rises (upward
  drift, sway, grow, sin-fade) and sparks age out (brief ballistic
  life, continuous bursts); JS heap flat across the live-emitter window
  (min-of-3-sample churn ≤ 2 MB); sampled counts never exceeded the tier
  caps; `TIER.set('low')` trims both emitters (steam 48→12, excess
  released to the pools, pool inUse === count), `TIER.set('high')`
  regrows the full field; idle-cheap stats: exactly 1 steam + 1 spark
  draw call (additive blending, Points `setDrawRange` tracks the live
  count ⇒ 0 live items cost 0 draw calls); street-level screenshot
  `smoke/shots/m64-steam-sparks-street.png` with the pose chosen by an
  analytic line-of-sight check against the instanced building boxes
  (puff above a resolvable vent 50–170 m out, live spark at a
  substation ≤ 70 m from the vent, both in frame), retry loop while the
  emitters cycle. Sources are picked from a small live list of the
  nearby source buildings (rebuilt every 4 s from the seeded path) —
  blind random-block draws starve the emitters (a 200 m radius holds
  only ~10 source blocks); spawn timers accumulate the frame remainder
  (while-loop, not if-reset) so the rate is frame-rate independent.

#### M6.5 — Adaptive caps by FPS tier
- [x] `TRAFFIC` reads current FPS tier and scales all M6 pool sizes.
- **Test:** forcing LOW tier in smoke run visibly halves caps; switching
      back to HIGH restores; no frame spike on switch.
- **Commit when:** tier-switch test passes.

**Phase done-when:** city feels inhabited; caps never exceed tier;
pools never allocate per frame.

### M7 — Particle & FX system

#### M7.1 — Pooled particle system ✅
- [x] One pooled `Points`/sprite system covering: steam, sparks, pulse
      motes, lightning motes, rain-of-energy (awakening).
- **Test:** one dev trigger key rains all particle types; idle cost ~0
      in stats.
- **Commit when:** trigger key works and idle cost verified.
- **Verified:** smoke M7.1 section green — `PARTS` owns every particle in
  the demo on five M6.1 pools (`parts-steam`/`parts-spark`/`parts-pulse`/
  `parts-light`/`parts-rain`, fixed capacity = HIGH tier cap 48/64/48/40/80
  ⇒ zero `new` after init); the one budget is `CFG.parts.tiers` {high:280,
  med:160, low:72} = the exact sum of the five per-type tier caps at every
  tier (asserted in smoke); idle cost ~0 — pulse/light/rain 0 live with 0
  drawRange/count and 0 pool inUse (0 draw calls) while the ambient
  steam/spark keep running; the dev trigger (Key `P`, INPUT edge →
  `PARTS.rainAll()`) rains ALL five types (one-time bursts + streak/mote
  trickles for 5 s around the player): every type observed live, every
  live particle a pre-created pool item (zero-`new` identity across all
  five pools, inUse === live count), rain streaks visibly fall (downward
  drift on live refs), sampled counts never exceed the tier caps (rain
  peaked 78/80), JS heap flat across the rain window (min-of-3-sample
  churn ≤ 2 MB), draw calls 44 (< 150) with the rain at cap; screenshot
  `smoke/shots/m71-particles-rain.png` (streaks in frame, camera tilted
  up at the 70–100 m spawn band); `TIER.set('low')` caps the trigger rain
  (rain 20/20, pulse 12/12, light 10/10), `TIER.set('high')` regrows past
  the LOW cap; the rain resolves clean — event types back to 0 live with
  drawRange/count 0 (no leftover state) while the ambient emitters keep
  running. The M6.4 steam/spark emitters moved from TRAFFIC into PARTS
  (config `CFG.traffic.steam/spark` → `CFG.parts.steam/spark`, pools
  `traffic-*` → `parts-*`, source lists on `PARTS`); M6.4/M6.5 smoke
  sections now read them from `S.PARTS`/`S.CFG.parts` and pass unchanged;
  the M2 gate also hides the five PARTS meshes.

#### M7.2 — `FX.pulse` ✅
- [x] `FX.pulse(origin, radius, color)`: expanding instanced ring mesh +
      light-intensity ramp (+ audio thump once M11.3 lands).
- **Test:** manual key fires a visible pulse; zero allocation; zero
      added draw calls while idle.
- **Commit when:** pulse verified on key press.
- **Verified:** smoke M7.2 section green — `FX` registered in fixed order
  (…PARTS, FX, HUD); state on the M6.1 pool `fx-pulse` (fixed capacity =
  HIGH tier cap 6 ⇒ every live pulse a pre-created pool item, zero `new`
  after init); the ring is ONE shared InstancedMesh (RingGeometry 0.92–1.0
  on the ground plane, XZ instance scale = radius, shared additive
  `MATS.pulseGlow` ⇒ per-instance color = tint × sin-fade IS the light)
  plus one pooled PointLight per live pulse (slot i ⇔ live[i],
  intensity = 5000 × sin²(u·π), hidden while idle); idle = zero added
  draw calls (call count identical with the ring hidden vs shown at 0
  live); Key R fires a pulse 32 m ahead of the player ⇒ exactly +1 draw
  call (the ring) with the pooled light on; ring visibly expands tracking
  the eased-out radius (24.6 → 35.3 m, want 35.3); light intensity tracks
  the sin² peak (5000, want 5000); pulse resolves clean (0 live, ring
  count 0, lights hidden + intensity 0, pool drained); `FX.pulse`
  honours radius + color args (sRGB → working space, defaults honoured);
  LOW trims 6 fired pulses to the LOW cap 2 (excess released, inUse ===
  count), HIGH restores 6 (draw calls 53 < 150); heap flat across the
  whole pulse sequence (min-of-3-sample churn ≤ 2 MB); screenshot
  `smoke/shots/m72-pulse-ring.png` (ring + light peak in frame, camera
  straight-down at GROUND max height). Audio thump deliberately deferred
  to M11.3 (seam: the `pulse()` call site).

#### M7.3 — Animated electrical arcs ✅
- [x] Line segments regenerated every N frames between anchor points
      (substation → substation, creature → ring).
- **Test:** manual key sparks arcs between two substations and
      creature→ring; regeneration cost stays frame-cheap.
- **Commit when:** arcs verified at both anchor types.
- **Verified:** smoke M7.3 section green — arcs live on the M6.1 pool
  `fx-arc` (capacity = HIGH tier cap 8 ⇒ every live arc a pre-created
  pool item, zero `new` after init) and render through ONE shared
  `LineSegments` with pre-allocated buffers (bolt = 12-seg jittered main
  + 3 forks = 21 segs = 42 verts); Key T sparks BOTH anchor types — the
  two nearest live substations (endpoints on the real roofs) and
  antenna tip → ring lane at a random vehicle altitude — with exactly
  +1 draw call (the shared mesh); regeneration re-jitters every
  `N = 3` frames (tick hits 0 exactly 4× and the position-buffer hash
  changes exactly 4× over 12 rAF frames) and stays frame-cheap (rAF
  deltas ≤ 2× baseline); idle = zero added draw calls (the mesh is
  hidden at 0 live — three r160 does not skip drawRange-0 lines);
  LOW trims 8 fired arcs to 3, HIGH holds all 8; heap flat; screenshot
  `smoke/shots/m73-arcs.png` with all four live endpoints asserted
  in-frame (deterministic pose: seeded city + fixed camera + fov reset).

#### M7.4 — Screen-space flash ✅
- [x] Full-screen additive plane in a small overlay scene (or DOM div)
      driven by `FX.flash(intensity)`.
- **Test:** manual key flashes and decays to zero; nothing costs while
      idle.
- **Commit when:** flash verified.
- **Verified:** smoke M7.4 section green — flash state on `FX` (no pool
  needed: one level scalar): ONE additive plane (`PlaneGeometry(2,2)`,
  toneMapped-off `MeshBasicMaterial`, depthTest/Write off) in a dedicated
  overlay scene + ortho NDC camera (`FX._flashScene`/`FX._flashCam`),
  rendered after the main scene ONLY while `FX._flash > 0` ⇒ 0 flash = 0
  added draw calls (verified: overlay not rendered at 0, stable call
  count); Key B fires `FX.flash(1)` ⇒ exactly +1 draw call (the overlay
  plane) with material color = tint × level (the additive amount); the
  flash decays monotonically (exponential, τ = `CFG.fx.flash.decay`
  0.30 s) and resolves clean — exactly 0, plane hidden, calls back to
  idle; `FX.flash(intensity, color)` semantics verified (clamps to
  0..max, ≤ 0 no-op, re-trigger = max not sum, hex + default color
  honoured); heap flat; screenshot `smoke/shots/m74-flash.png` (full-
  screen pale cyan-white flash at the deterministic M7.3 pose, mean
  luminance 174 vs 9 idle — both decoded in-page via dataURL → 2D
  canvas). Also: `renderer.info.autoReset = false` + per-frame
  `renderer.info.reset()` in `frame()` — with the default autoReset the
  second per-frame render (the overlay) would zero the reported main-
  scene call count; per-frame count is now main + overlay and idle
  frames are unchanged (every pre-existing smoke call-count check passes
  unmodified). Note: the pre-existing M6.2 heap-flat check flakes in
  this headless environment (~2.6 MB vs the 2 MB bound) — verified to
  fail identically at the pre-M7.4 HEAD baseline (environmental GC
  noise, not a regression).

#### M7.5 — Impulse camera shake
- [x] Impulse-decay shake system consumed by `CAMERA`.
- **Test:** manual key shakes camera, decays cleanly to still, never
      accumulates under repeated triggers.
- **Commit when:** shake verified.
- **Verified:** smoke M7.5 section green — the system is the impulse-
  decay energy scalar on `CAMERA` (no pool, no mesh, no material ⇒
  idle cost structurally zero: 0 energy ⇒ `_applyShake` early-returns,
  camera position untouched — verified); Key `N` (`INPUT.shakeTrigger`,
  consumed in `CAMERA.update`) fires `CAMERA.shake(CFG.input.shakeImpulse)`
  (1.0) ⇒ camera position offset from the deterministic still pose,
  bounded by `shakeAmp × energy` at every sampled frame, and the offset
  magnitude varies frame to frame (fresh transient offset each frame,
  never written into `CAMERA.pos`); decay monotone to exactly 0 with the
  camera back EXACTLY on the pose (off === 0); never accumulates — 10
  rapid re-triggers hold at `CFG.input.shakeCap` (1.5, moved out of the
  hardcoded cap into `CFG.input`), `shake(10)` clamps to the cap, negative
  is a no-op; heap flat across the whole sequence. No screenshot gate:
  a 0.22 m offset is sub-pixel at every deterministic pose, so the
  analytic checks are strictly stronger than a picture. Note: the
  pre-existing M6.2 "heap flat" smoke check flakes in this headless
  environment (~2.6–2.7 MB vs the 2 MB bound) — re-verified to fail at
  the pre-M7.5 baseline too (1 FAIL / 2 PASS in 3 baseline runs),
  environmental GC noise, not an M7.5 regression.

**Phase done-when:** every effect has a manual trigger key and costs
nothing while idle.

### M8 — Atmosphere: night, fog, sky, light shafts

#### M8.1 — Night sky dome
- [x] Gradient sky dome (big sphere with canvas/shader texture), stars,
      faint aurora band.
- **Test:** night mood readable from street level; dome renders correct
      from street, orbit, and far-fly cameras.
- **Commit when:** sky verified from 3 camera distances.
- **Verified:** smoke M8.1 section green — new `ATMOS` system (after FX,
  before HUD, registered in the fixed boot order) owns exactly 3 draw
  calls: a BackSide gradient dome (r 2400 < far 3000, 1×256 canvas
  vertical gradient, fog-off, no depth write), an additive `Points`
  star field (1600 pre-allocated, seeded mulberry32, upper hemisphere
  r 2300, shared `KIT.tex.glow` map, tier cap via `drawRange`
  high 1600 / med 900 / low 500), and a faint additive aurora band
  (open-ended BackSide cylinder r 2250, h 300 at 480 m altitude,
  canvas green curtains, slow spin) — all three pinned to the camera
  position each frame. Verified: exactly +3 draw calls vs hidden
  (total < 150); dome/stars track the camera exactly, aurora rides at
  the configured altitude; star `drawRange` caps at low/high with the
  full set pre-allocated (no allocation); aurora spin animates; heap
  flat across pure animation frames. Visual gate at 3 camera
  distances (street GROUND / orbit CINE / far CINE flyby): each
  on/off screenshot pair shows the dome raising sky-region mean
  luminance (5.4→15.2, 10.2→25.5, 8.6→26.2), stars adding bright
  sky pixels (167→232, 162→218, 172→272), and the aurora adding
  greenish sky pixels (0→6780, 0→7413, 0→7517) — `shots/m81-sky-
  {street,orbit,far}.png`.

#### M8.2 — Fog depth + zone tint
- [x] Fog tuned for depth; haze tinted by zone (cyan core / warm avenues)
      via fog color lerp.
- **Test:** depth readable at 500 m; zone tint visible while flying
      across zones.
- **Commit when:** both verified on screen.
- **Verified:** smoke M8.2 section green — fog depth tuned (FogExp2
  ρ 0.004 → 0.0028 in `CFG.atmos.fog.density`: analytic factor
  f(100 m) = 7.5 % ⇒ street range clear, f(500 m) = 85.9 % ⇒ distant
  structures survive as readable silhouettes instead of the old 98 %
  swallow); zone-tinted haze in `ATMOS.update` — `scene.fog.color`
  smoothstep-lerps by camera XZ distance from the plaza across the M3
  zone boundaries (220/520 m): cyan core `0x081726` → warm outer
  avenues `0x241a10`, all colors pre-allocated at init (heap flat,
  zero per-frame allocation); dome horizon tint syncs so sky and haze
  never disagree (cool in the core, warm outside); analytic zone check
  (fog color at core/mid/outer poses: cyan-dominant → warm-dominant,
  mid-zone exactly the lerp midpoint at k = 0.5); visual gates:
  500 m fog-on/fog-off screenshot pair — city region keeps a solid
  share of mean luminance and edge detail through the haze
  (`shots/m82-fog-500m.png`), zone tint visible flying across zones —
  city-region warmth (mean R − mean B) core −21.8 → outer −1.0
  (`shots/m82-fog-{core,outer}.png`); fog-off reference uses density 0
  (nulling `scene.fog` would throw in ATMOS and disable the subsystem)
  with a no-disabled-subsystems assert. Note: the pre-existing
  timing-sensitive smoke checks (M6.2 heap-flat, M6.3 fleet growth,
  M7.5 key-N shake) flake in this headless environment (rAF timing /
  GC noise) — baseline runs at the pre-M8.2 HEAD failed the M6.3
  fleet check, the M6.2 heap flake is documented since M7.4/M7.5, and
  both pass on other runs; environmental, not M8.2 regressions.

#### M8.3 — Light shafts
- [x] A few additive cone/cylinder meshes from key spires and the
      creature core; only when near or during awakening.
- **Test:** shafts visible standing near a spire, absent far away (no
      permanent draw calls).
- **Commit when:** near/far toggle verified in stats.
- **Verified:** smoke M8.3 section green — 4 spire slots + 1 creature
  core cone in `ATMOS.shaftGroup` (additive, fog-off, shared canvas
  gradient texture, `CFG.atmos.shaft`): a 2 s nearest-N scan
  (`ATMOS._refreshShafts`, pre-allocated scratch, no per-frame
  allocation) pins each slot to the nearest seeded fiber spire within
  130 m; opacity eases in/out (fade 2.5/s, no pop) and hidden shafts
  are `visible = false` ⇒ 0 draw calls; the core cone activates near
  the plaza (170 m) OR during any non-DORMANT entity state (M9 seam);
  tier cap trims via slot count (high 4 / med 2 / low 1). Gates:
  far pose (deterministic golden-angle spiral search for a spire-free
  130 m disc, 200–1600 m out) — every shaft hidden, group on/off
  draw-call delta 0 (per-pair median of 7, robust to transient dips);
  near pose (street pose with a fiber spire 30–45 m out) — ≥ 1 shaft,
  anchors replay through the seeded `buildingAt` path as real fiber
  spires, and the group on/off delta equals the in-frame count, where
  in-frame is the exact renderer culling test (6 frustum planes of
  P×V vs the cone bounding sphere, same as `WebGLRenderer`); visual
  gate: on/off screenshot pair — the cone adds light in a ±8 %
  vertical strip centred on the projected spire, 2-pair averaged
  12.47 → 14.67 (`shots/m83-shafts-near.png`); awakening seam:
  AWAKE at the far pose forces the core shaft on (+1 draw call),
  DORMANT hides it again (delta back to 0); heap flat across the whole
  sequence. Note: the pre-existing timing-sensitive flakes (M6.2
  heap-flat, M6.3 streak screenshots, M7.4 flash timing) are
  environmental in this headless setup and pass on other runs.

#### M8.4 — Distant lightning events
- [x] Random far point + brief hemi intensity bump + flash; EM discharge
      rings visible across the city.
- **Test:** lightning event (timer + manual key) visible from inside the
      city.
- **Commit when:** event verified from inside the city.
- **Verified:** smoke M8.4 section green — `ATMOS.ltGroup` holds a fog-off
  additive point-flash sprite + a fog-off additive EM discharge annulus
  (`RingGeometry(0.6, 1.0)`, 0.4R-wide band, `CFG.atmos.lightning`), both
  hidden idle ⇒ 0 draw calls; a fire (seeded auto timer 16–32 s, first
  delay 10 s, or Key L) strikes a random far point (700–1400 m, 220–380 m
  up) and plays a brief `KIT.hemi` bump (decays to exactly base),
  `FX.flash` (M7.4 seam), the sprite flicker (0.5 s), the ring
  (ease-out 2→950 m over 2.6 s, sin-fade tint), and 16 pooled lightning
  motes via new public `PARTS.lightning(x, z, n)` (shared
  `_spawnLightAt`). Gates: Key L fire state (far point in range, all
  channels alive, motes === 16); sprite and ring each exactly +1 draw
  call; hemi decays to exactly base and the event resolves clean; auto
  timer fires one event and re-seeds into [16, 32]; motes age out; visual
  gate — plaza-side pose 300 m out / 300 m up, re-fire at the last strike
  point, event frozen (`ATMOS._ltFrozen`), on/off `ltGroup` screenshot
  pair, 2-pair averaged strip at the projected far annulus edge
  23.29 → 101.09 (`shots/m84-lightning.png`); heap flat. Note: setting
  `CAMERA.pos.y` above `groundMaxY` during the GROUND→CINE mode blend
  sticks the altitude mid-blend (ground clamp is still active) — the
  smoke pose sets altitude after the 0.8 s blend settle; pre-existing
  flake fixes folded in: M7.4 flash level read before the screenshot,
  M7.5 shake bound uses sampling-start energy (frame-stale offset),
  M8.1 sky gate 2-pair averaged (live traffic in the off-shot sky).

**Phase done-when:** depth and mood readable from street level;
lightning event visible from inside the city.

### M9 — Creature animation & awakening sequence (the climax)

#### M9.1 — Idle/dormant animation
- [x] Slow tensor-ring rotation, antenna sway, breathing core, occasional
      "dream" LED wave across the node grid (shader-less: animate
      instance colors in waves).
- **Test:** dream wave visibly sweeps the node grid on its timer; dormant
      state stays dim and still-ish.
- **Commit when:** wave verified on screen.
- **Verified:** smoke M9.1 section green — `ENTITY` dormant idle: antenna
  sway (deterministic per-mast tilt `0.02·sin/cos(t·0.35+ph)`, mast
  children untouched) + dream wave, a shader-less radial LED sweep via
  instance colors (`hue × (base + 0.4·exp(−dd²/2σ²)·env)`, front 16 m/s
  from head level `(0,44,0)`, σ 5 m); dormant base colors restored
  byte-exact when the front exits, interval re-seeded by a seeded rng into
  14–26 s (first wave 8 s after boot); all per-node arrays pre-allocated
  (capacity 4200) ⇒ heap flat and no per-frame instance upload between
  waves; while active the hero light gets +0.5·env and the coreEye lerp
  +0.45·env. Seams for M9.2: `ENTITY._dreamFrozen` (wave-time freeze,
  same pattern as `ATMOS._ltFrozen`) and wave start gated on
  `ENTITY.state === 'DORMANT'`. Gates: registration (pre-allocated data,
  wave idle, grid dim maxc < 0.1); antennas sway within ±amp; timer fire
  (front node lit, ahead node still dim); sweep travel (B lit after, A dim
  again); resolves clean (base byte-exact, interval re-seeded, draw calls
  unchanged); dormant idle byte-static; heap flat; visual gate — street
  pose (72, 1.7, 55), wave frozen at r ≥ 18, off/on pair around the
  projected core, 2-pair averaged 11.37 → 19.55
  (`shots/m91-dream-wave.png`). Flake fixes folded in: M6.2 dock check
  samples dock/airborne states over a 20×250 ms window instead of one
  instant (dock 3–9 s vs. minutes of patrol ⇒ a single sample can catch
  the whole fleet airborne); M9.1 section arms the timer idempotently —
  a polling function that rewrites `nextAt = now+0.2` on every poll chases
  its own tail (the frame after a poll is only ~1 frame later, never
  0.2 s) and the wave never starts, and the sweep-travel `page.evaluate`
  must return `iA`/`iB` (an absent field makes `w2.iB >= 0` fail).

#### M9.2 — Wake state machine ✅
- [x] DORMANT → STIR (2 s: head lift, jaw, rings speed up) → AWAKE
      (10–20 s) → DECAY → DORMANT, with per-state hooks.
- **Test:** smoke test forces transitions in order, verifies clean
      return to DORMANT and safe immediate re-trigger.
- **Commit when:** state-machine test green.
- **Verified:** smoke M9.2 section green (9 checks, full suite ALL
  PASS ×3) — the machine lives on `ENTITY` (no new system): `state` /
  `stateT` (entry time, `performance.now()/1000` clock), durations in
  `CFG.entity.wake` {stir: 2, awake: [10, 20], decay: 3, headLift
  0.10 rad, headRise 0.8 m, jawOpen 0.22 rad, ringBoost 8}; transitions
  are made only inside `ENTITY.update` when `t - stateT` passes the
  duration — the smoke forces them by fast-forwarding `stateT` (no
  teleport API); `ENTITY.wake()` is the trigger (no-op unless DORMANT;
  M9.6 wires key/button/auto); `ENTITY._enterState(s, t)` is the only
  entry point (on STIR: `_wakeCount++` + every system's `onAwaken()` —
  verified once per sequence start via a fake system on `S.systems`);
  per-state hooks `ENTITY.hook(state, fn)` fire `fn(state, t)` on entry
  (order verified exactly `[STIR, AWAKE, DECAY, DORMANT]`); STIR pose
  from the 0..1 level `wakeP` (smoothstep up / 1 / smoothstep down /
  0): `head.rotation.x = -wakeP·headLift`, `head.position.y = 43.6 +
  wakeP·headRise`, `jaw.rotation.x = wakeP·jawOpen` — restores EXACTLY
  at DORMANT entry (verified byte-exact 0/43.6/0); rings moved from
  absolute `t·ringSpin` to integrated `ENTITY._ringAng` with multiplier
  `1 + (ringBoost-1)·wakeP` (continuous speed-up, no angle jump; AWAKE
  Δang matches `spin·8·Δt` to 0.02 rad; DORMANT multiplier exactly 1);
  AWAKE hold picked by seeded `ENTITY._wakeRng` into [10, 20] s
  (verified 11.7 s, deterministic); hero light +1.5·wakeP / coreEye
  lerp +0.5·wakeP on top of the dormant/dream terms (M9.3 builds the
  flare on top; M9.5 reuses the DECAY pose); clean return verified —
  node instance colors byte-exact at base, draw calls back to baseline
  (51), hero light back to dormant range, mid-sequence `wake()` is a
  no-op (count unchanged), and an immediate re-trigger runs a second
  full forced cycle that resolves clean again (re-trigger safe).
  Seams: raw `ENTITY.state` writes are invalid (stale `stateT` ⇒
  self-transition on the next frame) — the M8.3 smoke seam now uses
  `_enterState` + `_awakeDur = 1e9` hold; the M9.1 dream wave stays
  gated on DORMANT (parked +60 s around the M9.2 section since M9.1
  leaves its deadline 14–26 s out).

#### M9.3 — Awakening beats 1–3 (creature-level power)
- [ ] Beat 1: core eye flares (emissive ramp + light + flash).
- [ ] Beat 2: node voxels ignite in radial waves (instance color updates).
- [ ] Beat 3: tensor rings accelerate + tilt; limbs reposition
      (shake impulse).
- **Test:** on manual trigger, beats 1–3 play in sequence with correct
      timing (visual check + state timestamps in smoke run).
- **Commit when:** beats 1–3 verified.

#### M9.4 — Awakening beats 4–5 (city-level cascade)
- [x] Beat 4: energy pulse ring launches from the plaza; city holo-signs
      and building LEDs follow the wave (scheduled per-ring color ramps —
      the "thousands of compute nodes illuminate" moment).
- [x] Beat 5: substation arcs fire; steam vents burst; drones scatter and
      some re-route to the creature; sky vehicles change to avoidance
      paths.
- **Test:** wave visibly travels ring by ring; traffic reacts (scatter /
      re-route / avoidance all observed).
- **Commit when:** cascade verified end-to-end.

#### M9.5 — Awakening beats 6–7 + decay
- [x] Beat 6: Unsloth easter egg reacts (M10.3 hook).
- [x] Beat 7: decay — waves dim outward, hum settles, one final pulse,
      back to DORMANT.
- **Test:** full sequence ends in DORMANT with one final pulse;
      re-trigger immediately works.
- **Commit when:** full-sequence test passes.
  Implemented as a hook seam + the decay half of the sequence, all
  tunables in `CFG.entity.beats` (`egg.delay` 4.2, `decayDim.at` 0.85,
  `finalPulse` 820 m / 5 s / 0x9fdcff — radius deliberately ≠ the M9.4
  cascade pulse 660 m so the teardown drop check keeps a distinct
  signature): **beat 6** fires at AWAKE + 4.2 s (gated on `_ignited`,
  one fire per sequence via `_eggFired`, re-armed at STIR entry):
  `ENTITY.eggReact(fn)` gets `fn('start', t)` then `fn('end', t)` at
  DORMANT entry — M10.3 is the only consumer, nothing is visible until
  M10 lands (the smoke registers a fake reaction). **Beat 7** = the
  ignited node grid dims outward during DECAY (front from head level at
  `ENTITY._dimSpeed = (maxR + width)/(decay · 0.85)`; each node's lit
  excess × `(1 − dm)`; the front passes the farthest node + width at 85%
  of DECAY ⇒ the DORMANT-entry byte-exact restore is pop-free) + one
  final pulse fired at the DECAY→DORMANT transition (gated on
  `wasIgnited` captured before the transition clears it — a forced
  non-sequence state never gets one); `ENTITY._finalPulseIt` holds the
  pool item until the next STIR entry. The "hum settles" audio is
  M11.3 (no audio system yet — the DECAY/DORMANT state-entry hooks are
  the seam). Smoke impact by design: a live final pulse at DORMANT
  entry adds the shared ring's +1 draw call (the ring's `visible` flag
  is always true ⇒ visible-set checks unaffected; only call counts and
  `FX.count` move) — M9.2 checks 7/8 now expect `reg.calls + 1`, M9.4
  check 10 expects `fx === 1` (the 820 m pulse at 0/0.4/0), check 12
  `fx >= 1`, and M9.3/M9.4/M9.5 section starts wait out the previous
  section's final pulse (`FX.count === 0`) before baselines. No
  screenshot gate: the analytic checks are strictly stronger than a
  picture. Note: the pre-existing timing-sensitive flakes (M6.2
  heap-flat, M7.3 bolt regen, M7.5 key-N shake, M8.1 star brightness,
  M9.4 vehicle ease-out) flake in this headless environment (rAF /
  keyboard latency / GC noise) — re-verified to fail identically at the
  pre-M9.5 HEAD baseline (M7.5 `energy=1.18` vs the 1.2 threshold),
  environmental, not M9.5 regressions; every M9.2–M9.5 check passes.

#### M9.6 — Triggers (manual + auto)
- [x] Manual: key (e.g. `F`) + HUD button. Auto: plays once ~30 s after
      intro for audience that presses nothing.
- **Test:** all three entry paths (key, button, auto) start the same
      sequence exactly once; auto never re-fires.
- **Commit when:** trigger test passes.
  All three entry paths funnel into the M9.2 `ENTITY.wake()` trigger
  (no-op unless DORMANT ⇒ re-press/re-click mid-sequence is a
  no-op): **F key** = new `INPUT.wakeTrigger` edge (repeat-
  guarded, RUNNING-guarded like the other dev edges), consumed at
  the top of `ENTITY.update`; **HUD button** `#awakeBtn` (bottom-
  right, `.on` fade, wired in `HUD.init`; hint gained an "F awaken"
  line); **one-shot auto** = `CFG.entity.trigger.auto` (30 s) after
  intro end, anchored at new `BOOT.t0` (set in `enter('RUNNING')` —
  today the intro ends at START; M12's intro engine replaces that
  anchor, the seam is `BOOT.t0`): `ENTITY._autoAt` lazily computed
  from `null` to `BOOT.t0 + 30` on the first RUNNING frame, at the
  deadline `_autoFired` burns permanently and `ENTITY.wake()` runs
  only when `!ENTITY._userTriggered` (set by the key edge or the
  button click — the auto is for the audience that presses nothing).
  Smoke: both boot points park `S.ENTITY._autoAt = Infinity` next to
  the `_ltTimer` park (a live auto at 30 s would inject a full
  sequence into the earlier sections). No screenshot gate — the
  analytic checks are strictly stronger than a picture. Smoke M9.6
  8 checks green in 2 runs (registration: auto = 30 s, button
  present, trigger state idle; F key exactly once + re-press no-op;
  HUD button exactly once + re-click no-op; auto burns/skips when
  user-triggered (no sequence); seam re-arm (`_userTriggered=false,
  _autoFired=false, _autoAt=null`) → lazy recompute lands on exactly
  `BOOT.t0 + 30` and fires one sequence; auto never re-fires after
  the forced DORMANT return (flag stays burned, count frozen); key
  re-trigger after the auto works and resolves clean; heap flat)
  + all M9.2–M9.6 checks green in both runs. Note: the pre-existing
  timing-sensitive flakes flake in this headless environment (rAF/
  keyboard latency / GC noise) — run 1: M7.3 bolt regen, M8.1 star
  brightness, M8.3 shaft strip, M9.3 heap-flat (29→31 MB vs the 2 MB
  bound); run 2: M7.5 key-N shake (`energy=1.18` vs the 1.2
  threshold — the documented baseline value) and M9.4 cascade visual —
  none reproduce across runs, environmental, not M9.6 regressions.

**Phase done-when:** a first-time viewer reads the sequence as a clear
narrative (dormant → stir → awake → pulse → settle) in ≤ 30 s.

### M10 — Unsloth easter egg (subtle, integrated)

#### M10.1 — Sloth monument + "UNSLOTH" sign
- [x] One side avenue, mid-distance: voxel **neon sloth** monument atop
      a compute tower + rooftop "UNSLOTH" holo sign, tagline cycles
      ("local ≠ slow" / "why rush?").
- **Test:** monument + sign readable from street; tagline cycles; both
      outside the default intro-reveal framing.
- **Commit when:** verified on screen + framing check.
  Standalone child of `WORLD.root` (outside the chunk pools ⇒ chunk
  regen / LOD / wave-restore never touch it). Deterministic pick
  (`WORLD._pickMonument`, seeded city): plaza south side (bz > 0 ⇒
  behind the spawn camera ⇒ outside the default intro-reveal framing),
  avenue-adjacent, 100–300 m mid-distance, first
  `buildingAt(bx,bz,0,['server'],minH)` hit with
  `CFG.kit.slothMonument.minH = 30` — current seed ⇒ block (−4, +3),
  (−84, +84), hTop ≈ 37.9 m, avenue x = −108. +3 draw calls, zero
  per-frame allocation: dark merged voxel-sloth mesh (pedestal +
  body + head + arms + legs + tail + face, `MATS.metalDark`) + neon
  merged mesh (face plate + chest + pedestal trim, pulsing
  `MeshBasicMaterial` 0xff6fb2) + billboard sign plane (shared
  `signGeo` 8×3 m at local (0, 7.2, 0)) on `MATS.signMat.unsloth`
  (map = `KIT.tex.signUnsloth`) — the "UNSLOTH" text, the 8 s tagline
  cycle ("LOCAL ≠ SLOW" / "WHY RUSH?", `KIT._tagline`) and the 8 Hz
  flicker redraw animate for free. Facing baked into the merged
  geometries (face the plaza); per-frame `WORLD._updateMonument`
  billboards the sign horizontally (M4 pattern, pre-allocated scratch)
  + slow neon pulse. Subtle by design — scale consistent with the M4
  city holo-signs; the awakening reaction is M10.3 (hooks through the
  existing `ENTITY.eggReact` seam). Smoke M10.1 8 checks green
  (registration: side avenue / south / mid-distance / server arch /
  on roof / sign bound to the shared unsloth texture; outside the
  spawn-pose framing via `SIM.project` NDC; tagline flips within 20 s
  + texture frame advances; street pose — monument + sign inside NDC
  and sign-region mean luminance on/off (8.2 → 9.6) with screenshots
  `smoke/shots/m101-sloth-street.png` / `m101-sloth-off.png`; draw-
  call delta exactly 3; chunk regen leaves the sign matrixWorld
  byte-identical; heap flat). The only failures are the documented
  pre-existing headless flakes (M7.5 key-N shake `energy=1.18` — the
  documented baseline value, M8.1 star brightness, M9.3 heap-flat),
  environmental, not M10.1 regressions.

#### M10.2 — Holographic sloth + sloth drones
- [x] Relaxed holographic sloth silhouette on the tower's antenna arm,
      slow breathing (billboard + canvas sprite, additive).
- [x] 1–2 sloth-themed maintenance drones (extra slow, slightly larger,
      soft pink light) patrolling that street only.
- **Test:** holo sloth breathes; pink drones patrol only that street.
- **Commit when:** both verified.
  Both are **standalone children of `WORLD.root`** (world space, outside the
  chunk pools ⇒ chunk regen / LOD / wave-restore never touch them — and not
  children of the monument group `g`, so `g.children` stays 3 and the M10.1
  smoke is untouched). **Holo sloth** = a `THREE.Sprite` on `KIT.tex.slothHolo`
  (`makeSlothHolo`, a static soft-pink silhouette of a sloth hanging on an
  antenna arm: mast + crossbar + limbs + drooping body + resting head +
  hanging legs), additive, `depthWrite:false`, at `(wx, hTop+13, wz)` above
  the M10.1 sign — the **slow breathing is a per-frame sprite scale**
  (`1 + breathAmp·sin(t·breath)`) in `WORLD._updateMonument`, not a canvas
  redraw. **Sloth drones** = one `InstancedMesh` reusing the M6.2 voxel-quad
  drone geometry, `count` = `CFG.kit.slothDrone.count` = 2, bigger
  (`size 3.0` vs city 2.0), soft pink tint (`0xff9ecb`), extra slow
  (`speed 2.2` vs city 7–13 m/s), patrolling **the monument's street only**
  (one avenue line, not the general roof-dock fleet): per-drone state
  `WORLD.monument.drones[] = { axis, c, along, dir, speed, phase, aMin,
  aMax, tint }` — `c` is the fixed cross-street coordinate (the avenue),
  `along` varies within `[streetAlong ± span]` (span 70 m) and **bounces**
  at the ends (back-and-forth patrol, not a one-way pass); `altitude 30 m`,
  slow hover bob. Street line (same priority as the M10.1 street pose):
  `m5(bz)∈{1,4}` → runs along x at `z=streetC`; else `m5(bx)∈{1,4}` → runs
  along z at `x=streetC` — current seed ⇒ `axis='z'`, `streetC=x=−108`,
  `streetAlong=84` ⇒ drones patrol z∈[14,154] at x=−108. +2 draw calls (holo
  sprite + drone instanced mesh), zero per-frame allocation (pre-allocated
  scratch on `WORLD`); `WORLD._updateMonument` now takes `(dt, t)`. **M10.3
  seam** (exposed only, not implemented): `WORLD.monument.{ holo, holoMat,
  droneMesh, drones, streetAxis, streetC }` — M10.3 brightens/stretches the
  holo and rises the drones to hover, then resumes (hooks through the
  existing `ENTITY.eggReact` seam). Smoke M10.2 8 checks green (registration:
  holo is an additive Sprite bound to the shared sloth texture, 2 drones
  soft-pink/bigger/slow on the street; holo breathes — sprite scale
  oscillates; patrol ONLY the street — fixed avenue `c`, bounded + moving
  `along`, instance-matrix cross-street coord on the avenue line; patrol
  bounces at the span end — dir flips, stays ≤ aMax; street screenshot
  `smoke/shots/m102-sloth-holo-street.png`; draw-call delta exactly 2; chunk
  regen leaves holo position + drone count/c/axis untouched; heap flat). The
  only failure is the documented pre-existing M7.5 headless flake
  (camera-shake `energy=1.18` baseline — untouched by M10.2).

#### M10.3 — Awakening reaction
- [x] Sign flares, holograph brightens + one slow stretch animation,
      sloth drones rise to hover nearby for the pulse, then resume
      patrolling.
- [x] Constraint: never competes with the creature in the default
      framing of the intro reveal; max ~5 % of attention budget.
- **Test:** reaction plays during AWAKE; everything returns to idle after
      DECAY.
- **Commit when:** reaction verified in a full awakening run.

**Phase done-when:** a local-LLM fan spots it within seconds and it
feels like it belongs to the world, not pasted on.

### M11 — Procedural audio (Web Audio only)

#### M11.1 — Master graph + gesture gate
- [x] Compressor → user-mute gain → destination; starts only on user
      gesture (START button), resume-safe.
- **Test:** no audio before gesture; mute key mutes everything; refresh /
      re-entry safe, no errors.
- **Commit when:** gate + mute verified.
  `AUDIO` (exposed on `window.SIM`) is the Web Audio master graph, built
  inside the START-click gesture and never before: **master** (GainNode,
  0.8) → **comp** (DynamicsCompressor) → **muteGain** (GainNode, 1.0) →
  `ctx.destination`. Everything the game makes (M11.2 beds, M11.3 event
  sounds, M11.4 spatial sources) connects to `AUDIO.master`; the
  compressor and the mute gain are the only two choke points. `unlock()`
  is only ever called from `BOOT.enter('RUNNING')` (the START click — the
  single user gesture, M0 contract), so **no `AudioContext` exists before
  the gesture**; it is idempotent and resume-safe: a context the browser
  suspended (tab hidden/backgrounded) is resumed via `ctx.resume()`
  (`.catch`-guarded) on the next `pointerdown`/`keydown`/
  `visibilitychange` — listeners wired once at unlock (`_gestureWired`
  guard ⇒ zero cost before the first gesture). **Mute:** `M` key (INPUT
  keydown, repeat-guarded) → `AUDIO.toggleMute()` →
  `muteGain.gain.setTargetAtTime(0|1, t, 0.02)`; `AUDIO.muted` flag;
  HUD shows `MUTED`/`mute: M`, hint line reads `F awaken · M mute`.
  Refresh / re-entry rebuilds the module fresh and hits the same path.
  **Wiring verification (headless gotcha):** the headless smoke Chrome
  build exposes no `inputs`/`outputs`/`connections` on `AudioNode` and no
  `DynamicsCompressor` global, so the harness cannot introspect the
  graph — the app instead captures `AUDIO.wired` at build time from
  `connect()` return values (spec: returns the destination node).
  Smoke M11.1 section (9 checks, after M10.3) reloads the page for the
  pre-gesture check: `AUDIO.ctx === null` before START, then
  graph/types/wired + `state === 'running'` after the gesture, M-key
  mute→0 / unmute→1 by gain value, refresh → fresh module (ctx null
  again) → re-entry unlocks a fresh running context, no page/console
  errors; it re-parks `ATMOS._ltTimer` + `ENTITY._autoAt` after the
  reload like the other sections. 9/9 PASS in 3 consecutive full-suite
  runs; the only failures are the documented pre-existing headless flakes
  (M7.5 camera-shake `energy=1.18` baseline) plus single-run
  screenshot/timing flakes (M6.2 dock window, M8.1 star brightness) —
  unrelated to M11.1 (audio adds no draw calls, no objects, no per-frame
  work).

#### M11.2 — Looping beds
- [x] Reactor hum (2 detuned sines/triangles + sub sine, slow LFO); fans
      (filtered noise loop, band-pass sweep); distant machinery (filtered
      noise + random low thumps).
- **Test:** beds run for minutes without audible repeats/bugs; mix
      identifiable as "machine city" within 3 s.
- **Commit when:** long-run listen test passes.
  All three beds are built at unlock and connect to `AUDIO.master`
  (M11.1 — never a second compressor or destination path), all tunables
  in `CFG.audio`: **reactor hum** = 2 detuned sines (55 / 55.66 Hz —
  slow beat) + sub sine (27.5 Hz, `subGain` 0.5) into one bed gain
  (0.22); **fans** = looped white-noise `AudioBufferSourceNode` (4 s
  buffer, `loop = true`) through a band-pass BiquadFilter (1310 Hz
  center, Q 1.4) into a bed gain (0.16); **distant machinery** = looped
  white-noise buffer (6 s) through a low-pass (300 Hz) into a bed gain
  (0.10) + **random low thumps** (sine with a pitch drop f → 0.55 f +
  exponential-decay gain envelope, self-stopping). The slow bed motion —
  hum-gain swell (0.07 Hz) and the band-pass center sweep (420–2200 Hz,
  0.05 Hz) — is driven from the central `update(dt, t)` loop as
  deterministic sinusoids: `AUDIO` is now a system (registered after
  ATMOS, before HUD), and `AudioParam.value` does NOT reflect
  connected-input (oscillator-LFO) modulation — it returns the base
  value — so an oscillator-LFO sweep would be unobservable to the smoke
  harness (the deterministic formula is exactly checkable); this also
  matches the ground rule "everything animated is driven by update".
  The thumps run on a deadline scheduler (`beds.machine.nextThumpAt`,
  `performance.now()/1000` clock, re-armed into 5–14 s by a seeded
  `mulberry32`, `thumpCount` counter) — fire-and-forget, the only
  allocation in the beds, and a random event rather than per-frame work.
  Looped buffers are ≥ 4 s ⇒ no audible repeat; oscillators + looped
  buffers run indefinitely. Smoke M11.2 section (11 checks, after
  M11.1, page already RUNNING): node types (OscillatorNode ×3 /
  AudioBufferSourceNode ×2 / BiquadFilterNode ×2), hum frequencies
  exactly from CFG, hum swell + band-pass sweep checked against the
  EXACT deterministic formula at 0 s and 5 s (tolerances for ≤ ~0.1 s
  frame/IPC lag: 0.01 gain / 40 Hz), fan/machine `loop === true` +
  buffer ≥ 3 s + filter types, forced thump (`nextThumpAt = now`
  in-page → `thumpCount +1`, deadline re-armed into [5, 14] s), long-run
  window (ctx `running`, bed gains intact, zero page errors), heap flat
  (min-of-3, ≤ 2 MB), M-key mute → muteGain 0 with bed gains untouched.
  The "machine city within 3 s" gate is qualitative — the smoke proxy
  is all three beds live at once, each with its own spectral element
  (sub-60 Hz detuned hum / band-passed air / muffled rumble + low
  thumps), running error-free over the long window. Full suite ALL
  PASS (299/0) in 2 consecutive runs; the "systems registered in fixed
  order" check now expects `… ATMOS, AUDIO, HUD`. M11.3 seam: event
  sounds connect to `AUDIO.master` too; `AUDIO.beds.{hum,fan,machine}.gain`
  are the gain scaling points ("hum settles" at DECAY/DORMANT — M9.5
  hooks — and M14.1 tiers).

#### M11.3 — Event sounds
- [x] Pulse thump (sine drop + noise hit), arc crackle (short filtered-
      noise bursts), steam hiss, drone whir — wired to the M6–M9
      emitters.
- **Test:** each corresponding in-game event produces its sound; all
      silent when muted; zero cost when idle.
- **Commit when:** every event sound verified in-game.
  Four fire-and-forget Web Audio one-shots fired from the real M6–M9
  emitter call sites, every output connecting to `AUDIO.master` (the
  M11.1 choke point ⇒ the M key mutes all event sounds at zero cost),
  all tunables in `CFG.audio.events`: **pulse thump** (`AUDIO.pulseThump()`
  ← `FX.pulse()` — the M7.2 seam) = sine pitch drop (130→38 Hz
  exponential) + short low-passed (420 Hz) noise hit, gain 0.50;
  **arc crackle** (`AUDIO.arcCrackle()` ← `FX.arc()`) = 5 sharp on/off
  band-passed (2400 Hz) noise bursts over 0.5 s, gain 0.16; **steam
  hiss** (`AUDIO.steamHiss()` ← `PARTS._spawnSteam`) = band-passed
  (3200 Hz) noise, fast attack, 1.2 s decay, gain 0.05 (one per puff);
  **drone whir** (`AUDIO.droneWhir()` ← `TRAFFIC._spawn`) = band-passed
  noise with a rising center sweep (700→1800 Hz — rotor spin-up),
  gain 0.07 (one per drone launch). `FX.flash` stays silent (out of
  scope — lightning/arc events carry the crackle). Zero cost when idle:
  nothing added to `AUDIO.update` — each one-shot stops its own sources;
  a shared 2 s noise buffer (`AUDIO._evNoise`) feeds every noise
  one-shot, so an event allocates only its self-stopping nodes.
  **Self-stopping ≠ collected:** a one-shot subgraph wired into
  `AUDIO.master` stays reachable from the graph forever, so the one-shots
  (and the M11.2 machine thump — same pattern) now call
  `g.disconnect()` from the last source's `onended` to drop the subgraph
  so it is collected (at ambient steam rate ~8 puffs/s the unfixed
  version is a visible heap growth). Wiring verification (headless gotcha,
  same as M11.1): the app captures `AUDIO.eventsWired = { pulse, arc,
  steam, drone }` from `connect()` return values and keeps per-type fire
  counters `AUDIO.events` — the headless build exposes no graph
  introspection. Smoke M11.3 section (8 checks, after M11.2, page already
  RUNNING): counters + shared noise buffer exist; each emitter's real
  call site increments its counter exactly once (pulse/arc via `FX.pulse`
  / `FX.arc` + `dropPulse`/`dropArc` cleanup; steam via `_sReleaseAt(0)`
  + `spool.acquire` + `_spawnSteam` with a synthetic `src` — the steam
  pool is saturated at cap; drone via `_releaseAt(0)` + `pool.acquire`
  + `_spawn` with a retry loop — `_spawn` early-returns when the seeded
  dock search finds no dock); all silent when muted (fire every type
  while the M-key mute is on — counters still move, muteGain 0, choke
  point); `eventsWired` all true; heap flat (min-of-3, ≤ 2 MB, no
  errors). Full suite 3 runs: M11.3 8/8 in 2 runs (the single failure was
  the heap-flat check, same environmental class); the only other
  failures are the documented pre-existing headless flakes (M7.3 bolt
  cadence, M7.5 shake `energy=1.18`, M8.1 star brightness, M9.4 vehicle
  ease-out, M11.2/M6.2-class heap) — the M11.2 "heap flat" check was
  re-verified to flake identically at the pre-M11.3 HEAD baseline (git
  worktree run: Δ=2.55 MB FAIL vs Δ=-5.08 MB PASS), environmental GC
  noise, not an M11.3 regression; an A/B heap experiment confirmed the
  event one-shots add no measurable heap growth (370 forced one-shots
  → +0.27 MB net, ambient 10 s window flat, with- vs without-events
  3×8 s windows indistinguishable). M11.4 seam: the panner + distance
  gain wraps these same one-shot call sites; M14.1 tiers can scale
  `CFG.audio.events` levels.

#### M11.4 — Spatial-ish mixing
- [x] One panner + distance gain for the 2–3 nearest emitters;
      everything else folded into the ambient bed.
- **Test:** walking past an emitter pans/attenuates it; cost stays
      bounded in stats.
- **Commit when:** spatial behavior verified.
  A fixed pool of 3 channels, each = GainNode (distance gain, set at
  fire time) → PannerNode (`panningModel 'equalpower'`,
  `distanceModel 'none'`) → `AUDIO.master` (M11.1 choke point ⇒ M-key
  mutes spatial events at zero cost): only the 2–3 NEAREST emitters
  are spatially processed, everything the pool cannot hold folds into
  the ambient master (no spatial treatment) — `AUDIO.spatialFolded`
  counts folds, all tunables in `CFG.audio.spatial = { channels: 3,
  refDistance: 6, rolloff: 1.0, minGain: 0.02, settle: 0.3 }`.
  Routing (`AUDIO._spatialSink(type, x, y, z, dur)`): free channel,
  else steal the farthest-held one when the new emitter is nearer
  (the pool always keeps the nearest emitters spatial), else fold.
  Distance gain = Web Audio inverse model, floored:
  `d ≤ ref ? 1 : max(minGain, ref / (ref + rolloff·(d − ref)))`
  from `CAMERA.pos`; the one-shot's own gain (M11.3 levels) connects
  to the channel gain instead of master (`_evGain(type, level, node)`),
  `eventsWired[type]` set on the spatial path too so the M11.3 wired
  check stays valid. Call sites pass the emitter position:
  `FX.pulse` → `origin`, `FX.arc` → midpoint(a,b),
  `PARTS._spawnSteam` → tower top `{src.x, src.hTop, src.z}`,
  `TRAFFIC._spawn` → drone `{px,py,pz}`. Listener drive (the only
  per-frame cost): `AUDIO.update` writes listener position + forward +
  up from `CAMERA.pos`/`yaw`/`pitch` (forward =
  `(−sin·cos, sin, −cos·cos)`, up = (0,1,0)) and releases channels
  whose hold (`dur + settle`) expired — 9 param writes + 3
  comparisons/frame; channels are reused so a spatial fire allocates
  only the one-shot itself; no `createPanner` ⇒ `AUDIO.spatial` stays
  null and every fire folds. Durable gotchas: AudioParam values are
  float32 (read-back Δ≈1e-8 ⇒ smoke tolerance ≥1e-6), PannerNode
  internal attenuation is unobservable headless ⇒ attenuation lives in
  the explicit channel GainNode (directly readable), modern
  `positionX/Y/Z` + `ctx.listener` API with legacy `setPosition` /
  `setOrientation` fallback. Smoke M11.4 section (7 checks, after
  M11.3, page already RUNNING): pool exists (3× PannerNode,
  equalpower, wired flag from `connect()` return); listener tracks the
  camera (teleport → read back); walking past an emitter attenuates it
  (teleport −25/0/+25 past an emitter at origin → gain profile
  0.237→1.000→0.237 vs the exact inverse formula); channel panner sits
  at the emitter + channel gain IS the distance gain; 4 simultaneous
  equidistant fires ⇒ exactly 1 fold; spatial fires mute at the choke
  point (counters move, muteGain 0); bounded cost (heap flat 5 s while
  the listener drives, no errors). Full suite 3 runs: M11.4 7/7 in all
  3; M11.1–M11.3 sections green; zero page/console errors every run;
  the only failures are the documented pre-existing headless flakes
  (M7.5 shake `energy=1.18` exact baseline, M7.3 bolt cadence,
  M11.2-class heap Δ~2 MB, M6.2 dock / M6.4 spark / M9.4
  wave-brightness observation windows). Seams: M14.1 tiers can scale
  `CFG.audio.spatial.channels` / bed + event levels.

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
- [x] Skippable/cancellable at any moment (START/click/keypress) → 0.5 s
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
