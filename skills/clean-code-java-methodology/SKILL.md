---
name: clean-code-java-methodology
description: Clean Code methodology for Java development — applies Robert Martin's principles adapted for Java, covering naming, functions, SOLID, error handling, testing, refactoring, and modern Java features.
category: software-development
---

# Clean Code Java Methodology

Comprehensive reference for implementing clean Java code based on Robert C. Martin's "Clean Code".

## Reference Document

Full methodology guide: `~/Models/CUR/CleanCode_explained_merged.java.md` (~163KB, 20 chapters)

Read sections as needed during implementation. Use the Table of Contents for quick navigation.

## When to Apply

- Implementing new Java features or modules
- Refactoring existing Java codebases
- Code reviews of Java pull requests
- Designing class hierarchies and interfaces
- Writing unit tests for Java applications

## Implementation Workflow

### Phase 1: Design

1. **Define responsibilities**: Each class should have ONE reason to change (SRP)
2. **Design interfaces first**: Program to interfaces, not implementations
3. **Apply SOLID principles**: See Chapter 10b for detailed Java examples
4. **Partition concerns**: Separate I/O, business logic, data access, and presentation

### Phase 2: Implementation

1. **Meaningful names** (Chapter 2):
   - Intention-revealing names for classes, methods, variables
   - Avoid disinformation; don't use magic numbers
   - Use `is/has/does` prefixes for booleans; `Manager/Processor/Service` for nouns

2. **Small functions** (Chapter 3):
   - Functions should do ONE thing at ONE level of abstraction
   - Prefer <20 lines; ideally <10 lines
   - Boolean arguments are bad — extract methods instead
   - Side effects must be clearly named (`getCustomer` vs `fetchAndCacheCustomer`)

3. **Comments** (Chapter 4):
   - Code should explain itself; comments should explain WHY, not WHAT
   - Legal/credit comments are acceptable
   - TODOs must have owner and date; remove when done
   - Never use comments to explain bad code — refactor instead

4. **Formatting** (Chapter 5):
   - Consistent indentation (4 spaces), line length (~120 chars)
   - Related code grouped together with vertical whitespace between sections
   - Align assignments for readability

5. **Objects & Data Structures** (Chapter 6):
   - Hide implementation: objects expose behavior, data structures expose data
   - Procedural programming = data structures + algorithms
   - OO programming = objects with rich behavior
   - Favor DTOs over getters/setters; use records for immutable data

6. **Error handling** (Chapter 7):
   - Use exceptions, not error codes
   - Provide contextual information in exception messages
   - Throw specific exceptions; catch broadly only when appropriate
   - Validate inputs at entry points; fail fast

7. **Boundaries** (Chapter 8):
   - Third-party code is a boundary; write thin wrapper layers
   - Test boundaries thoroughly with isolated tests
   - Keep dependencies flowing one direction (DIP)

### Phase 3: Testing

1. **Unit tests** (Chapters 9, 15):
   - Every public method needs a test
   - Tests must be FAST (run in milliseconds)
   - Follow FIRST principle: Fast, Independent, Repeatable, Self-validating, Timely
   - Use descriptive test names: `should_` prefix or `MethodName_Condition_ExpectedResult`

2. **Test structure**:
   ```java
   @Test
   void shouldCalculateTotalWhenMultipleItemsAdded() {
       // Arrange
       ShoppingCart cart = new ShoppingCart();
       cart.addItem(new OrderItem("A", 10.0, 2));
       cart.addItem(new OrderItem("B", 5.0, 3));
       
       // Act
       Money total = cart.calculateTotal();
       
       // Assert
       assertEquals(Money.of(35.0), total);
   }
   ```

### Phase 4: Refactoring

1. **Successive refinement** (Chapter 14):
   - Write working code first, then clean it up
   - Small incremental changes; test after each step
   - Bad code rots — fix immediately, don't accumulate debt

2. **Common patterns** (Chapter 14b):
   - Extract Method: pull logic into named methods
   - Introduce Explaining Variable: clarify complex expressions
   - Replace Conditional with Polymorphism: eliminate branching
   - Extract Class: split large classes by responsibility
   - Rename Method/Class: make intent obvious

3. **Code smells** (Chapter 17):
   - Feature envy: method uses another class's data more than its own → move method
   - Data clump: same fields appear together everywhere → create new class
   - Long parameter list → introduce parameter object
   - Divergent change: one class changes for many reasons → split by SRP

### Phase 5: Modern Java (Chapter 18)

- Use `record` for immutable DTOs (Java 16+)
- Use `var` for local variables when type is obvious
- Prefer `Optional` over null returns
- Use `switch` expressions with pattern matching
- Leverage sealed classes for restricted hierarchies
- Use text blocks for multi-line strings

## Quick Checklist

Before committing Java code, verify:

- [ ] Class has single responsibility
- [ ] Methods are small (<20 lines) and do one thing
- [ ] Names reveal intent; no magic numbers or abbreviations
- [ ] No commented-out code; no TODOs without owner/date
- [ ] Exceptions used properly (not error codes)
- [ ] Inputs validated at entry points
- [ ] Unit tests cover all public methods
- [ ] Tests follow FIRST principle
- [ ] Dependencies flow one direction (DIP)
- [ ] Third-party libs wrapped in thin abstraction layers
- [ ] Modern Java features used where appropriate

## Loading the Full Reference

When you need detailed guidance on a specific topic, read the relevant chapter:

```bash
grep -n "^## Chapter" ~/Models/CUR/CleanCode_explained_merged.java.md
```

Then read the section starting from that line number.
