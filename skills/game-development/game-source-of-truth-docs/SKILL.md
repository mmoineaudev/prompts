---
name: game-source-of-truth-docs
description: Produce single-file source-of-truth documentation from a game codebase — what to build, how it's engineered, why it's tuned, how to verify (automatically and by hand) — so a future model can re-implement the game from that one file alone.
triggers:
  - A user wants a game reproduced or re-implemented later ("reproduce this when new models come out")
  - A user wants one comprehensive spec document as the only source of truth for a game
  - Converting an existing game codebase into a buildable specification
  - Handing a project to a future / less-capable model with only a written spec
---

# Source-of-Truth Documentation for a Game Codebase

Applies ONLY to games (or game-like interactive projects: browser games, procedural games, game prototypes). For non-game software, do not use this skill.

When a user wants a game re-implemented later ("reproduce this when new models come out", "this file must be the only source of truth"), produce ONE structured markdown file that specifies, in order of power:

1. **WHAT to build** — game identity, design pillars, game feel, mechanics, all binding numbers and formulas (damage, HP, speeds, ranges, timings, counts, weights, probabilities).
2. **HOW it's engineered** — architecture, module map, algorithms (generation, pathfinding, spawning), technical mechanisms, contracts (pools, disposal, budgets).
3. **WHY it's tuned that way** — design rationale and tuning philosophy (difficulty curves, economies, caps, perf cuts) so future changes stay consistent with the game's vision.
4. **How to verify it automatically** — the exact commands and expected outputs of the game's own check suite.
5. **How to check it by hand** — a manual QA/playtest checklist for what scripts can't prove (feel, pacing, biome cadence, boss behavior).

The deliverable passes the "future-model test": a fresh, less-capable model given ONLY this file must rebuild the game and pass the verification section.

## Process (methodical, in order)

1. **Plan the structure first** (show the user the section order before writing). Order matters: identity/design pillars → controls → run/meta structure → core mechanics (player, combat, enemies) → systems → data tables → verification. A future model reads design first, then mechanisms, then exact numbers.
2. **Ground every claim in code, never memory and never existing docs.** Existing spec documents in the repo go STALE (wrong constants, old designs, abandoned numbers — e.g. a doc saying "wall height 4" when the constant is 20). Read the live tree: the constants module (the game's data contract), the orchestrator (game loop, level lifecycle), every system, the enemy/entity classes, the UI/HUD markup.
3. **Use method maps before full reads.** `grep -nE "^  [a-zA-Z_][a-zA-Z0-9_]*\(" <file>` lists every method with line numbers — read only the ranges you need instead of whole files. For big files, batch targeted reads.
4. **Read the check scripts early.** They encode the game's invariants and give you the verification section almost for free (exact gates, thresholds, expected output).
5. **Determine implemented vs. planned.** Run the check scripts. Mark in the doc what is SHIPPED (verify, don't rebuild) vs. what remains — a fresh model must not double-apply completed work.
6. **Write the single file**, then run the verification section against the reference implementation to prove the doc's claims.
7. **Commit** (per the user's repo conventions: commit + push each change; keep the file alongside the project's other specs).

## Precision rules (binding)

- **Numbers are contracts**: every gameplay number is exact and verified against source. No ranges left open, no TBDs, no "approximately".
- **Symbols, not line numbers**: reference functions/constants by name (`_handleShooting`, `SWORD.COMBO`), never by line numbers — they drift.
- **State the scope rule up front**: which aspects are deliberately free (graphic elements — colors, geometry, palettes, particles, HUD styling, audio) vs. binding (mechanics, engineering, budgets, UX strings). Graphics get identity-level descriptions ("runic greatsword with glowing runes", "Dark-Souls-style hearts"), never pixel recipes — that is where the implementing model expresses its visual ability.
- **Include UX strings**: all player-facing text (toasts, hints, prompts, labels, button text, death titles) is content, not graphics — specify it verbatim.
- **Include game-feel engineering a model can't guess**: hit-stop, screen shake, camera layers (e.g. why the headlight never lights the first-person weapon), i-frames, input edge-triggering, buff carry rules, spawn pacing.
- **Include engineering contracts**: pooling/zero-allocation tables, disposal/memory-lifecycle rules, budgets (light ceilings, draw calls), algorithm steps (seeded generation, spawn weighting, elite rolls), and the exact bootstrap/init order.
- **Include legacy/inert items**: constants and flags that exist but are unused (spacing constants, disabled features, dead toggles, removed bars). A future model will otherwise chase them. Mark them "present but inert — do not build on".
- **Include the WHY**: a design-rationale section (intent behind the economy, caps, difficulty curves, torchless biomes, perf cuts, the "5% post-processing" rule, red-for-danger discipline) so tuning stays consistent with the original vision.
- **Include gotchas that cost real debugging time**: historical bug fixes (dead-code constants, ordering bugs, state-carry rules), headless/CI shims, any subtle invariant the code comments warn about.
- **Status markers**: verify claims by running the game's own checks; cite that verification with a date in the doc's status map.

## Verification-section pattern

```
| Command | Expected |
| `node scripts/<check-a>` | `<summary line>` |
| ... | ... |
| headless smoke/boot test | canvas + renderer up, HUD ids present, loop alive, ZERO JS exceptions |
```

Plus the algorithm of the main integrity check (what it mirrors, what counts as broken), and in-game invariants (memory stable over N descends/runs, no leaks, state survives level regens).

## Pitfalls

- **Existing spec docs are liabilities**: they describe an older design with wrong numbers. Verify everything against the live tree; if you must reference an old spec, supersede it explicitly.
- **Delegating extraction to subagents can fail** (rate limits, timeouts) and lose the distilled output. If a batch dies, extract directly — method maps make it cheap. Never ship a doc with guessed numbers because extraction failed.
- **Don't conflate graphics with engineering**: pool sizes, budgets, layer schemes, and pass structure are binding; colors, geometry, and styling are free. Mixing them up either over-constrains the implementer or under-specifies the build.
- **Don't trust "obvious" numbers**: re-verify against constants.
- **Line references rot**; symbol references don't.
- **A doc that only says WHAT produces a different game every time.** A doc that only says HOW produces a game that works but feels wrong. Both lenses plus WHY and verification are required.
- **Games live and die on feel**: if the doc omits game-feel mechanics (hit-stop, shake, telegraphs, spawn pacing, feedback loops), the re-implementation will be technically faithful but unpleasant. The manual QA checklist must cover pacing and feel, not just correctness.

## Quality gate

Before delivering, ask: could a fresh model, with only this file, rebuild the game and pass every command in the verification section? If any number, rule, mechanism, or contract is missing or ambiguous, close it first. Then run the verification commands on the reference implementation and report their real output as proof.
