---
id: pi-runner-plan-format
title: PLAN.md Milestones must match vibeSurvivors table format
category: decision
status: active
tags: [plan, pi-runner, formatting]
created: "2026-09-15T00:32:29"
updated: "2026-09-15T08:39:52"
---

<!-- compiled_truth -->
The `## Milestones` section of `PLAN.md` must use the same format as `../vibeSurvivors/PLAN.md`, because the pi runner parses that exact structure.

**Required format** (inside `## Milestones`):
- A single markdown table with header `| Phase | Scope | Gate |` (one table only; intro prose may precede the table, nothing between tables).
- One row per milestone/sub-milestone, Phase cell = `**M0**`, …, `**M6.1**` style (bold token, no trailing em-dash/title in the Phase cell; `✅` marks done phases).
- **Scope** = one-line summary of the deliverable. **Gate** = the done-when condition.
- No `### M#` sub-headings or checklist items inside the `## Milestones` section — only the table.

**Sub-milestone rule (M6+):** M6 → M14 are split into dotted sub-milestones (`M6.1` … `M14.5`). One sub-milestone = one actual, clear functional change + its testing + one commit; no sub-milestone shipped without smoke-test evidence. Parent phases no longer appear as table rows — only their sub-milestones do.

**Where detail lives:** per-milestone checklists and Done-when bullets stay in a separate section below the table (`## Milestone details`), not inside the parsed section.

**Consequence:** when adding/reordering milestones, update both the table row and the details section; the runner only sees the table.


## Timeline

- time: 2026-09-15T00:32:29
  kind: decision
  summary: "Created this page: PLAN.md Milestones must match vibeSurvivors table format"
  source: "user: pi runner wont work otherwise"
  affects: [pi-runner-plan-format]

- time: 2026-09-15T00:32:40
  kind: decision
  summary: Recorded the pi-runner-compatible PLAN.md milestones format constraint
  source: "user: pi runner wont work otherwise"
  affects: [pi-runner-plan-format]

- time: 2026-09-15T08:39:52
  kind: decision
  summary: "M6-M14 split into M#.# sub-milestones in the same single table; rule: one sub-milestone = one functional change + testing + commit"
  source: "user: milestones too big from M6 on, split to smaller ones"
  affects: [pi-runner-plan-format]
