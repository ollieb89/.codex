---
phase: 07-schema-selector
plan: 01
subsystem: cli
tags: [readline, schema, parsing]
requires: []
provides:
  - numbered-list schema snippet for AI outputs
  - normalization helper for JSON and numbered text
affects: [selector]
tech-stack:
  added: []
  patterns: [schema-first-normalization, json-first-fallback-text]
key-files:
  created:
    - prompts/snippets/numbered-schema.md
    - get-shit-done/bin/lib/selector/schema.js
    - get-shit-done/bin/lib/selector/normalize.js
    - get-shit-done/bin/lib/selector/__tests__/normalize.test.js
  modified: []
key-decisions:
  - Enforce strict 1–N numbering with one retry budget and duplicate rejection
  - Single-option fast path triggers Y/n confirmation instead of full selector
patterns-established:
  - Schema-first: validate AI output, strip filler, retry once, then fail
  - JSON-first normalization with numbered-text fallback and re-indexing
requirements-completed:
  - SCH-01
  - SCH-02
duration: 20min
completed: 2026-02-24
---

# Phase 7: Schema & Selector Summary (Plan 01)

Strict numbered schema established and normalization helper built (JSON-first, numbered-text fallback) with retry and duplicate detection.

## Performance

- **Duration:** 20 min
- **Started:** 2026-02-24T00:00:00Z
- **Completed:** 2026-02-24T00:20:00Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments
- Added reusable prompt snippet enforcing 1–N numbering with no filler and retry hint.
- Implemented schema constants and normalizeOptions helper (ANSI/markdown strip, JSON-first, gap reindex, duplicate rejection, single-option flag).
- Added Node `--test` coverage for happy path, gaps, duplicates, zero-valid-lines retry, and single-option detection.

## Task Commits

1. **Task 1: Establish numbered schema snippet** - `b008f01` (docs)
2. **Task 2: Implement schema rules and normalization helper** - `b008f01` (feat)
3. **Task 3: Add normalization tests for retry and edge cases** - `b008f01` (test)

## Files Created/Modified
- `prompts/snippets/numbered-schema.md` — strict numbered list instructions.
- `get-shit-done/bin/lib/selector/schema.js` — schema constants and retry hints.
- `get-shit-done/bin/lib/selector/normalize.js` — normalization logic (JSON/text, retries, duplicates).
- `get-shit-done/bin/lib/selector/__tests__/normalize.test.js` — coverage for gaps, duplicates, retry budget.

## Decisions Made
- Retry once on empty/invalid output; fail thereafter.
- Hard-fail on duplicate numbers; do not guess.
- When one option remains, prompt Y/n instead of showing selector list.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- Selector can consume normalized entries immediately.
- Dispatcher (Phase 8) should honor payload-first execution and retry hints from normalization errors.

---
*Phase: 07-schema-selector*
*Completed: 2026-02-24*
