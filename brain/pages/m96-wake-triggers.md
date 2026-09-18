---
id: m96-wake-triggers
title: "M9.6 triggers: F key, HUD button, one-shot 30 s auto-awaken"
category: decision
status: active
tags: [m9, entity, trigger, boot, ui]
created: "2026-09-18T17:59:29"
updated: "2026-09-18T17:59:29"
---

<!-- compiled_truth -->
## Decided

- **M9.6 wires all three awakening entry paths to the existing
  `ENTITY.wake()` trigger (M9.2) — no new system, no new state
  machine, all tunables in `CFG.entity.trigger`**:
  - **Manual key `F`**: `INPUT.wakeTrigger` edge flag (same
    repeat-guarded, RUNNING-guarded pattern as the other dev edges);
    consumed at the top of `ENTITY.update` → `_userTriggered = true;
    ENTITY.wake()`.
  - **HUD button** `#awakeBtn` (bottom-right, `.on` fade like `#hint`,
    wired in `HUD.init`): click → `_userTriggered = true;
    ENTITY.wake()` (RUNNING-guarded). Hint text gained an "F awaken"
    line.
  - **One-shot auto**: `CFG.entity.trigger.auto = 30` s after **intro
    end**, anchored at `BOOT.t0` (recorded in `BOOT.enter('RUNNING')` —
    today the intro ends immediately at START; **M12's intro engine
    replaces that anchor**, the seam is `BOOT.t0`). `ENTITY._autoAt`
    is lazily computed from `null` to `BOOT.t0 + 30` on the first
    RUNNING frame (smoke parks it by direct write, same pattern as
    `ATMOS._ltTimer`). At the deadline `_autoFired = true` **burns the
    shot permanently** (never re-fires), and `ENTITY.wake()` runs only
    when `!ENTITY._userTriggered` — the auto is for the audience that
    presses nothing.
  - **All three paths start the same sequence exactly once** because
    they all funnel into `ENTITY.wake()`, which is a no-op unless
    DORMANT: a re-press / re-click mid-sequence is structurally a
    no-op; a trigger arriving mid-sequence also burns the auto shot
    without starting a second sequence.
- **Gate (verified, no screenshot gate — analytic checks strictly
  stronger)**: smoke M9.6, 8 checks — registration (auto = 30 s,
  button present, `_userTriggered`/`_autoFired` false, `wakeTrigger`
  false, DORMANT); `page.keyboard.press('f')` → STIR exactly once
  (count +1, edge consumed, re-press no-op); `#awakeBtn` click → STIR
  exactly once (re-click no-op); auto burns (skips) when
  `_userTriggered` is already true (no sequence started); after the
  seam re-arm (`_userTriggered=false, _autoFired=false, _autoAt=null`)
  the lazy recompute lands on exactly `BOOT.t0 + 30` and fires one
  sequence; after the forced DORMANT return the auto never re-fires
  (`_autoFired` stays true, count frozen); key re-trigger after the
  auto works and resolves clean; heap flat across the section.
- **Smoke parking (new)**: both boot points (initial load + the M0
  refresh re-boot) now park `S.ENTITY._autoAt = Infinity` next to the
  `_ltTimer` park — a live auto at 30 s would inject a full sequence
  into the earlier sections' measurements.


## Timeline

- time: 2026-09-18T17:59:29
  kind: decision
  summary: "Created this page: M9.6 triggers: F key, HUD button, one-shot 30 s auto-awaken"
  source: M9.6 implementation
  affects: [m96-wake-triggers]

- time: 2026-09-18T17:59:29
  kind: decision
  summary: "M9.6: F key + HUD button + one-shot 30 s auto wired to ENTITY.wake() (full truth)"
  source: M9.6 implementation
  affects: [m96-wake-triggers]
