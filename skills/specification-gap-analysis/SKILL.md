---
name: specification-gap-analysis
description: |
  Before implementing any software from a specification or design prompt,
  systematically identify every underspecified aspect — missing values,
  ambiguous behaviors, unhandled edge cases, unstated contracts.
  Present findings and offer to resolve them automatically, biased
  toward ease of development and maintainability.
  Generic — works for games, backends, CLIs, APIs, frontends.
argument-hint: "[path/to/spec.md]"
---

# Specification Gap Analysis

## When to Use

- Before implementing anything from a spec or design document
- When a spec feels complete but likely has hidden gaps
- Before handing a spec to another developer or subagent
- As a pre-implementation quality gate

## Process

### Step 1: Read and understand the spec

Load the full specification. Understand: what is being built, target platform/stack, scope boundaries, and any existing implementation that can serve as reference.

### Step 2: Scan for open points

Go through the spec and identify EVERY underspecified aspect. Categories that apply universally:

**Interface / contracts**
- Input format, output format, error format — specified?
- API endpoints: method, path, request/response shapes, status codes?
- CLI: argument names, flags, exit codes, stdout/stderr conventions?
- Function signatures: parameter types, return types, null/undefined handling?
- Configuration: file format, schema, defaults, required vs optional?

**Behavior**
- Happy path fully described?
- Error paths: what happens on failure for each operation?
- Edge cases: empty input, max input, concurrent access, timeout, retry?
- State transitions: valid states, invalid transitions, initial state?
- Idempotency: repeated operations safe?
- Ordering: dependencies between operations?

**Data & storage**
- Schema: every field typed, nullable markers, constraints (max length, range)?
- Persistence: what survives restart? Format? Migration strategy?
- Validation: what rules, where enforced, what error on violation?
- Defaults: every config value has a documented default?

**Non-functional**
- Performance: latency budgets, throughput targets, resource limits?
- Security: auth model, threat assumptions, data sensitivity?
- Availability: uptime expectations, graceful degradation?
- Observability: logging, metrics, alerts?
- Scale: expected load, data volume, concurrency?

**Operational**
- Deployment: how is it deployed? Dependencies?
- Configuration: env vars, config files, secrets management?
- Health checks: how to verify it's running correctly?
- Rollback: how to undo a bad deployment?
- Backups: what data needs backing up?

**Edge cases**
- What happens when a dependency is unavailable?
- What happens on partial failure (some operations succeed, some fail)?
- Race conditions: what if two requests conflict?
- Resource exhaustion: disk full, memory exhausted, connection pool drained?

### Step 3: Present findings

Format each finding as:

```
| # | Category | What's missing | Suggested resolution |
|---|----------|---------------|---------------------|
```

Prioritize: project-specific concerns first (whatever the spec framework requires), then correctness (wrong behavior = bugs), then completeness, then polish.

### Step 4: Ask the user

Present findings and ask:

> "Found N open points. Would you like me to resolve them automatically (biased toward ease of development, maintainability, and avoiding over-engineering), or discuss them?"

### Step 5: Auto-resolve (if user says yes)

When resolving automatically:
- **Default**: the simplest thing that works. Less code, fewer features, forgiving defaults.
- **Bias toward**: ease of development, maintainability, avoiding premature optimization.
- **Error handling**: fail explicitly with clear messages, don't silently swallow.
- **Defaults**: sensible and documented. If unsure, pick the most common/conventional choice.
- **Deferred features**: explicitly mark as "post-MVP" or "future" rather than implementing half-baked.
- **Cross-reference**: if similar implementations exist, reuse their choices.

### Step 6: Write and commit

- Write the resolved spec (overwrite the original file)
- Keep original structure and intent
- Add concrete values to every TBD
- Document edge case handling explicitly
- Commit with a descriptive message listing every resolution

## Anti-patterns

- Don't add features the spec didn't ask for to fill gaps — mark them as "deferred" instead
- Don't over-specify implementation details that should be left to the developer
- Don't resolve by making the system more complex than necessary
- Don't skip edge cases because they're unlikely — they will happen