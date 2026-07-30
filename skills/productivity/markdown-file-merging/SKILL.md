---
name: markdown-file-merging
description: Merge two markdown files into a single coherent document, eliminating duplication and maintaining consistent structure. Use when consolidating documentation from different sources or AI models covering the same topic.
tags: [markdown, documentation, merging, consolidation]
---

# Markdown File Merging and Consolidation

Merge two markdown files into a single coherent document, preserving content from both sources while eliminating duplication and maintaining consistent structure.

## When to Use

- Merging documentation written by different authors or AI models on the same topic
- Consolidating overlapping reference guides or tutorials
- Combining incremental documentation updates into a master document
- Any task where two markdown files cover similar topics with complementary details

## Approach

### Step 1: Analyze Both Files

Extract structure from both files to understand their organization:

```python
from hermes_tools import terminal, read_file

# Get chapter/section headers from both files
result_a = terminal("grep -n '^## ' path/to/file_a.md")
result_b = terminal("grep -n '^## ' path/to/file_b.md")

# Count lines and characters for size comparison
stats = terminal("wc -l file_a.md file_b.md && wc -c file_a.md file_b.md")
```

### Step 2: Read Both Files into Memory

```python
with open("path_a", "r") as f:
    content_a = f.read()
with open("path_b", "r") as f:
    content_b = f.read()
```

### Step 3: Extract Sections

Split each file into sections based on headers. Use a regex to find `## Chapter` or `## Part` headers, then extract the text between consecutive headers.

```python
import re

def extract_sections(content):
    """Split content into sections based on ## headers."""
    sections = []
    parts = re.split(r'^(?=## )', content, flags=re.MULTILINE)
    for part in parts:
        if '## ' in part:
            sections.append(part.strip())
    return sections
```

### Step 4: Map Sections by Topic

Compare section headers from both files to identify:
- **Matching topics**: Same chapter number or similar header text -> merge content
- **Complementary topics**: Unique to one file -> include as-is
- **Overlapping content**: Similar code examples or explanations -> deduplicate

### Step 5: Merge Strategy

For matching sections, prefer the more detailed version and selectively integrate unique content from the other. Use a Python script with `write_file` to build the merged output:

```python
# Pseudocode for merge logic
merged = [header]
for chapter in original_chapters:
    merged.append(chapter)
    carnice_match = find_matching_section(carnice_sections, chapter)
    if carnice_match:
        unique_content = extract_unique_blocks(carnice_match, chapter)
        merged.append(unique_content)
    else:
        # No match in original - check if complementary
        pass

for section in carnice_sections:
    if not has_matching_section(original_chapters, section):
        merged.append(section)
```

### Step 6: Write and Validate

Write the merged file, then validate structure:

```python
from hermes_tools import write_file, terminal

write_file("merged_output.md", "\n".join(merged))

# Verify chapter structure
result = terminal("grep -n '^## ' merged_output.md")
print(result["output"])
```

### Step 7: Fix Artifacts

Common issues after merging and how to fix them:

**Duplicate Table of Contents**: Remove the original TOC, keep or rebuild the custom one.

**Wrong section numbering**: When secondary content uses different chapter numbers, update subsection numbering to match the merged structure:
```python
for i, line in enumerate(lines):
    if "### 8.x" in line and line is in Chapter 10b context:
        lines[i] = line.replace("8.x", "10b.x")
```

**Double separators**: Merging often creates `---\n\n---` patterns at boundaries. Fix with:
```python
i = 0
while i < len(lines) - 2:
    if (lines[i].strip() == "---" and
        lines[i+1].strip() == "" and
        lines[i+2].strip() == "---"):
        lines[i+1] = ""  # delete blank
        lines[i+2] = ""  # delete duplicate ---
        i += 3
    else:
        i += 1

# Also fix consecutive --- (no blank between)
for i in range(len(lines) - 1):
    if lines[i].strip() == "---" and lines[i+1].strip() == "---":
        lines[i] = ""

# Collapse consecutive empty lines to single blank line
final_lines = []
prev_empty = False
for line in lines:
    is_empty = line.strip() == ""
    if is_empty and prev_empty:
        continue
    final_lines.append(line)
    prev_empty = is_empty
```

**Inconsistent header levels**: Normalize to use consistent heading hierarchy (## for chapters, ### for sections).

## Pitfalls

- **Context loss in numbering**: Secondary content may reference old chapter numbers. Always verify numbering matches the merged document structure by searching for all `### N.x` patterns and checking they align with their parent chapter.
- **Duplicate content**: Both files likely cover the same examples. Prefer the more detailed or better-formatted version.
- **Table of Contents drift**: After merging, TOC links may be stale. Rebuild TOC to match final chapter list, including any new chapters added from the secondary source.
- **Size expectations**: Merged file will be smaller than sum of both files due to deduplication. This is expected and correct.
- **Double separator patterns can vary**: Check both `---\n---` (consecutive) and `---\n\n---` (blank-separated) patterns. Run multiple cleanup passes if needed.

## Verification Checklist

After merging, verify:
1. All original chapters are present in order
2. New content from secondary source is integrated at logical positions
3. No duplicate `---` separators remain (check with `grep -n '^---$' merged.md`)
4. Section numbering is consistent throughout (check with `grep -n '^### [0-9]' merged.md`)
5. Table of Contents matches actual chapter structure
6. File size is reasonable (< sum of both inputs)
