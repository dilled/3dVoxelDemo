---
id: pi-runner-plan-format
title: PLAN.md Milestones must match vibeSurvivors table format
category: decision
status: active
tags: [plan, pi-runner, formatting]
created: "2026-09-15T00:32:29"
updated: "2026-09-15T00:32:40"
---

<!-- compiled_truth -->
The `## Milestones` section of `PLAN.md` must use the same format as `../vibeSurvivors/PLAN.md`, because the pi runner parses that exact structure.

**Required format** (inside `## Milestones`):
- A single markdown table with header `| Phase | Scope | Gate |`.
- One row per milestone, Phase cell = `**M0**`, `**M1**`, … (bold, no trailing em-dash/title in the Phase cell; `✅` marks done phases).
- **Scope** = one-line summary of the milestone's deliverables.
- **Gate** = the milestone's done-when condition.
- No `### M#` sub-headings or checklist items inside the `## Milestones` section — only the table.

**Where detail lives:** per-milestone checklists and Done-when bullets stay in a separate section below the table (`## Milestone details` in this project's PLAN.md), not inside the parsed section.

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
