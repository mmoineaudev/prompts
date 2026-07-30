---
name: checklist-driven-implementation-workflow
description: Use when executing a structured implementation checklist — processing items one-by-one, marking completion, and committing progress incrementally. Triggers on "execute the checklist", "start implementing", "process the tasks from the spec", "work through the checklist".
version: 2.1.0
author: Hermes Agent
license: MIT
tags: [checklist, implementation, execution, workflow, version-control]
---

# Checklist-Driven Implementation Workflow

Systematic approach for implementing features from a structured checklist. Process items one-by-one, mark completion incrementally, and maintain clean version control.

## When to Use

- Implementing features from a detailed checklist (like Cockburn specifications)
- Large multi-step projects that require progress tracking
- Features with numbered implementation tasks to be completed sequentially

**Never use when:** The user wants planning or just checking status without execution.

## Agent Workflow

### Step 1: Review Checklist

Read the checklist to understand scope and ordering. Count pending items if needed.

### Step 2: Verify Implementation Tasks

Ensure each use case/feature section has implementation checkboxes. If missing, add them before starting:

```markdown
## Feature Section Title
- [ ] **Implement core functionality** ([Source Use Case](path.md))
  - [ ] Sub-item 1
  - [ ] Sub-item 2
```

### Step 3: Process Items Sequentially

For each unchecked item (`- [ ]`):

1. Implement the task
2. Mark it complete — replace `- [ ]` with `- [x]` for that specific line
3. Stage and commit changes

**Completion criterion:** Use case → Implementation checklist → Checkbox marked `[x]` → committed in version control.

### Step 4: Write Code Per Checklist Items

Follow the guidance from whichever planning methodology generated the checklist. Each item produces self-contained, testable changes.

## Best Practices

### Checklist Management
- Use `- [ ]` for pending items and `- [x]` for completed ones
- Mark tasks as `[x]` immediately upon completion (never in bulk)
- Keep commit messages specific to the task completed
- Reference task numbers in commit messages when helpful: `feat: implement task 3 — validation layer`

### Git Workflow

```bash
# Commit after each task
git add .
git commit -m "feat: implement [task description]"
git push   # if on a shared branch

# Group only truly related changes (same feature, same checklist item)
```

### Naming Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep descriptions clear and specific to the task completed
- Avoid vague messages like "changes" or "updates"

## Common Patterns

### Adding New Items During Implementation

When discovering new sub-tasks during implementation:
1. Add them as nested `- [ ]` items under the relevant section using `patch`
2. Insert before the closing separator of that section or at end of checklist

### Single-File Project Pattern

When implementing in a single large file (e.g., single-file HTML5 game):
- Structure with clear phase comment headers (`// Phase 1:`, `// Phase 2:`)
- Group related code sections logically
- Produce complete file updates at each major milestone rather than incremental changes
- Mark checklist items as `[x]` in bulk when a phase group is complete, noting any intentionally left-unchecked items with reasons

## Troubleshooting

**Issue:** Checklist items not visible or unclear
- Solution: Verify checkbox format is `- [ ]` (not `* [ ]`); ensure cross-references to source documents are present

**Issue:** Too many pending items
- Solution: Break larger items into sub-tasks using nested indentation; verify each new item has a clear objective and expected output

**Issue:** Failing to push due to conflicts
- Solution: Rebase onto current branch before committing, resolve conflicts per-task

## Example Session

```
1. Read checklist.md — 8 items pending
2. Implement task 1 (core model) using write_file/patch
3. patch checklist.md: replace `- [ ]` with `- [x]` for that item
4. git add . && git commit -m "feat: implement core model"
5. Repeat for tasks 2-8...
6. Final check: all items marked [x], no pending sub-tasks
```

## Verification Checklist

- [ ] All checklist items are `- [ ]` (pending) or `- [x]` (completed) — not other formats
- [ ] Each completed item has a corresponding commit with specific message
- [ ] No checklist item was marked `[x]` before the implementation was actually verified
- [ ] Cross-references to source documents (use cases, specs) are present for each item
- [ ] Final state: all items marked `[x]`, or remaining items are intentionally deferred with documented reasons
