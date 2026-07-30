---
name: single-file-js-audit
category: software-development
description: Systematic audit-and-fix workflow for large single-file JavaScript projects (30KB+, 1000+ lines) using Python-based static analysis, section matching, and targeted patching. Targets games/applications built iteratively across sessions.
---

# Single-File JS Audit & Fix Workflow

Use this skill when auditing and fixing large single-file JavaScript projects that exceed practical context inspection limits — especially iterative game projects (e.g., `index.html` with inline `<script>`).

## When to Trigger

- File is >20KB or >500 lines
- Code was built iteratively across multiple sessions (not written in one pass)
- User requests "review", "audit", "check for bugs", or similar
- After implementing major changes and before committing

## The 6-Step Audit Pipeline

### Step 0: Write-File Integrity Check (NEW — Pre-Audit)

**CRITICAL**: `write_file` can silently truncate on very large files (>50KB). Before auditing, verify the file's structural integrity:

```python
with open('index.html', 'r') as f:
    content = f.read()

# Check that closing tags are present (indicates complete write)
checks = {
    '</script>': 'JavaScript closing tag',
    '</body>': 'Body closing tag',
    '</html>': 'HTML document end',
}

for tag, label in checks.items():
    if tag not in content:
        print(f"❌ INCOMPLETE WRITE: Missing {tag} ({label})")
        # Recovery: append missing tags
        if '</script>' not in content:
            with open('index.html', 'a') as f:
                f.write('\n</script>\n</body>\n</html>\n')
            print("✅ Appended missing </script>, </body>, </html>")
        else:
            print(f"⚠️  {label} missing — may need manual inspection")
            break
    else:
        print(f"✅ {tag} present ({label})")

# Also verify script tag exists (no silent deletion of <script>)
if '<script>' not in content:
    print("❌ INCOMPLETE WRITE: Missing <script> opening tag!")
```

**Symptoms of truncated write**: Blank page, no console errors, `document.getElementById` returns null for canvas. The file may be partially written — missing the final closing tags entirely because write_file was interrupted or hit a size limit.

### Step 1: Syntax Validation

```python
import subprocess, re

with open('index.html', 'r') as f:
    html = f.read()
match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
if match:
    with open('/tmp/check.js', 'w') as f:
        f.write(match.group(1))
    result = subprocess.run(['node', '-c', '/tmp/check.js'], capture_output=True, text=True)
    print("JS syntax:", "OK" if result.returncode == 0 else f"ERROR: {result.stderr}")
```

**If syntax fails**: DO NOT proceed. Fix the broken syntax first before any audit.

### Step 2: Section Completeness Check

Extract top-level functions and var declarations using regex. Match against a known checklist of required sections (from implementation plan or skill reference).

```python
import re

with open('index.html', 'r') as f:
    lines = f.readlines()

top_funcs = []
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    m = re.match(r'(?:function\s+(\w+)|var\s+(\w+)\s*=\s*(?:function|null))', stripped)
    if m:
        top_funcs.append((i, m.group(1) or m.group(2)))

# Match against expected sections (load from implementation plan or known spec)
expected = ['parseLevel', 'isSolid', 'updatePlayer', 'resolveX', 'resolveY', ...]
found_names = [name for _, name in top_funcs]

for exp in expected:
    status = "✅" if exp in found_names else "❌ MISSING"
    print(f"  {status} {exp}")
```

**Pitfall**: Only check lines with NO indentation (true top-level). Nested function defs inside IIFEs or block scope will appear as declarations but are scoped.

### Step 3: Bracket & Paren Balance

```python
with open('index.html', 'r') as f:
    html = f.read()
print(f"Brackets: {{={html.count('{')}, }}={html.count('}')} {'OK' if html.count('{')==html.count('}') else 'MISMATCH!'}")
```

**Note**: Parenthesis counts include string literals and regex. Bracket balance is a reliable proxy for structural integrity in JS — unmatched `{}` almost always means broken scoping.

**If brackets mismatch**: This is usually caused by an incomplete patch from a prior session (the `patch` tool truncated content). Restore from git: `git checkout -- index.html`.

### Step 4: Targeted Bug Scan

Run targeted checks for common bug classes in single-file projects:

| Bug Class | What to Check | Detection Pattern |
|-----------|---------------|-------------------|
| Timer rate errors | `timer -= dt/FD` without `*60` multiplier | grep for `timer-=`, verify divisor |
| Dead code comments | `{/* comment */}` that says "in loadEnts" or "stays as..." but does nothing | Regex for empty `{/* */}` blocks with TODO-like text |
| String-only variable checks | Counting `(`/`)` in HTML attributes inflates counts — only count bracket pairs | Use bracket count, not paren count |
| Dead sections | Functions referenced by name in comments but never called | Cross-ref function list against call sites |
| Incomplete patch artifacts | Patched files often have truncated old_string if it spanned too many lines | Verify line count hasn't changed drastically after patch |
| Constructor `this.` missing | Class properties assigned without `this.` prefix create ReferenceErrors | Search for `\b\w+ = ` in constructor scope not prefixed with `this.` |
| Prototype method duplication | Same prototype method defined multiple times, later one shadows earlier | Count occurrences of `<ClassName>.prototype.<methodName>` |
| Parameter mismatch | Function declares params `a,b` but body uses `x,y` internally | Compare parameter names to variable usage inside function body |
| Entity loop `break` escape | `break;}` inside per-entity switch case exits outer entity loop | Look for `break;` followed by `}` on next line in for-loop context |
| Fixed timestep single-check | Game loop uses `if(accumulator>=dt)` instead of `while(...)` | Verify game loop uses `while` not `if` for accumulator check |

**Timer bug example** (very common):
```javascript
// BUG: timer -= dt/FD  → at 60fps, counts down 1 per frame = ~6.7 seconds for initial=400
timer-=dt/FD;          // ❌ WRONG
timer-=dt/(FD*60);     // ✅ CORRECT — decrements once per real second
```

### Step 5: Surgical Patching

Use targeted find-and-replace for fixes. Never rewrite the entire file.

**Best practices:**
- Match by a few surrounding lines of context
- Keep changes small and focused
- If a change fails, read the exact surrounding context and retry
- **Always verify bracket balance after each change**

### Step 6: Validate & Commit

```python
# Re-run steps 1-3 after patches to confirm everything is clean
# Then commit with descriptive message
```

## Common Pitfalls

1. **Large file truncation**: `read_file` and `patch` both have limits. For files >50KB, use offset/limit or Python scripts for analysis.
2. **Patch old_string too broad**: If the match spans >30 lines, the patch may truncate content. Keep replacements surgical.
3. **String-literal false positives**: Regex search for patterns like `timer-=` will match in comments and strings. Always verify context with surrounding lines.
4. **Dead code is subtle**: Comments like `{/* stays as QUESTION with mushroom spawn in loadEnts */}` look like implementation but do nothing. Spot them by looking for empty comment blocks that reference other functions or TODO intent.
5. **Paren mismatch ≠ bug**: `(=`/`)` counts include string content, regex patterns, and template literals. Only bracket (`{`/`}`) balance is a reliable structural integrity check.

## Bug Categories Specific to Single-File Game Projects

| Category | Description | Frequency |
|----------|-------------|-----------|
| Timer rate off by 60× | Using `dt/FD` instead of `dt/(FD*60)` for game time | High — accumulator uses ms, timer expects seconds |
| Power-up spawning dead code | Comments describe mushroom/star spawning but no actual entity push to array | Very high — common when skipping implementation details |
| Enemy pit deaths | Goombas turn at edges but never fall into wide gaps | Medium — often intentional (classic Mario behavior) |
| Section headers lost in IIFE | Functions wrapped in immediately invoked blocks appear top-level but are scoped | Low — check with indentation analysis |
| Pipe two-pass order bugs | Pipe body detection runs before pipe top detection, causing wrong tiles | Medium — common in level parsers |

## Post-Audit Deliverable

After completing all 6 steps, produce:

```markdown
## Audit Report: [filename]

### Pre-existing Status
- Total lines/size: X lines, Y KB
- Phases implemented: 1 through N (check off or skip)
- Syntax: ✅ Pass / ❌ Fail

### Bugs Found & Fixed
1. **[Bug title]** — [description of root cause and fix applied]
2. ...

### Remaining Issues (Low Priority)
- Item A: [description, why it's low priority]
- Item B: ...

### How to Test
- Instructions for manual testing if applicable
```

## Related Skills

See companion documentation on single-file game patterns, checklist-driven implementation, and code review.
