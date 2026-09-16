<!-- BEGIN brain.md -->
## Project Brain

This project keeps a **Project Brain** for durable decisions, requirements, constraints, architecture, conventions, and other knowledge that will still matter later.

- At the start of substantive work, read `./BRAIN.md` and load only the relevant Brain pages. Prefer narrow reads over scanning everything.
- The `brain` CLI is not guaranteed to be on `PATH`. From the project root, invoke it as `node <brain-page-skill-dir>/bin/brain.mjs <subcommand> [flags]`, resolving `<brain-page-skill-dir>` to the installed `brain-page` skill directory.
- When a durable decision, requirement, constraint, or architectural insight settles, record it immediately through the Brain CLI/workflow.
- Pure implementation with no new durable knowledge does not require a Brain write.
- When overturning a prior conclusion, update the existing truth/timeline rather than leaving contradictory current facts.
- Store only information that is durable and hard to reconstruct from the code alone. Do not copy transient task/debug history into Brain.
- Never hand-edit managed Brain backing files. Prefer a connected Brain MCP server when available and authenticated; otherwise use the Brain CLI.
- If Brain already exists and its cheap health checks pass, do not re-bootstrap or broadly re-analyze the repository merely to prove it is initialized.
- If Brain is missing, incomplete, or broken, attempt a bounded safe repair using the installed Brain workflow and verify it afterward.
<!-- END brain.md -->

<!-- BEGIN graphify -->
## Graphify

Use Graphify for structural understanding of the current codebase.

- Prefer targeted `graphify query`, `graphify explain`, `graphify path`, and `graphify affected` operations over reading many files for architecture, dependency, execution-path, or impact questions.
- Source code remains the source of truth if Graphify disagrees with the repository.
- Do not load `graphify-out/graph.json` directly into model context.
- Run `graphify update .` after substantial structural changes.
- Run `graphify update . --force` after large refactors or deletions when a normal update may leave stale structure.
- Graphify Git hooks normally keep code-derived graph state synchronized after commits/checkouts.
- If an existing graph and its cheap health checks are healthy, do not rebuild it merely to prove initialization.
- If Graphify is stale, missing, polluted by generated/vendor/build content, or otherwise unhealthy, attempt a bounded safe repair and verify it.
<!-- END graphify -->

<!-- BEGIN tokenix -->
## Token-efficient source retrieval

Use the smallest useful context source. Preferred order:

1. **Brain** — durable project context and previous decisions.
2. **Graphify** — architecture, dependencies, relationships, execution paths, and impact analysis.
3. **Tokenix** — semantic search and targeted source retrieval.
4. **Direct source inspection** — exact implementation details and final verification.

Prefer Tokenix when it can answer the question without loading entire files or large command outputs.

- Retrieve the smallest relevant symbols, chunks, or bounded line ranges.
- Do not broadly scan repository files when targeted retrieval is sufficient.
- Direct reads are appropriate for small files, bounded ranges, exact verification, or when targeted retrieval is insufficient.
- If an existing Tokenix index is healthy, do not rebuild it on every task.
- If the index is empty, stale, badly scoped, or dominated by generated/vendor/minified/cache/build content, attempt a bounded safe repair and verify it with `tokenix stats --no-tui`.
<!-- END tokenix -->

## Persistence stack

Treat Brain, Graphify, and Tokenix as complementary layers, not substitutes.

Before substantive repository work, perform only cheap checks needed to determine whether the already-initialized persistence stack is usable. Bootstrap or repair a layer only when it is actually missing or unhealthy.

When initializing or repairing repository retrieval state:

- Respect existing `.gitignore`, `.tokenix.toml`, and `.graphifyignore` rules.
- Avoid indexing or graphing generated, vendored, minified, cached, build-output, or large binary/media content unless it is intentionally authoritative project material.
- Preserve existing durable knowledge and repository-specific configuration.
- Prefer a small high-signal index/graph over a large noisy one.
- After a repair, re-run the relevant health check before considering the layer healthy.
- If a safe repair repeatedly fails, needs permission, or requires unavailable information, continue with the remaining healthy layers and targeted direct inspection when safe.

Do not install machine-global executables, models, caches, skills, hooks/helpers, or user-profile configuration into this repository as a workaround.

## Git and generated state

Preserve the repository's existing policy. Durable/shareable project state may be tracked when that is already the project convention, while machine-specific state should remain machine-global.

Do not make unrelated commits or overwrite repository-specific configuration while bootstrapping or repairing the persistence stack.
