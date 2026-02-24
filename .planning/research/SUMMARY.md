# Project Research Summary

**Project:** Codex Base Optimization  
**Domain:** Numbered CLI selection UX for AI-assisted workflows  
**Researched:** 2026-02-24  
**Confidence:** HIGH

## Executive Summary

Numbered selection is best delivered with a strict prompt schema, a small selector helper, and a safety-aware dispatcher. Keep the stack minimal: Node 20 with readline, optional color (colorette) and sanitization (strip-ansi), and schema validation only when consuming JSON. The selector should render 1–N with 0-to-exit, validate input, and return a structured selection that the dispatcher can run or preview.

Key risks are sloppy AI output, off-by-one/zero handling, and unsafe auto-execution. Mitigate with schema enforcement + post-validate, explicit mapping between displayed numbers and actions, and confirmation/dry-run gates for anything mutating. Long labels and headless runs need truncation and a non-interactive flag.

## Key Findings

### Recommended Stack

- Node 20 + built-in readline for input; keep CJS.
- Optional colorette@2 for colored numbers; strip-ansi@7 to clean AI output.
- Optional zod@3 to validate JSON arrays if used.

### Expected Features

**Must have (table stakes):**
- Enforce numbered output schema (1–N, no filler).
- Selector helper that renders, validates, and returns selection.
- 0-to-exit plus non-numeric/out-of-range handling.
- Action dispatch with preview/confirmation for mutating actions.

**Should have (competitive):**
- Colorized numbering and concise layout.
- Dual-path normalization (JSON first, otherwise numbered text).
- Safety interlocks with dry-run for shell/diff.

**Defer (v2+):**
- Multi-select/fuzzy search.
- Pagination for very long lists.

### Architecture Approach

Prompts enforce schema → Normalizer (JSON or numbered text) → Selector (render/input with 0-exit) → Dispatcher (command/diff/flow with safety) → Optional logging. Keep selector/dispatcher as reusable helpers under `bin/lib/`.

**Major components:**
1. Prompt schema + validator — ensures numbered lines.
2. Selector helper — handles render/input and returns `{index,label,payload}`.
3. Dispatcher — executes mapped action with confirm/dry-run.

### Critical Pitfalls

1. Conversational output breaks parsing — enforce schema, validate, retry.  
2. Off-by-one/0 handling bugs — map displayed numbers explicitly; treat 0 as cancel.  
3. Unsafe auto-execution — require preview/confirm for mutating actions.  
4. Untrusted payloads — sanitize/allowlist commands and patch targets.  
5. Long labels break layout — truncate and keep numbers aligned.

## Implications for Roadmap

### Phase 1: Schema & Selector
**Rationale:** Garbage-in kills UX; selector is the core utility.  
**Delivers:** Prompt snippet, validation, selector helper with 0-to-exit.  
**Addresses:** Numbered schema, validation, basic selection.

### Phase 2: Action Dispatcher + Safety
**Rationale:** Selection must drive actions safely.  
**Delivers:** Dispatcher, confirm/dry-run, sanitization/allowlist for commands/diffs.  
**Uses:** Structured selection output from Phase 1.

### Phase 3: UX Polish & Resilience
**Rationale:** Improve scanability and robustness after core path works.  
**Delivers:** Colorized numbers, truncation, JSON normalization fallback, logging hooks.

### Phase Ordering Rationale

- Selector depends on schema; dispatcher depends on selector output; polish depends on stable flow.
- Safety interlocks must precede any broad rollout of auto-execution.

### Research Flags

- Phase 2: Confirm allowlist/confirmation rules for shell vs diff to balance speed/safety.
- Phase 3: Validate behavior in non-TTY/headless environments.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Minimal deps; standard Node patterns |
| Features | HIGH | Patterns well established in comparable CLIs |
| Architecture | HIGH | Straightforward helper/dispatcher layering |
| Pitfalls | HIGH | Known issues from existing CLIs and readline quirks |

**Overall confidence:** HIGH

### Gaps to Address

- Confirm which commands/diff flows need mandatory confirmation vs optional.
- Decide logging/telemetry format (stdout vs file) if needed in later phase.

## Sources

### Primary (HIGH confidence)
- Node.js readline docs; colorette/strip-ansi docs; observed Copilot CLI/Aider behaviors.

### Secondary (MEDIUM confidence)
- General CLI UX patterns for numeric selection and cancel conventions.

---
*Research completed: 2026-02-24*  
*Ready for roadmap: yes*
