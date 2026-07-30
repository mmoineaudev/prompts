---
name: use-case-generator
description: Use when generating Cockburn-style fully-dressed use cases from source code, specs, requirements docs, or natural language descriptions. Produces a structured folder hierarchy of use case files following the 12-step recipe with MSS, extensions, guarantees, and optional implementation checklists. Triggers on "generate use cases", "extract use cases from", "create use case library", "requirements to use cases".
version: 2.0.0
author: Hermes Agent
license: MIT
tags: [requirements, use-cases, Cockburn, analysis, documentation, specification]
---

# Use Case Generator — Cockburn's Fully Dressed Methodology

Transform any input into a complete use case library following Alistair Cockburn's methodology. Output is a folder-based hierarchy of fully-dressed use cases ready for stakeholder review and development.

**Core principle:** Use cases are behavioral contracts — not feature lists or UI specs. They describe what the system does under various conditions in response to stakeholder requests.

## When to Use

- User asks to generate use cases from code, specs, docs, or a description
- Extracting requirements and structuring them from an existing system
- Needing behavioral requirements for planning or communication
- Discovering hidden requirements by analyzing failures and stakeholder interests

**Never use when:** The user only wants a simple feature list or user stories.

## Output Structure

```
use_cases/
├── README.md                          # Project overview, scope statement, actor-goal list
├── 0_summary/                         # Summary-level (white/kite) — 2-5 total
│   └── UC-NN-<name>.md
├── 1_user_goals/                      # User-goal level (blue/waves) — primary focus
│   └── UC-NN-<name>.md
└── 2_subfunctions/                    # Subfunction level (indigo/fish)
    └── UC-NN-<name>.md
```

**Naming:** `UC-NN-<short-hyphenated-name>.md` with sequential numbers.

## Fully Dressed Template

Every use case file uses this exact structure:

```markdown
# USE CASE UC-NN-<NAME>

**Context of use:** <goal statement if needed>
**Scope:** <Enterprise | System | Subsystem with name>
**Level:** <Summary | User-goal | Subfunction>
**Primary Actor:** <role name or description>

**Stakeholders & Interests:**
- <Stakeholder>: <key interest>

**Precondition:** <what must be true before this runs>
**Minimal Guarantees:** <protection under all exits including failures>
**Success Guarantees:** <world state if goal succeeds>
**Trigger:** <what starts the use case>

## Main Success Scenario (MSS)
1. <Actor>: <action — intent, not UI>
2. <Actor>: <action>
...

## Extensions
<step><letter>. <condition detected>: <handling action or sub-use case>

## Technology and Data Variations List
- Step <N>: <variation that doesn't change behavior>

## Related Information
- **Priority:** <1=highest, 4=lowest>
- **Channels:** <how actor accesses system>
- **Frequency:** <estimated usage>
- **Open Issues:** <unresolved questions>
```

## Execution — Agent Workflow

Follow these steps in order. Use file reading and search tools as needed at each stage.

### Phase 1: Scope and Goals (Steps 1-5)

**Step 1 — Name scope and boundaries.** Analyze input (source code, text docs). Determine what is inside vs outside the system. Document In/Out in `README.md`.

**Step 2 — Brainstorm primary actors.** Identify every human AND non-human actor that initiates interactions. Include future automated triggers.

**Step 3 — List user goals.** For each primary actor, identify goals against the system. Produce an Actor-Goal List table in `README.md`: `Actor | Goal | Priority`.

**Step 4 — Capture outermost summary use cases.** Write 1-5 summary-level use cases. These show context and serve as a table of contents.

**Step 5 — Revise summaries.** Add, subtract, or merge. Check for time-based triggers. Verify against stakeholder needs.

### Phase 2: Expand Individual Use Cases (Steps 6-10)

**Step 6 — Select one use case to expand.** Prioritize user-goal level. Write a usage narrative as warm-up before formal template.

**Step 7 — Capture stakeholders, interests, preconditions, guarantees.** List EVERY stakeholder including off-stage ones (regulators, owners, auditors). Define protection under all exits and success state.

**Step 8 — Write the Main Success Scenario.** Use 3-9 steps. Each: simple sentence, one actor, shows intent not UI, moves distinctly forward. Include post-success bookkeeping.

**Step 9 — Brainstorm ALL extension conditions.** Go through each MSS step asking "what could go wrong?" List every detectable condition. DO NOT write handling yet.

**Step 10 — Write extension handling.** For each condition, specify system response. Each extension ends back in MSS, at a separate success exit, or in failure.

### Phase 3: Refine (Steps 11-12)

**Step 11 — Extract/merge sub-use cases.** If a step is too complex, extract as subfunction use case. Merge trivial ones.

**Step 12 — Readjust the set.** Check readability, completeness, all stakeholder interests met. Run the 31 pass/fail tests below.

### Output Generation

After completing the recipe:
1. Create the folder structure (`use_cases/0_summary`, `1_user_goals`, `2_subfunctions`).
2. Write `README.md` using the template at `references/README_template.md`.
3. Write each use case file following the exact template above.
4. Generate `checklist.md` if requested (see below).
5. Run 31 pass/fail tests on each use case before considering it complete.

