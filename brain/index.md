# Brain Index

_Auto-generated. Last updated 2026-09-15T21:58:18.368Z._

- [entity-system-m5](pages/entity-system-m5.md) — category: decision | tags: [entity, m5, creature, instancing] | ENTITY is the 6th system in the fixed boot order (INPUT → CAMERA → KIT → WORLD → **ENTITY** → HUD), registered between WORLD and HUD in `ind
- [m2-material-kit](pages/m2-material-kit.md) — category: decision | tags: [kit, materials, draw-calls, three] | M2's `KIT` system is the shared foundation every later visual milestone builds on:
- [m61-object-pool](pages/m61-object-pool.md) — category: decision | tags: [pool, traffic, m6, performance] | `POOL` (top-level module in `index.html`, exposed as `window.SIM.POOL`) is the single object-pool foundation all M6/M7 emitters (drones, veh
- [m62-traffic-drones](pages/m62-traffic-drones.md) — category: decision | tags: [m6, traffic, pool, tier] | ## Decided
- [m63-traffic-vehicles](pages/m63-traffic-vehicles.md) — category: decision | tags: [m6, traffic, pool, tier, vehicles] | ## Decided
- [m64-steam-sparks](pages/m64-steam-sparks.md) — category: decision | tags: [m6, traffic, pool, tier, steam, sparks] | ## Decided
- [m71-parts-particle-system](pages/m71-parts-particle-system.md) — category: decision | tags: [m7, parts, pool, particles, tier] | ## Decided
- [m72-fx-pulse](pages/m72-fx-pulse.md) — category: decision | tags: [m7, fx, pulse, pool, tier] | ## Decided
- [m73-fx-arcs](pages/m73-fx-arcs.md) — category: decision | tags: [m7, fx, arcs, pool, tier] | ## Decided
- [m74-fx-flash](pages/m74-fx-flash.md) — category: decision | tags: [m7, fx, flash, overlay] | ## Decided
- [near-layer-detail-pass](pages/near-layer-detail-pass.md) — category: decision | tags: [m4, detail, instancing] | ## Decision
- [pi-runner-plan-format](pages/pi-runner-plan-format.md) — category: decision | tags: [plan, pi-runner, formatting] | The `## Milestones` section of `PLAN.md` must use the same format as `.
- [smoke-harness-dev-tooling](pages/smoke-harness-dev-tooling.md) — category: decision | tags: [testing, smoke, playwright, tooling] | The smoke harness lives in `smoke/` (dev tooling only, not part of the product): `node smoke/smoke.mjs [url]` serves the project root on :83
- [three-cdn-pin-boot-watchdog](pages/three-cdn-pin-boot-watchdog.md) — category: decision | tags: [three, cdn, boot, robustness] | Three.js is pinned to `three@0.160.0` via a `<script type="importmap">` pointing at jsDelivr (`cdn.jsdelivr.net`) — the only permitted exter
- [world-chunk-generation](pages/world-chunk-generation.md) — category: decision | tags: [world, city, chunks, prng, instancing] | The `WORLD` system (registered between KIT and HUD) generates the far-layer city deterministically:
