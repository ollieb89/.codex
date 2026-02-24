# Requirements: Codex Base Optimization — Numbered CLI Selection UX

**Defined:** 2026-02-24  
**Core Value:** Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## v1 Requirements

### Schema

- [ ] **SCH-01**: System prompts/agents enforce numbered option output (`1.`…`N.`), no filler text, and reject/normalize outputs that do not match.
- [ ] **SCH-02**: Normalizer accepts JSON array outputs when present and falls back to numbered-text parsing; sanitizes ANSI/markdown artifacts before parsing.

### Selector

- [ ] **SEL-01**: InputSelector renders options as a numbered list, reserves `0` as a cancel/exit, rejects non-numeric and out-of-range inputs, and returns structured `{index,label,payload}`.
- [ ] **SEL-02**: Selector handles long/wide labels with truncation/alignment (including wide Unicode), and supports colorized numbers with a no-color fallback.

### Safety

- [ ] **SAF-01**: Dispatcher maps selections to actions (shell command, diff apply, or workflow step) and requires preview/confirmation plus dry-run for mutating actions.
- [ ] **SAF-02**: Dispatcher sanitizes/allowlists payloads (commands/paths) to prevent unsafe execution and blocks actions outside the workspace.

### Automation UX

- [ ] **UX-01**: Non-interactive/headless mode accepts a preselected number via flag/env, logs options and selection for audit, and exits cleanly on `0`.

## v2 Requirements

(None yet — add post-v1 learnings)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Heavy TUI frameworks (blessed/ink) | Overkill for simple selection; brittle in headless/CI |
| Auto-execute without confirmation for mutating actions | Safety risk; keep human-in-the-loop |
| Multi-select/fuzzy search/pagination | Defer until v1 flow is validated |
| Free-form conversational outputs | Break deterministic parsing; enforce schema instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 0
- Unmapped: 7 ⚠️

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after defining milestone scope*
