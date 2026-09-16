<!-- BEGIN brain.md -->
## Project Brain

This project keeps a **Project Brain** for durable decisions, requirements,
constraints, architecture, conventions, and knowledge that is hard to
reconstruct from code alone. Read `./BRAIN.md` for the full contract.

- At the start of substantive work, load only the relevant Brain context.
- The `brain` CLI is not guaranteed to be on `PATH`. From the project root use
  `node <brain-page-skill-dir>/bin/brain.mjs <subcommand> [flags]`, resolving
  `<brain-page-skill-dir>` to the installed `brain-page` skill directory.
- Record a durable decision, requirement, constraint, or architectural insight
  when it settles. Pure implementation with no new durable knowledge does not
  require a Brain write.
- When overturning a prior conclusion, update the existing truth/timeline rather
  than leaving contradictory current facts.
- Do not store transient task/debug history or information easily reconstructed
  from code.
- Never hand-edit managed Brain backing files. Prefer an authenticated Brain MCP
  server when available; otherwise use the Brain CLI.
<!-- END brain.md -->

<!-- BEGIN graphify -->
## Graphify

Use Graphify for structural understanding of this codebase.

- Prefer targeted `graphify query`, `graphify explain`, `graphify path`, and
  `graphify affected` operations for architecture, dependencies, execution
  paths, and impact analysis.
- Source code remains authoritative if Graphify disagrees with the repository.
- Do not load `graphify-out/graph.json` directly into model context.
- Run `graphify update .` after substantial structural changes.
- Run `graphify update . --force` after large refactors or deletions when needed.
- Graphify Git hooks normally keep code-derived graph state synchronized after
  commits and checkouts.
<!-- END graphify -->

<!-- BEGIN tokenix -->
## Token-efficient source retrieval

Use the smallest useful context source:

1. **Brain** — durable project context and previous decisions.
2. **Graphify** — architecture, dependencies, relationships, execution paths,
   and impact analysis.
3. **Tokenix** — semantic search and targeted source retrieval.
4. **Direct source inspection** — exact implementation details and verification.

Prefer Tokenix when it can answer the question without loading entire files or
large command outputs. Retrieve the smallest relevant symbols, chunks, or
bounded line ranges. Direct reads are appropriate for small files, exact
verification, or when targeted retrieval is insufficient.
<!-- END tokenix -->
