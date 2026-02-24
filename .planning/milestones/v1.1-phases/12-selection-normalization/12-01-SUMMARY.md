---
phase: 12-selection-normalization
plan: 01
subsystem: selector
tags: [normalization, regex, tdd, cli]

requires:
  - phase: 07-schema-selector
    provides: normalize.js and schema.js foundations
provides:
  - normalizeOptions() handles gap lists, 0-indexing, leading zeros, markdown-wrapped numbers
  - NormalizationError with retry budget of 2 (3 total attempts)
  - Exhaustion error with raw output preview
  - stripSimpleMarkdown() that preserves label text
affects: [12-selection-normalization]

tech-stack:
  added: []
  patterns: [prefix-only markdown stripping, exhaustion error with context]

key-files:
  created: [get-shit-done/bin/lib/selector/__tests__/normalize.test.js]
  modified: [get-shit-done/bin/lib/selector/normalize.js, get-shit-done/bin/lib/selector/schema.js]

key-decisions:
  - "stripSimpleMarkdown rewritten to only strip number prefixes, preserving label text intact"
  - "RETRY_BUDGET increased to 2 per CONTEXT decision (3 total attempts)"
  - "JSON path skips markdown stripping entirely to preserve payload/metadata"

patterns-established:
  - "Prefix-only stripping: markdown removal targets number prefix, not full line"
  - "Exhaustion errors include raw output preview for debugging"

requirements-completed: [SEL-01, SEL-02]

duration: 8min
completed: 2026-02-24
---

# Phase 12-01: Selection Normalization Summary

**normalizeOptions() hardened with TDD: handles gap lists, 0-indexing, leading zeros, bold/backtick-wrapped numbers while preserving label text and metadata**

## Performance

- **Duration:** 8 min
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 3

## Accomplishments
- VALID_NUMBERED_LINE regex handles leading zeros and markdown-wrapped numbers
- stripSimpleMarkdown() rewritten to only clean number prefixes, preserving labels (SEL-02)
- RETRY_BUDGET updated to 2 (3 total attempts) per CONTEXT decision
- DUPLICATE_HINT matches CONTEXT spec exactly
- Exhaustion error includes raw output preview and attempt count
- 18 tests passing, 0 regressions

## Task Commits

1. **Task 1: Write failing tests** - `bf802ed` (test)
2. **Task 2: Update schema.js and normalize.js** - `f9e9010` (feat)

## Files Created/Modified
- `get-shit-done/bin/lib/selector/__tests__/normalize.test.js` - 18 tests covering all edge cases
- `get-shit-done/bin/lib/selector/normalize.js` - Hardened normalizeOptions, fixed stripSimpleMarkdown
- `get-shit-done/bin/lib/selector/schema.js` - Updated regex, RETRY_BUDGET=2, DUPLICATE_HINT

## Decisions Made
- stripSimpleMarkdown rewritten from scratch: old version stripped all markdown characters globally (broke labels). New version uses per-line regex targeting only number prefixes.
- JSON parsing path skips markdown stripping entirely since JSON content should not be modified.

## Deviations from Plan
- Updated old test "empty after filtering triggers retryable error then hard fail" to use attempt=2 instead of attempt=1 (matching new RETRY_BUDGET=2)

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- normalizeOptions() ready for integration with index.js run() function (Plan 12-02)
- All existing tests pass, no regressions

---
*Phase: 12-selection-normalization*
*Completed: 2026-02-24*
