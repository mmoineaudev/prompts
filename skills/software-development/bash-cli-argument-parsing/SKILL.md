---
name: bash-cli-argument-parsing
description: Patterns, pitfalls, and best practices for building robust CLI argument parsers in bash. Covers case statement ordering, shift loop bugs, named vs positional arg resolution, multi-line value parsing, and variable extraction — lessons learned from debugging real CLI tools.
version: 1.0.0
author: Hermes Agent
tags: [bash, cli, argument-parsing, shell-scripts]
---

# Bash CLI Argument Parsing

## Critical Pitfalls (Learned Through Trial & Error)

### 1. Case Statement Ordering — Specific BEFORE Wildcard

Bash `case` checks patterns in ORDER. A wildcard pattern like `--*)` will match ANYTHING starting with `--`, including specific flags you defined later.

```bash
# WRONG: --prompt is captured by --*) before it reaches --prompt)
case "$1" in
    --model) shift 2 ;;
    --*)     # matches --prompt too!
        ...
        ;;
    --prompt)   # NEVER REACHED
        PROMPT_NAME="$2"
        shift 2
        ;;
esac

# CORRECT: specific patterns first, wildcards last
case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --model)   OVER_MODEL="$2"; shift 2 ;;
    --prompt)  PROMPT_NAME="$2"; shift 2 ;;
    --*)       # wildcard LAST — catches unknown flags
        ...
        ;;
esac
```

**Rule:** Always list specific `--flag)` patterns BEFORE any `--*)` or `-*)` wildcards.

### 2. The Double-Shift Loop Bug

When using `while (( i < $# ))` with shifts inside the case AND at the end of the loop, arguments get skipped:

```bash
# WRONG: shifts happen twice per iteration (case + loop-end)
parse_args() {
    local i=0
    while (( i < $# )); do
        case "$1" in
            --dry-run) DRY_RUN=1; shift ;;  # shift 1
        esac
        shift  # another shift! Total: 2 shifts per iteration
        (( i++ )) || true
    done
}

# CORRECT: use $# directly, single shift per consumed arg
parse_args() {
    while (( $# > 0 )); do
        case "$1" in
            --dry-run) DRY_RUN=1; shift ;;   # only consumes the flag
            --model) OVER_MODEL="$2"; shift 2 ;;  # consumes flag + value
            -*) warn "Unknown flag: $1"; exit 1 ;;
            *) COMMAND_TYPE="$1"; shift ;;    # consumes positional arg
        esac
    done
}
```

**Rule:** Prefer `while (( $# > 0 ))` over index-based loops. Each case should shift exactly the number of args it consumes.

### 3. Named vs Positional Arg Priority

Named args (`--key=value`) must be processed BEFORE positional args, otherwise positional mapping will consume named flags as values:

```bash
# WRONG: positional args grab --code=/path as a value
resolve_variables() {
    local args=("$@")
    # This assigns "--code=/path" to the first variable!
    RESOLVED_VARS["code"]="${args[0]}"  # BAD
}

# CORRECT: extract named flags first, then fill remaining from positional
resolve_variables() {
    local args=("$@")
    
    # Step 1: Extract --key=value pairs FIRST (highest priority)
    for (( i=0; i<${#args[@]}; i++ )); do
        if [[ "${args[$i]}" =~ ^--([a-zA-Z_][a-zA-Z0-9_-]*)=(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            RESOLVED_VARS["$key"]="$val"
        fi
    done
    
    # Step 2: Fill remaining vars from non-flag positional args
    local pos_args=()
    for a in "${args[@]}"; do
        [[ "$a" =~ ^-- ]] && continue  # skip named flags
        pos_args+=("$a")
    done
    # ... map pos_args to remaining variables
}
```

### 4. Bash Variable Substitution Direction

`${var//_/-}` replaces ALL underscores with hyphens (CORRECT).
`${var//-/_}` replaces ALL hyphens with nothing (NOT underscores-to-hyphens!).

The pattern syntax is `${var//PATTERN/REPLACEMENT}` — the `/` in replacement is literal, not a separator.

```bash
var="focus_areas"
echo "${var//_/-}"   # "focus-areas" ✓ CORRECT
echo "${var//-/_}"   # "focus_areas" ✗ WRONG (replaces hyphens with nothing)
echo "${var/_/-}"    # "focus-areas" ✓ replaces only first occurrence
```

