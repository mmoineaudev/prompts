---
name: checklist-enrichment-review
description: Systematic process for reviewing, enriching, and gap-analyzing implementation checklists before execution begins. Identifies missing systems, fixes corrupted syntax, and adds domain-specific guards. Triggers on "review the checklist", "enrich the plan", "gap analysis", "checklist review".
version: 2.1.0
author: Hermes Agent
license: MIT
tags: [checklist, enrichment, review, gap-analysis, quality-assurance]
---

# Checklist Enrichment & Review Skill

Systematic process for reviewing and enriching implementation checklists before execution. Identifies missing systems, fixes corrupted syntax, and adds domain-specific guards.

## When to Use

After a checklist/spec has been drafted but before implementation begins:
- A spec or checklist exists but may be missing critical systems
- You need to stress-test completeness against known failure modes
- The user asks to "review and improve" an existing plan

**Never use when:** The checklist doesn't exist yet — that's a separate extraction process. Never use during active implementation — that's a separate execution workflow.

## Core Process

### 1. Gather Context (Mandatory First Steps)

a. Read the original spec/document being checked
b. Load all relevant domain-specific guidance — especially anti-patterns and framework-specific guidance
c. Note which anti-patterns or failure modes could match this project domain

**Critical:** The quality of enrichment depends on loading the right domain context first. If working on a single-file game, load single-file game anti-patterns. If on a data pipeline, load relevant data skills.

### 2. Phase-by-Phase Gap Scan

For each phase in the checklist, ask:

- **Is there a missing FIRST-CLASS system?** Something that should exist as its own component (Entity Manager, Projectile System, Buff Tracker, Room Transitions, Auth Middleware, etc.)
- **Is any step too thin to implement from?** (e.g., "trap types" listed as one bullet — expand into at least 3 types with mechanics)
- **Does the spec mention something in passing that needs its own implementation step?** (e.g., "active effects" mentioned in HUD requirement → needs BuffManager class step)

### 3. Syntax Integrity Check

Scan for corrupted checkbox markers. Ensure every checkbox line starts with `- [ ]` or `- [x]` exactly. Fix any corrupted syntax.

### 4. Domain Anti-Pattern Cross-Reference

For each step, ask: "Which anti-patterns could apply here?" and add specific guards.

The exact anti-patterns depend on the domain. For games:
- **Break-cascade (AP5)** → Entity loops need boolean flags, not `break;}`
- **Input timing (AP12)** → Input.update() outside accumulator loop
- **State handler rendering (AP14)** → Every dead/victory/paused state draws its own frame
- **Camera init/target mismatch (AP13)** → First-frame camera position equals target formula
- **GainNode.currentTime (AP11)** → Only use `this.ctx.currentTime`, never local variable's `.currentTime`

For general software projects, check against project-specific anti-patterns from loaded skills.

### 5. Playability/Usability Injection

For each gameplay-critical or UX-critical step, add:
- A **"Playability check"** paragraph describing how to verify the step works correctly
- A **"CRITICAL non-negotiable"** if the step is a make-or-break requirement
- Specific metrics where possible (e.g., "minimum 10px font", "60x60px touch targets", "4:1 contrast ratio")

### 6. Structural Enrichment Patterns

#### Pattern A: Sub-step insertion for critical missing systems

Use `Step N.b` naming to insert between existing steps without renumbering:

```markdown
### Step 9: Player Entity
...base step content...

---

### Step 9b: Hitbox Sizing (Critical)
- [ ] Collision box at ~80% of sprite dimensions, centered
```

#### Pattern B: Sequential chain enrichment for complex flows

For multi-step events (boss death → victory), write out the exact sequence:

```markdown
**Boss death victory flow (sequential):**
1. Shadow Lord reaches 0 HP -> enters DEATH state (3-second fade)
2. During death: boss still deals damage at reduced frequency
3. After full fade: room lights up, exit activates
4. Victory flag set, player can walk through exit
5. Walking through exit triggers VICTORY after 2s delay
6. Victory screen shows final stats
```

#### Pattern C: Multi-sensory feedback chains

For any interaction that a user/player must perceive, require at least 2 channels:
1. Visual (animation, color flash, effect)
2. Audio (unique SFX per interaction type)
3. HUD/Feedback (slot highlight, floating text, number update)

#### Pattern D: Anti-pattern guard template

```markdown
**Anti-pattern guard:** [Describe the specific bug pattern]. [Explain what NOT to do]. See [Anti-Pattern X].
```

### 7. Verification After Patching

After all enrichments are applied:
- Confirm the checklist grew (more items, not fewer) — enrichment should only ADD items
- Check for any new corrupted checkbox syntax from patching errors
- Verify the Summary section accurately reflects all new steps

## Output Format

Each enriched step should follow this structure:

```markdown
### Step N: [Title]
- [ ] Implementation detail 1
- [ ] Implementation detail 2
- [ ] **Specific requirement** that is easy to miss

**Anti-pattern guard:** [What could go wrong, what to avoid]

**Playability check:** [How to verify it works correctly]
```

## What NOT to Do During Review

- **DO NOT** add code snippets to the checklist — they bloat agent context. Describe behavior and constraints instead.
- **DO NOT** renumber steps when inserting new ones — use `.b` suffix (Step 3b, Step 6b) to preserve references
- **DO NOT** reduce checkbox count — enrichment should only ADD items, never remove them
- **DO NOT** change the phase ordering — dependency order is correct and changing it breaks implementation logic

## Verification Checklist

- [ ] Domain-specific skills loaded before gap scan (anti-patterns in context)
- [ ] Every phase checked for missing first-class systems
- [ ] Corrupted checkbox syntax fixed
- [ ] Anti-pattern guards added where relevant to the domain
- [ ] Playability/UX checks injected for critical steps
- [ ] Enrichment only added items, never removed them
- [ ] Sub-steps inserted with `.b` suffix, not by renumbering
