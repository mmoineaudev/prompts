---
name: skill-reflection
description: "Reflect on a past or current session to evaluate whether used skills or workflows should be enhanced. Extracts user intent, identifies gaps between guidance and actual workflow, then proposes targeted improvements for user confirmation."
version: 0.3.0
author: Hermes Agent
license: MIT
metadata:
  tags: [reflection, meta, improvement, session-review]
---

# Skill & Workflow Reflection

## Overview

After completing a task, the skills or workflows used may have gaps — missing steps, ambiguous wording, or uncovered edge cases. This methodology analyzes a session's transcript to extract what the user *actually wanted*, compares it against what was *done* following loaded guidance, and proposes targeted improvements where the guidance failed.

Every proposal requires explicit user confirmation before being applied. Rejected proposals are discarded with no side effects.

## When to Use

- User asks to reflect on a session: "reflect on this session", "reflect on how we handled X"
- User explicitly names a skill or workflow to reflect on
- User says "should we improve that?" after completing a task

Don't use for:
- Routine tasks where everything went smoothly with no corrections, workarounds, or errors
- Sessions where no guidance was loaded (nothing to reflect on)
- Real-time mid-task adjustments (this is post-hoc analysis only)

## Workflow

### Phase 1: Resolve target session and scope

1. **Determine session**: If user says "this session" or "current", use the active conversation. Otherwise, locate the session transcript by searching conversation history for the topic or session ID.

2. **Determine guidance to reflect on**: If user names a specific skill/workflow, reflect only that one. Otherwise, identify all guidance loaded or followed during the target session from the transcript. Deduplicate — something loaded multiple times counts once. If the session was truncated (context window limit), guidance loading events may be lost; ask the user to confirm what was used.

3. **Verify relevance**: Skip reflection for guidance that had zero pain points (no corrections, no workarounds, no errors). State why and move to the next item.

### Phase 2: Extract user intent

From the session transcript, determine what the user *actually wanted* by analyzing:
- The initial request (what was asked)
- User corrections during the session ("no, I meant...", "that's not right", "do it differently")
- Final outcome vs. stated goal — did we deliver what was requested?

Flag intent mismatches where the guidance was followed faithfully but still produced something that didn't match user intent — this indicates the guidance is encoding the wrong approach.

### Phase 3: Identify gaps

For each item under review, scan the transcript for evidence of gaps:

**Signal types (ranked by evidence strength):**
1. **User correction**: User explicitly corrected something done while following the guidance. Strongest signal — the guidance led to wrong behavior.
2. **Workaround applied**: The approach deviated from the prescribed steps and found an alternative that worked. Signals a missing or incorrect step.
3. **Error + retry**: Followed the guidance, hit an error, then fixed it by doing something outside the guidance. Signals a missing pitfall or edge case.
4. **Silent friction**: Extra steps or exploratory work that weren't in the guidance but were necessary. Weak signal — may be environmental, not guidance-related.

**Document each gap as:**
- Evidence: which transcript messages show the problem
- Gap type: correction / workaround / error / friction
- Affected step or section
- Proposed fix: specific text to add or change

### Phase 4: Propose and apply patches

For items with at least one meaningful gap (correction, workaround, or error):

1. **Draft the proposal**: For each gap, write a concrete change. Changes should be minimal — add a missing pitfall, clarify ambiguous wording, fix an incorrect command. Never rewrite entire sections.

2. **Present to user**: Show a summary of proposed changes:
   ```
   ## Reflection Results

   **Item**: `<name>`
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

3. **Apply only on explicit confirmation**: Wait for the user to say "apply" (or equivalent). Do NOT auto-apply anything. Report success or failure.

4. **Rejection is silent**: If the user declines a proposal, move on. Do not log, store, or revisit it.

## Common Pitfalls

1. **Over-interpreting intent**. User said "make it faster" which could mean performance, brevity, or fewer clicks. Propose changes that address multiple interpretations narrowly rather than rewriting based on your guess.

2. **Proposing too many changes at once**. Present one patch per proposal. Batch proposals overwhelm the user and reduce acceptance rate.

3. **Changing guidance for environment-specific issues**. A command that failed because a tool wasn't installed on the user's machine is not a guidance bug — don't encode environmental constraints.

4. **Confusing gaps with reasoning failures**. If the guidance was clear but it was misread, the fix is to make it more unambiguous, not to add more steps.

5. **Reflecting on noise**. One-off tasks where everything worked don't produce actionable insights. Only reflect when there's evidence of a gap.

6. **Context truncation erases evidence**. Long sessions may lose message history. If the session was truncated, guidance loading events and user corrections may no longer be visible. Always check for truncation markers before proceeding; if present, warn the user that reflection will be partial and ask whether to proceed anyway.

7. **Missing technical workaround patterns**. When a non-standard approach was necessary (chunked writing for large files, shell workarounds, manual file restoration after accidental overwrite), these are valuable signals. Document them as "patterns to recognize."

## Verification Checklist

- [ ] Target session resolved correctly
- [ ] Guidance items loaded during session identified
- [ ] User intent extracted and compared to outcome
- [ ] Gaps classified by evidence strength (correction > workaround > error > friction)
- [ ] Each proposal is a minimal change, not a rewrite
- [ ] Proposals presented one at a time with transcript evidence quoted
- [ ] No auto-apply — every change requires explicit user confirmation
- [ ] Rejected proposals discarded without logging
