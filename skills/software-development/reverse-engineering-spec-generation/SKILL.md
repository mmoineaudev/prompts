---
name: reverse-engineering-spec-generation
description: >
  Reverse-engineer an existing codebase into structured, cross-referenced specification packages.
  Use when asked to analyze a repo and produces multiple docs — architecture, functional use cases,
  style/design, implementation plan — with exhaustive source coverage and bidirectional cross-references.
  Triggers on: "reverse engineer this codebase", "produce a spec package", "map all systems/behaviors/controls",
  "output N markdown documents with cross-references", "complete specification package".
---

# Reverse-Engineering Spec Generation

Use when asked to analyze an existing codebase and produce structured reverse-engineering documentation, especially when the user requests **multiple cross-referenced docs** rather than a single summary. Common triggers:
- “reverse engineer this repo”
- “produce a spec package”
- “map all systems, behaviors, controls, visual design, architecture”
- “output N markdown documents with cross-references between them”

This skill governs the **process and document contract**, not the subject matter. For domain-specific knowledge (Three.js, game architecture, shaders), load the relevant umbrella skills alongside this one.

## Trigger Conditions

Load this skill when:
- The input is an existing repository/codebase, not greenfield.
- The user asks for multi-part technical output with explicit cross-references.
- There is no single authoritative doc; the answer must come from reading sources.

Do NOT load for:
- Greenfield design exercises.
- Single-file changes.
- Pure debugging without documentation output.

## Session Workflow

### Phase A — Surface the code first
1. Enumerate the repo root and target source tree. Prefer `search_files(target='files', pattern='<target glob>')` over shell globs.
2. Read entrypoints and build scripts first to establish boundaries: `README`, `package.json`, `index.html`, launcher/docs.
3. Inventory a complete file list before reading anything in depth. Confirm count matches expectations.

### Phase B — Full-source ingestion
1. Read **every** source file in the mandated scope. Do not skim; order matters less than coverage.
2. While reading, build a live inventory: systems, entities, constants, event names, shaders, DOM IDs, HTML variants.
3. Flag immediately when you see:
   - **Bindings/docs mismatch** (README ≠ Constants ≠ InputSystem).
   - **Dead/duplicate state** (unused constants, duplicate buff owners, parallel arrays).
   - **Incomplete paths** (instanced collision bypass, never-rendered `visible=false` nodes).
   - **Lifecycle hazards** (index-after-splice, missing dispose on shared geo, audio autoplay policy).

### Phase C — Normalize before drafting
1. Collate all flagged issues into an internal **edge-case register** keyed by subsystem.
2. Identify the actual runtime paths, not the designed ones. Trace the tight loop end-to-end before writing any doc.
3. Cross-check event-bus emissions against subscriptions. A system that *emits* but has no active subscriber is either legacy or broken.

### Phase D — Draft the package in dependency order
1. **Architecture doc first** — subsystem map, runtime path, dependency graph, global state ownership, persistence.
2. **Functional use cases second** — controls, physics, combat, scoring, spawning, audio, UI, with an explicit edge-case table.
3. **Style/design third** — palette, typography, shader intent, biome aesthetics, feel analysis.
4. **Implementation plan last** — only after the previous three are stable. Each objective must cite back to exact doc sections.

This order matters: later docs may invalidate earlier assumptions. Drafting architecture before use cases avoids circular rewrites.

## Document Contract

Every reverse-engineering package should satisfy:
- **Exhaustive coverage**: every file in scope is referenced, every subsystem has a section.
- **Bidirectional cross-references**: later docs cite earlier sections; earlier docs include a “cross-reference index” pointing forward.
- **Edge-case diligence**: there is an explicit table/list of bugs, dead code, mismatches, and risks found during ingestion.
- **Honesty about unknowns**: flag assumptions, mark aspirational vs implemented features, call out README/code mismatches.

## Cross-Reference Convention

Use short section IDs, e.g. `↗01 §10`, `↗02 §5.2`. Maintain a cross-reference index at the bottom of each major document so readers can navigate without linear reading.

## Prioritization Rules for Implementation Plans

When generating an implementation plan tied to the reverse-engineered spec:
- P0 = correctness bugs that break gameplay or crash (e.g., stale-index array removal).
- P1 = gameplay feel gaps advertised in docs but unimplemented (e.g., WASD strafe).
- P2 = polish / memory / audio gaps.
- P3 = nice-to-have, accessibility, controller support.
- Distinguish **fixes** from **features**; fixes usually outrank features even when small.
- Identify “god-tier” opportunities separately; they should be spec’d but clearly marked icebox.

## Pitfalls

1. **Trusting the README over the source.** README claims and `Constants.INPUT` bindings frequently disagree; always trace to actual event handlers.
2. **Stopping at happy path.** Trace initialization, restart, shutdown, and error paths. Browser auto-play policies, index-after-splice, and disposed-but-referenced objects are all invisible from happy-path review.
3. **Grouping by technology instead of function.** Organize by subsystem (`PhysicsSystem`, `ChunkManager`), not by file extension.
4. **Skipping HTML/CSS overlays.** HUD/DOM state often duplicates or contradicts in-code state; read the HTML carefully.
5. **Forgetting outputs.** If the user said “four markdown docs,” deliver four docs plus an index/README. Don’t compress into a single file.

## Support Files

- `references/void-drift-edge-cases.md` — concrete findings from a Three.js space-flight game reverse engineering session: README/code mismatches, stale-index bug, instanced-collision gap, dead `BuffSystem`, duplicate HTML variants, and subsystem inventory table.

## Quality Signals

A successful output of this skill:
- Every src file is accounted for in at least one document.
- Input legend discrepancies are found and surfaced.
- The implementation plan references exact section IDs, not vague “combat system.”
- Edge-case table exists and has ≥ 5 items for nontrivial codebases.
- God-tier opportunities are scoped and difficulty-rated, not just named.