## Analysis Techniques by Input Type

### From Source Code
- **Entry points:** Public APIs, CLI commands, web routes, event handlers → triggers and primary actors
- **External interfaces:** HTTP endpoints, message queues, file I/O, DB calls → supporting actors
- **Request flows:** Follow from entry point through call chain to delivered goal
- **Validation/error handling:** Try/catch blocks, error codes → extension conditions
- **Business rules:** Conditional logic, auth checks, state transitions → stakeholder interests and guarantees

### From Text / Requirements Documents
- Extract actors (nouns performing actions or receiving services)
- Extract goals (verb phrases describing actor objectives)
- Extract flows (numbered steps, sequences, workflows)
- Identify implicit failures at each step — specs rarely list all failure modes
- Find hidden stakeholders (auditors, regulators, compliance, logging)

### From Natural Language Description
- Listen for actors ("I want to...", "The system should...", "Users can...")
- Identify goals — extract verb phrases
- Probe for failures — ask about error conditions and edge cases
- Clarify scope — determine what's inside vs outside the system

## Step Writing Rules (Enforce Strictly)

Every MSS action step MUST:
1. Be one simple sentence — no compound sentences connecting different actors
2. Have a clear subject specifying which actor performs the action (`Actor: <action>`)
3. Show intent, not UI — describe what the actor wants to accomplish
4. Represent distinct forward progress
5. Use "validates" not "checks whether" (active protection vs passive observation)
6. Result in 3-9 steps total per use case (user-goal level)
7. Never describe button clicks, screen navigation, or field entries

**Correct:** `Buyer: selects vendor from approved list`
**Wrong:** `Buyer: clicks on the dropdown menu and scrolls to find "Acme Corp"`

## Extension Writing Rules

1. **Numbering:** `2a`, `2b`, `2a1` — step number + letter, nested numbers for sub-steps
2. **Condition = what system detects**, not what user does: `System detects that account has insufficient funds`
3. **Every extension must end somewhere** — back in MSS, at a success exit, or in failure
4. Brainstorm ALL conditions first, then write handling

## 31 Pass/Fail Tests (Quality Gate)

After generating each use case, ALL checks must return YES:

- Title is an active-verb goal phrase? Can system deliver that goal?
- Scope and level fields filled? Content matches stated scope/level?
- Primary actor has behavior and a goal against the system?
- Preconditions mandatory and in place by SuD? Never checked within steps?
- All stakeholders mentioned (including off-stage)?
- Minimal guarantees protect all interests under all exits? Success guarantees satisfy all stakeholder interests?
- MSS runs from trigger to delivery of success guarantee? 3-9 steps?
- Each step: simple sentence that succeeds? Moves forward? Actor clear? Intent clear? Avoids UI details? Uses "validate"?
- Extensions: System can detect and handle each condition? Phrased as what system detects?
- Overall: Would sponsors/users/developers agree this is correct?

## Checklist Generation (Optional Output)

When generating a checklist:
1. MSS steps → Implementation tasks; Extensions → Error handling; Guarantees → Validation requirements
2. Group by feature area: Core systems, Feature modules, UI/UX, Data management, Error handling
3. Checkbox items (`- [ ]`) with nested sub-tasks; actionable and specific descriptions
4. Link to source use cases: `([UC-NN-Name](path/to/UC-NN-Name.md))`
5. Add metadata: priorities/dependencies, open issues from Related Information

Format for AI agent consumption — clear hierarchy, no ambiguous language, specific technical requirements.

For the extraction workflow, see companion methodology on converting specs to checklists. For execution patterns, see companion methodology on checklist-driven implementation.

## Common Pitfalls (Quick Reference)

1. **Too much UI detail** — Steps describe intent, not button clicks. If you see "click", "scroll", "type" — rewrite.
2. **Wrong goal level** — User-goal must pass the coffee break test (2-20 min). Days/weeks = summary. Tiny sub-step = subfunction or merge.
3. **Missing off-stage stakeholders** — Regulators, auditors, owners have interests that surface as validation checks and logging. Forgetting them causes late changes.
4. **Extensions without endings** — Every extension specifies where execution resumes or if goal fails.
5. **Writing handling before listing all conditions** — Brainstorm ALL failures first, THEN write handling.
6. **Scope ambiguity** — Always label: Enterprise (org name), System (system name), Subsystem (component name).
7. **"Check" vs "validate"** — `System checks if X` is passive. `System validates X` is active protection.
8. **No post-success bookkeeping** — Include logging, notifications, state updates, cleanup.

## Verification Checklist

- [ ] Output directory structure created (`use_cases/0_summary`, `1_user_goals`, `2_subfunctions`)
- [ ] `README.md` contains scope statement and Actor-Goal List table
- [ ] Each use case file follows the exact template with all fields populated
- [ ] All MSS steps are simple sentences with clear actor subject and intent-focused language
- [ ] Extensions follow numbering convention and each has a defined end point
- [ ] 31 pass/fail tests applied to each generated use case
- [ ] `checklist.md` generated (if requested) with cross-references to source use cases
