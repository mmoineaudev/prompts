---
name: clean-code-java-industrial
description: Complete methodology for building industrial-grade Java applications based on Robert C. Martin's Clean Code — covers SOLID, naming, functions, testing, architecture, concurrency, code smells, and implementation workflows.
version: 1.0
tags: [java, clean-code, solid, tdd, refactoring, architecture, code-review]
---

# Clean Code Java — Industrial-Grade Application Methodology

Based on Robert C. Martin's "Clean Code" adapted for professional Java development. Use this skill when building, reviewing, or refactoring any Java application that requires production-quality code.

## Trigger Conditions
- Building a new Java project or module
- Code review of Java codebases
- Refactoring legacy Java code
- Architectural decisions about class design, testing, or system structure
- Any task involving "industrial-grade", "production", or "professional" Java development

---

## Core Philosophy (Ch. 1)

### The Reading Ratio
Code is read **10:1** compared to writing over a system's lifetime. Optimize for readability, not write speed.

### Boy Scout Rule
Always leave the codebase cleaner than you found it. Fix naming inconsistencies, extract long functions, remove duplication — every time you touch a file.

### Professional Attitude
Clean code is not optional polish. It is the defining characteristic of a software professional. Refuse to ship knowingly sloppy code.

---

## SOLID Principles (Ch. 10b)

| Principle | Rule |
|-----------|------|
| **SRP** | A class has one, and only one, reason to change |
| **OCP** | Open for extension, closed for modification — add behavior via new code, not modification |
| **LSP** | Subtypes must be substitutable for base types without altering correctness |
| **ISP** | Prefer many small, specific interfaces over one fat interface |
| **DIP** | Depend on abstractions, not concretions — high and low-level modules both depend on interfaces |

### Class Design Checklist
- Single responsibility? One clear reason to change?
- Cohesive? All methods manipulate the class's fields?
- Small? Under ~100 methods, ideally much less
- Well-named? Specific nouns, not generic "Manager/Processor/Data"
- Low coupling? Depends on abstractions, not concrete classes
- Encapsulated? Implementation details hidden from clients

---

## Meaningful Names (Ch. 2)

### Java Naming Conventions
| Element | Convention | Example |
|---------|-----------|---------|
| Class/Interface | PascalCase | `OrderValidator`, `PaymentGateway` |
| Method | camelCase | `calculateTotal()`, `findByName()` |
| Variable | camelCase | `firstName`, `orderCount` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS` |
| Package | lowercase.dots | `com.example.orderservice` |
| Enum constants | UPPER_SNAKE_CASE | `RED`, `BLUE`, `GREEN` |

### Key Rules
- **Intent-revealing**: A name should answer why it exists, what it does, how it's used
- **Avoid disinformation**: No `accountList` when it's a `Map`; no hacker slang
- **Meaningful distinctions**: Every word distinguishes this entity from every other
- **Pronounceable**: Support verbal communication in standups and reviews
- **Searchable**: Avoid single letters (`a`, `b`) and magic numbers
- **No encodings**: No Hungarian notation, no type/scope prefixes — IDEs provide this
- **Domain language**: Use the ubiquitous language of the business domain
- **Don't be cute**: Humor does not aid comprehension

---

## Functions (Ch. 3)

### Size Rules
- Ideally under **20 lines**
- Indentation depth: max **1–2 levels**
- One level of abstraction per function — all statements below the function name's abstraction level

### Do One Thing
Signs a function does more than one thing:
- Verbs in the name (`getAndFormatUser`)
- An `if` where both branches do fundamentally different things
- Helper functions called only once from within

### Arguments
| Count | Guidance |
|-------|----------|
| 0 | Purest — preferred |
| 1 | Common and clear |
| 2 | Acceptable for pairs |
| 3 | Maximum — use with caution |
| 4+ | Use a parameter object or builder |

### Anti-Patterns
- **Flag arguments** (boolean params): loudly declare the function does more than one thing — split into separate functions
- **Output parameters**: counterintuitive — return values or modify the object itself
- **Side effects**: no hidden mutations, no implicit logging, no undeclared exceptions

### Command-Query Separation
Functions either **do something** (command) or **answer something** (query), never both.

---

## Comments (Ch. 4)

### Primary Rule
Comments are failures to make code self-explanatory. Rewrite the code first.

### Good Comments (Rare)
- Legal comments (license headers, copyrights)
- TODOs for future decisions
- Amplification of important significance
- Warning about unusual but intentional behavior

### Bad Comments (Delete)
- Mumbling — vague or obvious statements
- Redundant — repeating what code already says
- Misleading — saying something different from what the code does
- Journal comments — version control is for history
- Closing brace comments (`} // end if`)
- Commented-out code — source control preserves it

