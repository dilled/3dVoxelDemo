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

| Phase | Scope | Gate |
|---|---|---|
| **M0** ✅ | Single-file scaffold: full-screen canvas, Three.js via CDN, scene/renderer/camera, `BOOT` state machine with START button + audio gate, FPS counter | START always leads to a live 60 fps loop; page refresh never leaves a stuck state |
| **M1** ✅ | Core loop: fixed-order `systems` registry + `update(dt)`, `INPUT` (WASD/ZQSD, pointer-lock mouse look, wheel zoom, middle-mouse orbit, gamepad), `CAMERA` ground/cinematic modes with shake API | Fly around an empty dark void in both cameras; gamepad works; nothing throws without one |
| **M2** ✅ | Procedural voxel material kit: shared materials, canvas-texture helpers (LED grid, holo signs, glow sprites), instanced box/cylinder + merged-geometry builders, lighting rig | Kit renders a test wall/tower with animated LED faces and signs at < 10 draw calls |
| **M3** | Chunked city generation (far layer): seeded PRNG, city grid, 16×16 block chunks generated/unbuilt around player, weighted archetypes, 3-ring distance LOD | City extends beyond initial view, no visible duplication, draw calls flat as you fly out |
| **M4** | Building detail passes (near layer): per-archetype details (server racks, cooling towers, substations, antennas, fiber spires, holo signs), per-building seeded variation, zone haze | Every archetype readable from 50–200 m and procedurally varied; FPS within target |
| **M5** | The Qwen machine-creature (dormant): plaza pedestal, full creature build from primitives, named rig parts, dormant breathing/idle state, instanced compute-node voxels | Reads as "dormant colossal machine" from street level; silhouette holds from 3 camera distances |
| **M6** | Traffic & ambient life (pooled): object pools, maintenance drones, sky vehicles with light trails, steam/spark emitters, FPS-tier adaptive caps | City feels inhabited; caps never exceed tier; pools never allocate per frame |
| **M7** | Particle & FX system: pooled points/sprites, `FX.pulse`, animated electrical arcs, screen-space flash, impulse camera shake | Each effect has a manual trigger key and costs nothing while idle |
| **M8** | Atmosphere: night sky dome, stars, aurora, zone-tinted fog, volumetric-ish light shafts, distant lightning events | Depth and mood readable from street level; lightning event visible from inside the city |
| **M9** | Creature animation & awakening sequence: dormant animation, DORMANT→STIR→AWAKE→DECAY state machine, full awakening beats (flare, node ignition, pulse wave, arcs, easter-egg hook, decay), manual + auto trigger | First-time viewer reads the narrative (dormant → stir → awake → pulse → settle) in ≤ 30 s |
| **M10** | Unsloth easter egg: voxel neon sloth monument + "UNSLOTH" holo sign, holographic sloth, sloth-themed drones, awakening reaction, ≤ 5 % attention budget | A local-LLM fan spots it within seconds and it feels like it belongs to the world |
| **M11** | Procedural audio (WebAudio only): master graph, looping beds (hum/fans/machinery), event sounds, distance-ish spatial mixing, gesture-gated start | Muting costs nothing; mix identifiable as "machine city" within 3 seconds |
| **M12** | Intro cinematic: corridor rush → city reveal → low orbit → title card → drop to street, fully skippable/cancellable at any point | Intro finishes, skips, or is interrupted — all paths end in a controllable camera, zero console errors |
| **M13** | Emergent event director: weighted scheduler with cooldowns, ambient events (data pulse, power cycle, cooling emergency, drone launch, mechanical reposition, EM discharge), awakening-compatible | 3 minutes of idle play shows ≥ 4 different events, none conflicting, none breaking perf |
| **M14** | Performance, quality tiers, polish: FPS monitor + HIGH/MED/LOW tiers, structural culling verified, HUD stats, polish pass, robustness pass (refresh/tab-hide/resize/gamepad), 3-min recorded verification run | Stable frame rate through the awakening sequence at default quality on a modern gaming GPU |

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

### M3 — Chunked city generation (far layer)
- [ ] Seeded PRNG (mulberry32), city grid: blocks, avenues, height falloff
      around the central plaza, ring roads.
- [ ] Chunk = 16×16 block grid; generate on demand around player,
      unbuild behind; simple per-chunk budget (density by distance ring).
- [ ] Building archetype picker with weights by zone:
      server tower, rack slab, cooling tower, substation, antenna farm,
      fiber conduit spire, holo-sign tower, residential-ish data housing.
- [ ] Distance LOD: 3 rings (dense / mid / silhouetted-boxes + haze color).
- **Done-when:** city extends well beyond initial view, no visible
  duplication, draw calls stay flat as you fly further out.

