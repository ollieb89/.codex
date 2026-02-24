# Feature Research

**Domain:** Numbered CLI selection UX for AI-assisted workflows  
**Researched:** 2026-02-24  
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Numbered AI output schema (1–N, no filler) | Enables deterministic parsing and display | LOW | Enforce via system prompt snippet and validation guard |
| Input selector helper (render + parse) | Core UX for picking an option quickly | LOW | Should accept list of strings/objects and return selection |
| Zero-to-exit and input validation | Prevent crashes and allow quick cancel | LOW | Catch non-numeric, out-of-range; 0 returns gracefully |
| Action dispatch on selection | Users expect the pick to do something immediately | MEDIUM | Map numbers to actions (commands/diffs); include dry-run flag |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Colorized numbering and concise layout | Faster scanning under time pressure | LOW | Optional colorette; keep monochrome fallback |
| Multi-source normalization (JSON or numbered text) | Works across different agent outputs | MEDIUM | Try JSON parse first; fall back to regex numbered lines |
| Safety interlocks (preview before execute) | Avoid accidental destructive runs | MEDIUM | Require confirmation for shell/diff actions; show summary |

### Anti-Features (Commonly Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-form conversational responses | “Feels natural” | Breaks parsing; inconsistent numbering | Enforce schema with hard guardrails |
| Heavy TUI navigators (search, paging) | “More control” | Adds deps, fails in headless runs | Simple numbered list with optional color |
| Auto-execute without confirmation | “Speed” | Risky for file/system changes | Require confirm for destructive ops; allow silent for read-only |

## Feature Dependencies

```
AI Output Schema
    └──feeds──> Selector Helper (render/parse)
                     └──drives──> Action Dispatcher
                                └──requires──> Safety Interlocks (confirm/dry-run)
```

### Dependency Notes

- Schema must be enforced before selector; garbage in = garbage out.
- Dispatcher relies on selector returning structured result (id, text, payload).
- Safety interlocks wrap dispatcher whenever action mutates FS/shell.

## MVP Definition

### Launch With (v1)

- [ ] Enforced numbered list schema in prompts/agents
- [ ] Selector helper (render, parse, returns selection)
- [ ] Zero-to-exit + validation
- [ ] Action dispatch with optional confirmation and dry-run for shell/diff

### Add After Validation (v1.x)

- [ ] Colorized output + width-aware truncation
- [ ] JSON-structured AI output path with schema validation
- [ ] Selector telemetry/log hooks (for debugging choices)

### Future Consideration (v2+)

- [ ] Multi-select or fuzzy search
- [ ] Pagination for very long lists
- [ ] Configurable keybindings beyond numbers

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Numbered schema enforcement | HIGH | LOW | P1 |
| Selector helper | HIGH | LOW | P1 |
| Zero-to-exit + validation | HIGH | LOW | P1 |
| Action dispatch + safety interlocks | HIGH | MEDIUM | P1 |
| Colorized output | MEDIUM | LOW | P2 |
| JSON normalization | MEDIUM | MEDIUM | P2 |
| Telemetry/log hooks | LOW | LOW | P3 |

## Competitor Feature Analysis

| Feature | Copilot CLI | Aider | Our Approach |
|---------|-------------|-------|--------------|
| Numbered list output | Yes, but verbose context | Yes, adds file selection | Strict schema, minimal filler |
| Selector UX | Arrow keys + numbers | Numbers + file chat | Numbers-first, 0-to-exit, fast render |
| Action safety | Often asks confirmation | Applies patches after prompt | Require confirm for mutating actions; dry-run available |

## Sources

- Observed behaviors from Copilot CLI, Aider, ShellGPT number-selection flows
- Internal prompt patterns from Codex agents (need schema tightening)

---
*Feature research for: Numbered CLI selection UX*  
*Researched: 2026-02-24*
