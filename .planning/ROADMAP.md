# Roadmap — Numbered CLI Selection UX

**Phases:** 3 (numbered 7–9)  
**Requirements covered:** 7/7 ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 7 | Schema & Selector | Enforce numbered schema and build a reliable selector with 0-to-exit | SCH-01, SCH-02, SEL-01 | 3 |
| 8 | Safe Dispatch | Wire selections to actions with confirmation, dry-run, and sanitization | SAF-01, SAF-02 | 3 |
| 9 | UX Polish & Headless | Improve readability, wide-label handling, and non-interactive flow | SEL-02, UX-01 | 3 |

## Phase 7: Schema & Selector

**Goal:** Enforce numbered option schema and provide a selector that validates input and returns structured selections.  
**Requirements:** SCH-01, SCH-02, SEL-01  
**Success Criteria**:
1. System prompt snippet outputs strict `1–N` lists; non-conforming output is rejected or retried.
2. Normalizer handles JSON arrays when present and sanitized numbered-text otherwise (ANSI/markdown stripped).
3. Selector renders numbered options, reserves `0` to exit, and returns `{index,label,payload}` after validating numeric range.

## Phase 8: Safe Dispatch

**Goal:** Execute selected actions safely with previews, confirmation, and allowlists.  
**Requirements:** SAF-01, SAF-02  
**Success Criteria**:
1. Dispatcher maps selection to action types (shell/diff/flow) and shows preview.
2. Mutating actions require confirmation and support dry-run; read-only actions may run without extra prompt.
3. Payloads are sanitized/allowlisted; commands/paths outside workspace are blocked.

## Phase 9: UX Polish & Headless

**Goal:** Improve readability and support scripted use.  
**Requirements:** SEL-02, UX-01  
**Success Criteria**:
1. Long/wide labels truncate cleanly with aligned numbering (handles wide Unicode); full text available on demand.
2. Colorized numbering available with a no-color fallback/flag.
3. Non-interactive mode accepts preselected number via flag/env, logs options + selection, and exits cleanly on `0`.

---
