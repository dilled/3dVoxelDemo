---
id: m61-object-pool
title: "M6.1 POOL: fixed-capacity object pools — null-on-exhaust, swap-release, idempotent release, global registry"
category: decision
status: active
tags: [pool, traffic, m6, performance]
created: "2026-09-15T09:30:03"
updated: "2026-09-15T09:30:28"
---

<!-- compiled_truth -->
`POOL` (top-level module in `index.html`, exposed as `window.SIM.POOL`) is the single object-pool foundation all M6/M7 emitters (drones, vehicles, steam, sparks, particles) build on. Design contract, locked by the M6.1 smoke section:

- `POOL.make(name, capacity, makeItem)` is the ONLY allocation point: `makeItem(i)` runs exactly `capacity` times at creation. Every item gets a `__free` flag and an `__pool` back-reference to its pool.
- `acquire()` / `release()` are allocation-free for the life of the pool (pre-allocated free stack, swap-pop / swap-push, no array growth, no `new`).
- **Cap semantics: `acquire()` returns `null` when the pool is drained** — emitters skip that spawn and retry next frame. The tier cap is enforced structurally; never by a throw, never by resizing.
- `release(item)` is idempotent and ownership-checked via `__pool`: double releases and foreign-item releases are counted in `badReleases`, never pushed onto the stack.
- Items keep their last values on release — consumers re-init every field in place on acquire (no hidden reset, no per-item objects).
- Every pool self-registers in `POOL.list`; `POOL.stats()` aggregates capacity/inUse/peak. M6.5 tier-cap scaling and the M14.2 HUD read this instead of touching individual pools.

M6.1 gate evidence (headless smoke): 64-item pool, factory called exactly 64×; 10k-cycle burst run (39,994 ops) handed out only pre-created refs (zero `new` after init) with JS heap delta 0 bytes; exhaustion → null; double/foreign release → counted no-ops; pool returns to full with balanced stats.

Later emitters MUST: create their pool once in their subsystem `init()` (fixed capacity per tier lands in M6.5), `acquire()` at the emission point and treat null as "skip", `release()` exactly once per successful acquire.


## Timeline

- time: 2026-09-15T09:30:03
  kind: decision
  summary: "Created this page: M6.1 POOL: fixed-capacity object pools — null-on-exhaust, swap-release, idempotent release, global registry"
  source: M6.1 implementation
  affects: [m61-object-pool]

- time: 2026-09-15T09:30:28
  kind: decision
  summary: Filled compiled_truth with the POOL design contract
  source: M6.1 implementation
  affects: [m61-object-pool]
