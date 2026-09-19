---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-19T10:50:17"
---

# Roadmap

Full per-milestone scope/gates live in `PLAN.md` (M0–M14, single-file demo "QWEN FLASH // AWAKENING"). Status: **M0–M12.1 done and smoke-verified headless** — M12.1 intro cinematic engine: camera-keyframe timeline runner + beat-1 dark server corridor (procedural 4-draw-call LED tunnel, dolly, handoff to street spawn) ([[m121-intro-timeline-runner]]); M11.4 spatial-ish mixing (3-channel panner pool, nearest emitters spatial, overflow folds to ambient master) ([[m114-spatial-mixing]]); M11.3 event sounds (pulse thump / arc crackle / steam hiss / drone whir, fire-and-forget one-shots on the M6–M9 emitter call sites) ([[m113-event-sounds]]); M11.2 looping beds (hum / fans / machinery, deterministic update-driven motion + random low thumps) ([[m112-looping-beds]]); M11.1 audio master graph + gesture gate + M-key mute ([[m111-audio-master-graph]]); M10.3 awakening reaction ([[m103-awakening-reaction]]); M10.2 holo-sloth hologram + street-only sloth drones ([[m102-holo-sloth-drones]]); M10.1 unsloth monument + UNSLOTH sign ([[m101-sloth-monument]]); M9 awakening sequence ([[m92-wake-state-machine]], [[m94-city-cascade]], [[m95-awakening-decay]], [[m96-wake-triggers]]); M8 atmosphere ([[m81-night-sky]], [[m82-fog-zone-tint]], [[m83-light-shafts]], [[m84-distant-lightning]]); M7 particles + FX ([[m71-parts-particle-system]], [[m72-fx-pulse]], [[m73-fx-arcs]], [[m74-fx-flash]], [[m75-camera-shake]]); M6 traffic/ambient ([[m61-object-pool]], [[m62-traffic-drones]], [[m63-traffic-vehicles]], [[m64-steam-sparks]]); M5 dormant creature ([[entity-system-m5]]).

```mermaid
gantt
  title QWEN FLASH // AWAKENING
  dateFormat YYYY-MM-DD
  section Scaffold
  M0 scaffold + boot skeleton :done, m0, 2026-09-15, 1d
  section Core
  M1 systems registry, input, camera :done, m1, after m0, 2d
  M2 voxel material kit :done, m2, after m1, 2d
  section World
  M3 chunked city far layer :done, m3, after m2, 3d
  M4 building detail passes :done, m4, after m3, 3d
  section Creature & life
  M5 Qwen creature dormant :done, m5, after m4, 3d
  M6.1 object pool foundation :done, m61, after m5, 1d
  M6.2-6.5 traffic + ambient life :done, m6, after m61, 2d
  M7 particles + FX :done, m7, after m6, 2d
  section Climax
  M8 atmosphere :done, m8, after m7, 2d
  M9 awakening sequence :done, m9, after m8, 3d
  M10.1 unsloth monument + sign :done, m101, after m9, 1d
  M10.2 holo sloth + street drones :done, m102, after m101, 1d
  M10.3 easter-egg reaction :done, m103, after m102, 1d
  section Finish
  M11.1 audio master graph + gesture gate :done, m111, after m103, 1d
  M11.2 looping beds :done, m112, after m111, 1d
  M11.3 event sounds :done, m113, after m112, 1d
  M11.4 spatial mixing :done, m114, after m113, 1d
  M12.1 intro timeline runner + corridor :done, m121, after m114, 1d
  M12.2-12.3 intro beats + skip/fade :m12, after m121, 1d
  M13 emergent event director :m13, after m12, 3d
  M14 perf, tiers, polish :m14, after m13, 3d
```
