---
name: skill-reflection
description: "Reflect on a past or current session to evaluate whether used skills should be enhanced. Extracts user intent, identifies gaps between skill guidance and actual workflow, then proposes targeted patches for user confirmation."
version: 0.2.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [reflection, meta, skill-improvement, session-review]
    related_skills: [hermes-agent-skill-authoring, memory]
---

# Skill Reflection

## Overview

After completing a task, the skills used may have gaps — missing steps, ambiguous wording, or uncovered edge cases. This skill analyzes a session's transcript to extract what the user *actually wanted*, compares it against what the agent *did* following loaded skills, and proposes targeted patches where the skill failed to guide effectively.

Every proposal requires explicit user confirmation before being applied. Rejected proposals are discarded with no side effects.

## When to Use

- User asks to reflect on a session: "reflect on this session", "reflect on session abc123", or "reflect on how we handled X"
- User explicitly names a skill to reflect on: "reflect on the systematic-debugging skill"
- User says "should we improve that skill?" after completing a task

Don't use for:
- Routine tasks where everything went smoothly with no corrections, workarounds, or errors
- Sessions where no skills were loaded (nothing to reflect on)
- Real-time mid-task adjustments (this is post-hoc analysis only)

## Workflow

### Phase 1: Resolve target session and scope

1. **Determine session**: If user says "this session" or "current", use the active conversation. Otherwise, extract the session ID from the user's request and load it via `session_search(session_id=..., profile="work")`. For open-ended requests like "reflect on how we handled X", use `session_search(query=..., limit=3)` and ask the user to pick the right session if ambiguous.

2. **Determine skills to reflect on**: If user names a specific skill, reflect only that one. Otherwise, identify all skills loaded during the target session. Two patterns to search for in the transcript:
   - Tool output: `[skill_view] name=<skill-name>` (tool_name=skill_view in assistant messages)
   - Tool call arguments: `{"name":"<skill-name>"}` where function.name=skill_view
   
   Use `session_search(session_id=..., role_filter="tool,assistant")` to find skill_view calls and tool responses. Deduplicate — a skill loaded multiple times counts once. If the session was compacted (context summary), skills may be lost from the visible transcript; in that case ask the user to confirm which skills were used.

3. **Verify relevance**: Skip reflection for skills that had zero pain points (no corrections, no workarounds, no errors). State why and move to the next skill.

### Phase 2: Extract user intent

From the session transcript, determine what the user *actually wanted* by analyzing:
- The initial request (what was asked)
- User corrections during the session ("no, I meant...", "that's not right", "do it differently")
- Final outcome vs. stated goal — did we deliver what was requested?

Flag intent mismatches where the agent followed the skill faithfully but still produced something that didn't match user intent — this indicates the skill is encoding the wrong approach.

### Phase 3: Identify skill gaps

For each skill under review, scan the transcript for evidence of gaps:

**Signal types (ranked by evidence strength):**
1. **User correction**: User explicitly corrected something the agent did while following the skill. Strongest signal — the skill led to wrong behavior.
2. **Workaround applied**: Agent deviated from the skill's prescribed steps and found an alternative that worked. Signals a missing or incorrect step.
3. **Error + retry**: Agent followed the skill, hit an error, then fixed it by doing something outside the skill. Signals a missing pitfall or edge case.
4. **Silent friction**: Extra tool calls or exploratory steps that weren't in the skill but were necessary. Weak signal — may be environmental, not skill-related.

**Document each gap as:**
- Evidence: which transcript messages show the problem
- Gap type: correction / workaround / error / friction
- Affected skill step or section
- Proposed fix: specific text to add or change

### Phase 4: Propose and apply patches

For skills with at least one meaningful gap (correction, workaround, or error):

1. **Draft the proposal**: For each gap, write a concrete `skill_manage(action='patch')` with `old_string` and `new_string`. Changes should be minimal — add a missing pitfall, clarify ambiguous wording, fix an incorrect command. Never rewrite entire sections.

2. **Present to user**: Show a summary of proposed changes:
   ```
   ## Reflection Results

   **Skill**: `<skill-name>`
   **Session**: `<session-id or "current">`

   ### Gap 1: <short description>
   - Evidence: "<quote from transcript>"
   - Proposed change:
     ```diff
     - old text
     + new text
     ```

   Type "apply" to apply this change, or skip to the next proposal.
   ```

3. **Apply only on explicit confirmation**: Wait for the user to say "apply" (or equivalent). Do NOT auto-apply anything. Call `skill_manage(action='patch', name=<skill>, old_string=<old>, new_string=<new>)`. Report success or failure.

4. **Rejection is silent**: If the user declines a proposal, move on. Do not log, store, or revisit it.

## Common Pitfalls

1. **Over-interpreting intent**. User said "make it faster" which could mean performance, brevity, or fewer clicks. Propose changes that address multiple interpretations narrowly rather than rewriting based on your guess.

2. **Proposing too many changes at once**. Present one patch per proposal. Batch proposals overwhelm the user and reduce acceptance rate.

3. **Changing skills for environment-specific issues**. A command that failed because a tool wasn't installed on the user's machine is not a skill bug — don't encode environmental constraints into the skill.

4. **Confusing skill gaps with agent reasoning failures**. If the skill was clear but the agent misread it, the fix is to make the skill more unambiguous, not to add more steps.

5. **Reflecting on noise**. One-off tasks where everything worked don't produce actionable insights. Only reflect when there's evidence of a gap.

6. **Context compaction erases evidence**. Long sessions get compacted (context window summary), which discards the full message history. If the session was compacted, skill loading events and user corrections may no longer be in the visible transcript — only summarized as "Completed Actions N." Always check for `[CONTEXT COMPACTION]` markers before proceeding; if present, warn the user that reflection will be partial and ask whether to proceed anyway.

7. **Missing technical workaround patterns**. When the agent had to use a non-standard approach (Python chunked writing for large files, shell heredocs instead of native tools, manual file restoration after accidental overwrite), these are valuable signals. Document them in the relevant skill as "patterns to recognize" — e.g., "Large file generation: when building files >20KB, use Python scripts with sequential write() instead of single native tool calls that hit truncation limits."

## Verification Checklist

- [ ] Target session resolved correctly
- [ ] Skills loaded during session identified
- [ ] User intent extracted and compared to outcome
- [ ] Gaps classified by evidence strength (correction > workaround > error > friction)
- [ ] Each proposal is a minimal patch, not a rewrite
- [ ] Proposals presented one at a time with transcript evidence quoted
- [ ] No auto-apply — every change requires explicit user confirmation
- [ ] Rejected proposals discarded without logging