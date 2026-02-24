# Phase 12: Selection Normalization - Research

**Researched:** 2026-02-24
**Status:** Complete

## Current Codebase State

### Existing Files

| File | Purpose | Status |
|------|---------|--------|
| `selector/normalize.js` | `normalizeOptions()`, `NormalizationError` | Exists, partially implemented |
| `selector/schema.js` | `VALID_NUMBERED_LINE` regex, `RETRY_BUDGET`, hint constants | Exists, needs updates |
| `selector/index.js` | `selectOption()` — interactive selection | Exists, no normalization integration |
| `selector/headless.js` | `handleHeadless()` — CLI/env selection | Exists, no normalization integration |
| `selector/format.js` | `formatMenuItem()`, `stripAnsi()`, `stringWidth()`, `truncateLabel()` | Exists, stable |
| `selector/__tests__/selector.test.js` | 2 tests for `selectOption` | Exists, passing |
| `selector/__tests__/headless.test.js` | 6 tests for `handleHeadless` | Exists, passing |
| `selector/__tests__/format.test.js` | 4 tests for formatting functions | Exists, passing |

### Gap Analysis

**1. normalize.js gaps (SEL-01, SEL-02):**
- `VALID_NUMBERED_LINE` regex is `^\d+\.\s+.+$` -- does NOT handle:
  - Leading zeros: `01. Option` (context says: strip leading zeros, reindex)
  - Markdown-wrapped numbers: `**1.** Option` (context says: extend `stripSimpleMarkdown()`)
- `stripSimpleMarkdown()` is too aggressive -- strips ALL `*`, `_`, backticks from the entire string including label content. Should only strip markdown formatting from the number prefix, preserving label text (SEL-02 requirement).
- `RETRY_BUDGET = 1` in schema.js but CONTEXT says 2 retries (3 total attempts). Needs update to `RETRY_BUDGET = 2`.
- Error messages don't match CONTEXT specs:
  - Duplicate hint should be: "Duplicate numbered options detected. Re-generate the list with unique sequential numbers (1, 2, 3, ...)."
  - Exhaustion message should include raw output preview: "Selection failed: could not parse valid options after 3 attempts. Raw output was: [first 100 chars...]. This is usually an AI formatting issue -- try running again."

**2. index.js gaps (SEL-01, SEL-03):**
- No `normalizeOptions` import -- `selectOption()` trusts caller to provide pre-normalized entries
- No `run()` convenience function that combines normalize + select (context decision)
- `selectOption` renders entries using `entry.id` directly -- if caller passes non-sequential IDs (e.g., `{id: 3}, {id: 7}`), the menu shows gaps

**3. headless.js gaps (SEL-03):**
- `handleHeadless()` finds entries by `entries.find(e => e.id === selection)` -- if IDs are non-sequential, `--select=2` won't find anything when the second item has `id: 3`
- After normalization, this resolves naturally since all entries will be 1..N

**4. Missing: integration between normalize.js and index.js/headless.js:**
- The single chokepoint pattern (CONTEXT decision) requires `normalizeOptions()` to be called BEFORE `selectOption()` and `handleHeadless()`
- The `run()` function should be the recommended public API

## Architecture Decisions (from CONTEXT.md)

1. **Single chokepoint**: One `normalizeOptions()` call produces clean 1..N entries consumed by both `selectOption()` and `handleHeadless()`
2. **Caller normalizes first**: `selectOption()` trusts input is already 1..N
3. **`run()` convenience function**: Lives in `index.js`, combines normalize + select
4. **NormalizationError exceptions**: Callers catch and decide (retry, stderr, propagate)
5. **0-indexed lists**: Silently reindex to 1..N
6. **Leading zeros**: `01.` treated as `1.`, strip during parse
7. **Markdown-wrapped numbers**: Strip markdown before parsing, extend `stripSimpleMarkdown()`

## Implementation Strategy

### Plan 1 (TDD): normalize.js + schema.js hardening
- Update `VALID_NUMBERED_LINE` regex to handle leading zeros (`0*\d+`)
- Fix `stripSimpleMarkdown()` to handle bold numbers (`**1.**`) without destroying label content
- Update `RETRY_BUDGET` to 2
- Update error messages to match CONTEXT specs
- Add exhaustion error class/message with raw output preview
- All driven by tests: gap lists, 0-indexed, leading zeros, markdown-wrapped, duplicates, empty input

### Plan 2: Integration -- `run()` function + headless wiring
- Add `run(rawOutput, opts)` to `index.js` that calls `normalizeOptions()` then `selectOption()`
- Ensure `handleHeadless()` works correctly with post-normalization 1..N entries
- Update exports in `index.js`
- Integration tests: `run()` end-to-end with gap lists, headless `--select` with normalized entries

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `stripSimpleMarkdown` changes break existing label parsing | Medium | TDD: test label preservation explicitly |
| Regex changes cause false positives on non-numbered content | Low | Test with edge cases: URLs, version numbers, IPs |
| `run()` function adds complexity to public API | Low | Keep `selectOption` and `normalizeOptions` available for advanced use |

## RESEARCH COMPLETE