### Javadoc Rules
- Every public class, interface, method, and field should have Javadoc
- Document `@param`, `@return`, `@throws` for all public APIs
- Use `{@inheritDoc}` to avoid duplication
- Explain **why**, not **what**

---

## Formatting (Ch. 5)

### Standards
| Decision | Recommendation |
|----------|---------------|
| Indentation | 4 spaces (never tabs) |
| Line length | Max 120 characters |
| Brace placement | K&R style (opening brace same line) |
| Blank lines | Separate logical sections, functions, class members |
| Method order | Public → protected → private |
| Field order | Static fields first, then instance fields |
| Imports | Wildcard imports for packages with 2+ classes |

### Vertical Formatting
- Related concepts close together; unrelated far apart
- Variables declared near first use
- Private methods below the public method that calls them

---

## Objects and Data Structures (Ch. 6)

| Aspect | Objects | Data Structures |
|--------|---------|-----------------|
| Purpose | Hide data, expose behavior | Expose data, no meaningful behavior |
| Encapsulation | Yes — private fields, public methods | No — public fields |
| Use case | Domain logic, business rules | Data passing between layers (DTOs) |

### Key Rules
- Objects hide data and expose behavior
- Avoid anemic domain models — give domain objects meaningful behavior
- No gratuitous getters/setters that just expose internal state
- DTOs are fine for data transfer; domain logic needs rich objects
- Avoid "train wrecks" (`a.getB().getC().doSomething()`)

---

## Error Handling (Ch. 7)

### Principles
1. **Use exceptions over return codes** — keep normal flow clean
2. **Provide context** — meaningful messages, preserve original cause with `initCause()`
3. **Accept and throw in same context** — don't catch just to re-throw unchanged
4. **Don't return null** — use empty collections or `Optional<T>` instead
5. **Design exception hierarchy** — checked for recoverable, unchecked for programming errors
6. **Use try-with-resources** — automatic cleanup without boilerplate
7. **Fail fast** — validate inputs at method boundaries

### Patterns
- **Fail-fast**: Validate inputs immediately with clear error messages
- **Exception translation**: Catch low-level exceptions, translate to domain-appropriate ones

---

## Boundaries (Ch. 8)

### Third-Party API Management
1. **Create boundary classes** — wrap third-party APIs behind clean interfaces
2. **Don't leak third-party objects** — keep them on the other side of the boundary
3. **Use dependency injection** — inject boundary implementations for testability
4. **Adapter pattern** — translate between your interface and theirs

---

## Unit Tests (Ch. 9)

### F.I.R.S.T. Principles
| Principle | Description |
|-----------|-------------|
| **F**ast | Run quickly so developers run them frequently |
| **I**ndependent | No dependencies on each other; order doesn't matter |
| **R**epeatable | Same results in any environment (CI, dev machine, prod) |
| **S**elf-Validating | Boolean pass/fail — no manual inspection |
| **T**imely | Written just before production code (TDD) |

### Test Structure: Arrange-Act-Assert (AAA)
```java
@Test
void shouldReturnDiscountedPriceForPremiumCustomer() {
    // Arrange
    Customer customer = new Customer("premium");
    PriceCalculator calculator = new PriceCalculator(customer);

    // Act
    BigDecimal result = calculator.calculate(price);

    // Assert
    assertEquals(expectedDiscounted, result);
}
```