### 5. Avoid grep -oP for Variable Extraction

Perl regex (`grep -oP`) is unreliable in bash scripts, especially on systems without GNU grep:

```bash
# WRONG: may fail silently or not be available
vars=$(grep -oP '\{[a-z_]+\}' "$file" | tr -d '{}')

# CORRECT: use bash regex matching
combined="$PT_SYSTEM $PT_USER"
tmp="$combined"
found_vars=()
while [[ "$tmp" =~ \{([a-zA-Z_][a-zA-Z0-9_]*)\} ]]; do
    found_vars+=("${BASH_REMATCH[1]}")
    tmp="${tmp#*\{$var\}}"  # advance past this match
done
```

## Multi-Line Value Parsing in INI-like Configs

When parsing config files with multi-line values (like system/user prompts spanning multiple lines), accumulate content until hitting a new key=value or blank line:

```bash
parse_template() {
    local section="header"
    local accumulated=""
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Strip comments and trim whitespace
        line="${line%%#*}"
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        [[ -z "$line" ]] && continue
        
        # Detect section start (new key=value)
        if [[ "$line" =~ ^system_prompt[[:space:]]*=[[:space:]]*(.+) ]]; then
            # Flush previous accumulated content
            [[ -n "$accumulated" ]] && PT_SYSTEM="$accumulated"
            accumulated="${BASH_REMATCH[1]}"  # start accumulating
            section="system"
            continue
        fi
        
        # Continuation line (append to current section)
        if [[ -n "$accumulated" ]]; then
            accumulated+=$'\n'"$line"
        fi
    done < "$file"
    
    # Flush remaining content
    [[ "$section" == "system" && -n "$accumulated" ]] && PT_SYSTEM="$accumulated"
}
```

## Complete parse_args Template

A robust, production-ready argument parser template:

```bash
parse_args() {
    while (( $# > 0 )); do
        case "$1" in
            --dry-run)   DRY_RUN=1; shift ;;
            --model)     OVER_MODEL="$2"; shift 2 ;;
            --prompt)    PROMPT_NAME="$2"; shift 2 || break
                         # collect remaining as positional
                         while (( $# > 0 )); do
                             POSITIONAL_ARGS+=("$1"); shift
                         done
                         return 0 ;;
            --*)         # wildcard LAST — handles unknown flags
                         if [[ "$1" =~ ^--.+=.+ ]]; then
                             POSITIONAL_ARGS+=("$1")
                             shift; continue
                         fi
                         warn "Unknown flag: $1"; exit 1 ;;
            start)       cmd_start; exit 0 ;;
            stop)        cmd_stop; exit 0 ;;
            prompt)      # subcommand
                         local subcmd="${2:-}"
                         case "$subcmd" in
                             create) cmd_create "${3:-}"; exit 0 ;;
                             list)   print_list; exit 0 ;;
                         esac ;;
            -*)          warn "Unknown flag: $1"; exit 1 ;;
            *)           [[ -z "$COMMAND_TYPE" ]] && COMMAND_TYPE="$1" || POSITIONAL_ARGS+=("$1")
                         shift ;;
        esac
    done
}
```

## Testing Checklist

After implementing argument parsing, verify:

- [ ] `aug --dry-run explain 'ls -la'` → clean user prompt (no aug flags)
- [ ] `aug --model brain analyze 'test'` → server override works
- [ ] `aug --prompt review file.py 'security'` → positional vars resolve
- [ ] `aug --prompt review --code=file.py --focus=perf` → named args resolve
- [ ] `aug prompt list` → subcommand dispatch works
- [ ] `aug` (no command) → helpful error message

## Common Bash Gotchas Recap

| Issue | Cause | Fix |
|-------|-------|-----|
| Skipped arguments | Double-shift in loop | Use `while (( $# > 0 ))` with single shift per consumed arg |
| Flag not recognized | Wildcard `--*)` before specific pattern | Order: specific first, wildcard last |
| Variable not resolved | Named args treated as positional | Process named flags BEFORE positional mapping |
| Substitution wrong direction | `${var//-/_}` vs `${var//_/-}` | Remember: pattern comes first in `//PATTERN/REPLACEMENT` |
| grep extraction fails | `grep -oP` unavailable/unreliable | Use bash `=~` regex with `${BASH_REMATCH[]}` |
| Multi-line values truncated | Parser only reads single line | Accumulate until new key=value or blank line |
