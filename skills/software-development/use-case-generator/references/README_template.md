# Use Case Library — [Project Name]

## Purpose and Scope

[One-paragraph description of what this system does, who it serves, and the business value it delivers. This is the vision statement that guides all scoping decisions.]

**Design scope:** [System name] — The software/hardware system being designed. Everything outside this boundary is an interface point (supporting actors).

## In/Out List

| Topic | In Scope | Out of Scope |
|-------|----------|--------------|
| [Example: Customer data entry] | Yes | [Example: Payment processing] |
| [Add more as needed] | | |

*Update this table as scope decisions are made during use case development.*

## Actor-Goal List

| Primary Actor | Goal Against System | Priority (1=highest) |
|--------------|---------------------|---------------------|
| [Actor name/role] | [Active verb goal phrase] | 1 |
| [Actor name/role] | [Active verb goal phrase] | 2 |
| [Add more actors and goals as discovered] | | |

**Priority key:** 1 = Must have in first release, 2 = Important, 3 = Nice to have, 4 = Future consideration

## Design Scope Drawing Description

```
┌─────────────────────────────────────────────┐
│                                             │
│              [System Name]                  │
│                                             │
│  ┌──────────┐    ┌──────────┐              │
│  │ Primary  │    │Primary   │              │
│  │ Actor 1  │    │Actor 2  │              │
│  └────┬─────┘    └────┬─────┘              │
│       │               │                    │
│       ▼               ▼                    │
│  ┌──────────────────────────┐              │
│  │                          │              │
│  │     [System Name]        │              │
│  │     (black box)          │              │
│  │                          │              │
│  └──────────┬───────────────┘              │
│             │                               │
│       ┌─────┴─────┐                        │
│       ▼           ▼                        │
│  ┌─────────┐ ┌─────────┐                  │
│  │Support- │ │Support- │                    │
│  │ing Actor│ │ing Actor│                    │
│  └─────────┘ └─────────┘                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Inside the box:** Everything the development team is responsible for designing and building.
**Outside the box:** Supporting actors (external systems, hardware, human groups) that the system interfaces with but does not control.

## Use Case Catalog

### Summary-Level Use Cases (0_summary/)

| ID | Name | Primary Actor | Description |
|----|------|--------------|-------------|
| UC-01 | [Name] | [Actor] | [One-sentence summary of the overarching goal] |

### User-Goal Level Use Cases (1_user_goals/)

| ID | Name | Primary Actor | Priority | MSS Steps |
|----|------|--------------|----------|-----------|
| UC-XX | [Name] | [Actor] | 1/2/3/4 | N steps |

### Subfunction-Level Use Cases (2_subfunctions/)

| ID | Name | Called From | Purpose |
|----|------|-------------|---------|
| UC-XX | [Name] | [Calling use case] | [Why it was extracted] |

## Goal Level Definitions

| Level | Symbol | Color | Altitude Metaphor | Typical Duration |
|-------|--------|-------|-------------------|------------------|
| Summary | 🪁 | White | Kite / Cloud | Hours to years |
| User-Goal | 🌊 | Blue | Sea level | 2-20 minutes (one sitting) |
| Subfunction | 🐟 | Indigo | Underwater / Fish | Partial goal step |
| Too Low | 🐚 | Black | Clam (in mud) | Merge into calling use case |

**The coffee break test:** After completing a user-goal use case, can the primary actor go away happy and take a coffee break? If yes, you have the right level.

## Notes on Use Case Development

- Use cases are written following Cockburn's 12-step recipe (see `use-case-generator` skill for details)
- All use cases pass the 31 quality assurance tests before being considered complete
- Extensions represent ALL known failure conditions and alternatives — brainstorm exhaustively
- Off-stage stakeholders (regulators, auditors, system owners) are listed explicitly to ensure their protections appear in the scenarios