### Test Rules
- **One concept per test** — each test verifies exactly one behavior
- **Minimize assertions** — ideally one assertion per test
- **Descriptive names** — follow pattern: `should<expectedBehavior>When<condition>`
- **Use parameterized tests** for multiple input-output pairs
- **Test boundary conditions** explicitly
- **Aim for 80%+ line coverage**, focus on branch coverage
- **Tests should be fast** — slow tests won't be run frequently

---

## Systems Architecture (Ch. 11)

### Core Principles
1. **Separate construction from use** — `main()` builds and wires; application uses
2. **Dependency Injection** — invert control of dependency resolution
3. **POJOs** — domain logic free of framework dependencies
4. **AOP for cross-cutting concerns** — persistence, transactions, security via declarative mechanisms
5. **Test-drive the architecture** — start simple, evolve incrementally
6. **Postpone decisions** — make choices at the last responsible moment
7. **Use DSLs** — raise abstraction level with fluent APIs

---

## Emergent Design (Ch. 12)

### Four Rules of Simple Design (in order of importance)
1. **Runs all the tests** — a design that passes all tests is a working design
2. **Contains no duplication** — the primary enemy of good design
3. **Expresses intent** — code communicates clearly to readers
4. **Minimizes classes and methods** — prevents over-engineering (but never at expense of rules 1–3)

### Emergent Process
1. Write a failing test (Rule 1)
2. Write simplest code to pass (Rule 1)
3. Refactor to eliminate duplication (Rule 2)
4. Improve naming and structure for clarity (Rule 3)
5. Check for unnecessary classes/methods (Rule 4)
6. Repeat

---

## Concurrency (Ch. 13)

### Defense Principles
- **SRP for concurrency** — keep thread management in dedicated classes
- **Limit shared data scope** — minimize synchronization points
- **Prefer immutability** — immutable objects are inherently thread-safe
- **Independent threads** — each thread operates with local variables only
- **Use `java.util.concurrent`** — `ExecutorService`, `ConcurrentHashMap`, `Atomic*`, `BlockingQueue`, etc.
- **Keep synchronized sections small** — minimize lock hold time

### Testing Threaded Code
- Treat spurious failures as candidate threading issues
- Run with more threads than processors to encourage task switching
- Instrument code with `Thread.yield()` and `Thread.sleep()` in tests

---

## Successive Refinement (Ch. 14)

### Core Message
> "It is not enough for code to work. Code that works is often badly broken."

- Bad code rots over time, creating tangled dependencies
- Cleaning a mess from this morning takes minutes; from five minutes ago takes seconds
- **Key: continuously keep code as clean as possible — never let the rot start**

### Refactoring Heuristics
1. Extract methods that do one thing
2. Rename variables to reveal intent
3. Move methods to appropriate classes
4. Create exceptions for error conditions
5. Apply design patterns (Template Method, Strategy)
6. Eliminate duplication at every opportunity

---

## Code Smells & Heuristics (Ch. 17) — Quick Reference

### Functions (F1–F4)
- **F1**: Too many arguments (>3 requires justification)
- **F2**: Output parameters are counterintuitive
- **F3**: Flag arguments mean the function does more than one thing
- **F4**: Dead functions should be deleted

### General (G1–G37 Key Ones)
- **G5**: Duplication — the most important rule
- **G6**: Code at wrong level of abstraction
- **G9**: Dead code — delete it
- **G14**: Feature envy — method uses more of another class's data than its own
- **G20**: Function names should say what they do
- **G23**: Prefer polymorphism to if/else or switch/case
- **G25**: Replace magic numbers with named constants
- **G28**: Encapsulate conditionals in named methods
- **G29**: Avoid negative conditionals — use positive ones
- **G30**: Functions should do one thing
- **G33**: Encapsulate boundary conditions in one place
- **G34**: Functions should descend only one level of abstraction
- **G36**: Avoid transitive navigation (Law of Demeter)