### M4 — Building detail passes (near layer)
- [ ] Per-archetype detail builders on top of the M3 mass:
      - server racks: LED windows, front doors, cable trays, roof vents
      - cooling towers: big animated fans (shared rotating instanced
        blades), steam emitters (M7 particles), pipes between towers
      - substations: transformer boxes, insulators, spark points
      - antennas: masts, dishes (slow scan), blinking beacons
      - fiber spires: glowing conduit bands with animated UV/texture offset
        or scrolling emissive dash instances (light traveling in cable)
      - holo-sign towers: animated canvas texture + additive billboard
- [ ] Detail level by ring; nearest ring gets unique per-building variation
      (seeded per-building salt → not duplicated neighbors).
- [ ] Distant haze: fog + per-chunk far-ring color grading to city haze.
- **Done-when:** standing in the city, every archetype is readable from
  50–200 m and looks procedurally varied; FPS within target.

### M5 — The Qwen machine-creature (dormant)
- [ ] Central plaza: darkened mega-core pedestal, creature ~ several
      buildings tall, built from: server-tower torso, cooling-tower
      shoulders, glowing compute-core head/face, mechanical limbs,
      antennas, rotating tensor torus rings (idle: almost still, dim).
- [ ] Named rig parts with transform roots so M9 can animate them
      (`head`, `jaw`, `coreEye`, `ringA..C`, `armL/R`, `spine`, `antenna*`).
- [ ] Dormant state: slow breathing scale on the core, 1 % dim LEDs,
      minimal particle drip (steam), faint heartbeat audio (M11).
- [ ] Thousands of compute-node voxels (single InstancedMesh, per-instance
      color + emissive via color) arranged on torso/rings — the nodes that
      will ignite at awakening.
- **Done-when:** the creature reads as "dormant colossal machine" from
      street level; silhouette holds from 3 camera distances.

### M6 — Traffic & ambient life (pooled)
- [ ] Object pools: drones, sky vehicles, steam puffs, sparks, cable
      packets (glowing dots traveling on conduit paths — precomputed
      Catmull-Rom lines between towers).
- [ ] Maintenance drones (small voxel quads): patrol routes between
      towers, dock at roof bays; cap by distance to player and FPS tier.
- [ ] Sky vehicles: light trails (additive sprite streak) on ring roads at
      3 altitudes; cap similarly.
- [ ] Steam vents from cooling towers (billboard sprite pool, upward drift,
      fade); sparks from substations (tiny points, brief life).
- [ ] Adaptive caps: `TRAFFIC` reads current FPS tier, scales pool sizes.
- **Done-when:** city feels inhabited; killing perf budget never spawns more
  than the tier allows; pools never allocate per frame.

### M7 — Particle & FX system
- [ ] One pooled `Points`/sprite system: steam, sparks, pulse motes,
      lightning motes, rain-of-energy (awakening).
- [ ] `FX.pulse(origin, radius, color)` — expanding ring of light:
      instanced ring mesh + light-intensity ramp + audio thump.
- [ ] Animated electrical arcs: Line segments regenerated every N frames
      between anchor points (substation → substation, creature → ring).
- [ ] Screen-space flash: full-screen additive plane in a small overlay
      scene (or DOM div) driven by `FX.flash(intensity)`.
- [ ] Camera shake: impulse-decay system consumed by `CAMERA`.
- **Done-when:** each effect has a manual trigger key (dev) and costs
      nothing while idle.

### M8 — Atmosphere: night, fog, sky, light shafts
- [ ] Night sky: gradient sky dome (shader or big sphere with canvas
      texture), stars, faint aurora band.
- [ ] Fog tuned for depth; city haze tinted by zone (cyan core / warm
      avenues) via fog color lerp.
- [ ] Volumetric-ish light shafts: a few additive cone/cylinder meshes
      from key spires and the creature core (only when near or during
      awakening).
- [ ] Distant lightning: random far point + brief hemi intensity bump +
      flash; electromagnetic discharge rings visible across the city.
- **Done-when:** depth and mood are readable from street level; lightning
      event is visible from inside the city.

### M9 — Creature animation & awakening sequence (the climax)
- [ ] Idle/dormant animation: slow tensor-ring rotation, antenna sway,
      breathing core, occasional "dream" LED wave across the node grid
      (shader-less: animate instance colors in waves).
- [ ] Wake state machine: DORMANT → STIR (2 s: head lift, jaw, rings speed
      up, hum rises) → AWAKE (10–20 s: full power) → DECAY → DORMANT.
- [ ] Awakening beats, each with audio + FX:
      1. Core eye flares (emissive ramp + light + flash)
      2. Node voxels ignite in radial waves (instance color updates)
      3. Tensor rings accelerate + tilt; limbs reposition (shake impulse)
      4. Energy pulse ring launches from the plaza; city holo-signs and
         building LEDs follow the wave (scheduled per-ring color ramps —
         this is the "thousands of compute nodes illuminate")
      5. Substation arcs fire; steam vents burst; drones scatter and some
         re-route to the creature; sky vehicles change to avoidance paths
      6. Unsloth easter egg reacts (M10)
      7. Decay: waves dim outward, hum settles, one final pulse.
- [ ] Manual trigger: key (e.g. `F`) + HUD button; also auto-plays once
      ~30 s after intro for audience that doesn't press anything.
- **Done-when:** a first-time viewer reads the sequence as a clear
  narrative (dormant → stir → awake → pulse → settle) in ≤ 30 s.

### M10 — Unsloth easter egg (subtle, integrated)
- [ ] Location: one side avenue, mid-distance — a voxel **neon sloth**
      monument atop a compute tower + a rooftop "UNSLOTH" holo sign whose
      tagline cycles ("local ≠ slow" / "why rush?").
- [ ] A relaxed holographic sloth silhouette sits on the tower's antenna
      arm, slowly breathing (billboard + canvas sprite, additive).
- [ ] 1–2 sloth-themed maintenance drones (extra slow, slightly larger,
      soft pink light) patrol that street only.
- [ ] Awakening reaction: sign flares, holograph brightens + does one slow
      stretch animation, sloth drones rise to hover nearby for the pulse,
      then resume patrolling.
- [ ] Constraint: never competes with the creature in the default
      framing of the intro reveal; max ~5 % of attention budget.
- **Done-when:** a local-LLM fan spots it within seconds and it feels
  like it belongs to the world, not pasted on.

### M11 — Procedural audio (Web Audio only)
- [ ] Master graph: compressor → gain (user mute) → destination.
- [ ] Beds (looping, cheap):
      - reactor hum: 2 detuned sines/triangles + sub sine, slow LFO
      - fans: filtered noise loop, band-pass sweep
      - distant machinery: filtered noise + random low thumps
- [ ] Events: pulse thump (sine drop + noise hit), arc crackle (short
      bursts of filtered noise), steam hiss, drone whirproximity (single
      gain node panned by simple distance/angle).
- [ ] Spatial-ish: one panner + distance gain for 2–3 nearest emitters;
      everything else mixed into the ambient bed.
- [ ] Starts only on user gesture (START button) — resume-safe.
- **Done-when:** muting CPU audio costs nothing, and the mix is
      identifiable as "machine city" within 3 seconds of audio.

### M12 — Intro cinematic
- [ ] Sequence (~12–15 s, skippable at any moment, START always visible
      after 2 s):
      1. Dark server corridor: near-black tunnel of LED strips rushing
         by (procedural instanced wall + camera dolly)
      2. Corridor opens → wide reveal dolly out over the city
      3. Low orbit around the dormant creature (1.5 orbits)
      4. Title card: `QWEN FLASH // AWAKENING` (DOM overlay, fades)
      5. Lerp into player position at street level → gameplay.
- [ ] Robustness: intro is a timeline of camera keyframes only —
      pressing START/click/keypress at any point cancels it and drops
      the camera to the street position with a 0.5 s fade; intro cannot
      block the play state; no async resources in the timeline.
- **Done-when:** intro finishes, skips, or is interrupted by clicking —
  all three paths end in a controllable camera, zero console errors.

### M13 — Emergent event director
- [ ] Scheduler (weighted, cooldowns, min/max gap) firing ambient events:
      - data pulse: light dot travels between two towers along a conduit
        path, both ends flash (uses M7 cables)
      - section power cycle: one ring chunk dims/brightens over 3–6 s
        (per-chunk material color multiplier — cheap)
      - cooling emergency: one cooling tower fans spin up, steam burst,
        warning LEDs, drones dispatch, 20 s, resolves
      - drone launch: a roof bay opens (animated panel), 2–4 drones fly
        to patrol
      - mechanical reposition: one giant fan/antenna/ring moves slowly
        with rumble audio + tiny shake
      - distant EM discharge: lightning far off + a few arcs in the city
- [ ] Events are independent of, and compatible with, the awakening
  sequence (during AWAKE only creature-priority events may fire).
- **Done-when:** 3 minutes of idle play shows at least 4 different
  events, none conflicting, none breaking perf.

### M14 — Performance, quality tiers, polish pass
- [ ] Perf monitor: rolling FPS; tiers `HIGH / MED / LOW` (auto + manual).
      Tiers scale: far-chunk LOD radius, particle caps, drone/vehicle
      counts, holo-sign texture updates, light shafts, audio beds.
- [ ] Frustum + ring culling already structural; verify with stats.
- [ ] HUD (small, corner, toggleable): FPS, visible instances, active
      drones, chunk id, AI state.
- [ ] Polish: camera shake tuning, flash tuning, title fade, mute key
      (`M`), help overlay (`H`), vignette via cheap DOM gradient.
- [ ] Final pass: page refresh mid-game, tab-hide/resume (dt clamp),
      window resize mid-awakening, gamepad plug/unplug — no errors,
      no stuck states.
- [ ] Manual 3-minute screen-recording run to verify the "wow" beats:
      intro → reveal → idle life → manual awakening → easter egg reaction.
- **Done-when:** on a modern gaming GPU the whole thing runs at a stable
  frame rate through the awakening sequence at default quality.

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