### Names (N1–N7)
- **N1**: Choose descriptive names — they are 90% of readability
- **N6**: Avoid encodings (Hungarian notation, type prefixes)
- **N7**: Names should describe side-effects

### Tests (T1–T9)
- **T1**: Insufficient tests — test everything that could break
- **T3**: Don't skip trivial tests
- **T5**: Test boundary conditions explicitly
- **T9**: Tests should be fast

---

## Swing Desktop Pitfalls (Common Gotchas)

### JDialog lacks putClientProperty/getClientProperty
JDialog extends Window, not JComponent. `putClientProperty()` and `getClientProperty()` are **not available** on JDialog instances. If you need to store references to child components:

```java
// WRONG — won't compile:
this.putClientProperty("key", value);  // JDialog has no such method

// CORRECT option A — instance fields assigned in initUI():
private JTextArea promptText;
private void initUI() { promptText = new JTextArea(); ... }

// CORRECT option B — HashMap work-around:
private final Map<String, Object> _uiRefs = new java.util.HashMap<>();
_uiRefs.put("key", value);  // retrieve with: (Type) _uiRefs.get("key")
```

### Java Record Accessor Naming Drift
When generating or patching code from a reference implementation, **always verify exact field/method names on records before writing patches**. Generated code often assumes simpler names that don't match the actual record definition. Examples of this trap:

| Assumed name | Actual accessor | Source |
|---|---|---|
| `outputSize()` | `outputSizeBytes()` | RunResult |
| `usedMB` | `usedMB()` | RamState (record needs parentheses) |
| Field shadowing local var in initUI() | Assign to instance field directly | JDialog pattern |

**Rule:** Before writing any patch that touches a record accessor, read the actual record definition in source to confirm method names and access style.

## Implementation Workflow

### When Starting a New Java Project
1. Define domain language with stakeholders before writing code
2. Set up project structure: `src/main/java`, `src/test/java` with matching packages
3. Configure build tool (Maven/Gradle) with test reporting and coverage
4. Establish formatting rules — use Google Java Format, Checkstyle, or Spotless

### When Implementing a Feature
1. Write the failing test first (TDD approach preferred)
2. Implement the simplest code to pass
3. Refactor: extract methods, rename for intent, eliminate duplication
4. Apply SOLID principles during design decisions
5. Ensure no null returns, proper exception handling, clean boundaries

### When Reviewing Code
Use this checklist:

**Before Commit:**
- [ ] Names reveal intent (no vague or misleading names)
- [ ] Functions are small (<20 lines ideal, <50 max)
- [ ] Each function does one thing at one abstraction level
- [ ] No magic numbers — named constants used
- [ ] Error handling uses exceptions, not return codes
- [ ] No null returns — Optional or empty collections
- [ ] Consistent formatting applied
- [ ] Javadoc present for public APIs
- [ ] All tests pass

**Architecture & Design:**
- [ ] SOLID principles followed
- [ ] Appropriate design patterns applied (not over-engineered)
- [ ] No code duplication (DRY)
- [ ] Proper use of generics and type safety
- [ ] Thread safety addressed if applicable
- [ ] Third-party APIs wrapped in boundary classes
- [ ] Dependency injection used for testability

---

## Design Patterns Reference

| Pattern | When to Use |
|---------|-------------|
| **Strategy** | Interchangeable algorithms behind a common interface |
| **Factory** | Object creation delegation, hide instantiation complexity |
| **Builder** | Complex objects with many parameters |
| **Adapter** | Wrap third-party APIs behind clean interfaces |
| **Template Method** | Generalize similar algorithms with variation points |

---

## Key Values to Internalize

> "Clean code is not written by following a set of rules. You don't become a software craftsman by learning a list of heuristics."

- **Professionalism**: Taking pride in your workmanship
- **Craftsmanship**: Commitment to quality over speed
- **Discipline**: Consistent application of clean code practices
- **Care**: Treating every line of code as worthy of attention

---

*Reference: Clean Code (Ch. 1–14, 17) by Robert C. Martin. Full methodology source at ~/Models/CUR/final_uncle_bob.md*