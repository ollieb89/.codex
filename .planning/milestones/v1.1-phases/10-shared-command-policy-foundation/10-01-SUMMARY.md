---
phase: 10-shared-command-policy-foundation
plan: 01
subsystem: dispatcher
tags: [commonjs, constants, regex, word-boundary, prefix-matching]

requires:
  - phase: none
    provides: N/A - first plan in phase
provides:
  - "Shared commands.js module with BLOCKED_COMMANDS, ALLOWLIST, GRAY_COMMANDS, DESTRUCTIVE_HIGHLIGHT_TERMS, MUTATING_PATTERN, matchGray"
  - "Test suite with 25 tests covering shape, prefix matching, word-boundary regex, and reason strings"
affects: [10-02, dispatcher, sanitize, preview]

tech-stack:
  added: []
  patterns: [prefix-based gray matching with trailing-space guard, word-boundary regex for mutating detection]

key-files:
  created:
    - get-shit-done/bin/lib/dispatcher/commands.js
    - get-shit-done/bin/lib/dispatcher/__tests__/commands.test.js
  modified: []

key-decisions:
  - "matchGray uses find() with trailing-space guard to prevent prefix collisions"
  - "MUTATING_PATTERN escapes regex special chars and replaces whitespace with \\s+ for multi-token terms"

patterns-established:
  - "Prefix matching: lower === prefix OR lower.startsWith(prefix + ' ')"
  - "Word-boundary regex: escape terms, wrap in \\b, join with |"

requirements-completed: [SEC-03]

duration: 3min
completed: 2026-02-24
---

# Plan 10-01: Shared Commands Module Summary

**Pure CommonJS constants module exporting all command-policy constants with prefix-based gray matching and word-boundary mutating regex**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created dispatcher/commands.js as single source of truth for all command-policy constants
- Implemented matchGray helper with prefix matching and trailing-space collision guard
- Built MUTATING_PATTERN regex with word-boundary anchors preventing false positives
- 25 tests covering shape validation, prefix edge cases, word-boundary behaviour, and reason strings

## Task Commits

1. **Task 1: Create dispatcher/commands.js** - `bcf583f` (feat)
2. **Task 2: Create commands.test.js** - `bcf583f` (feat, same commit - both files in single plan)

## Files Created/Modified
- `get-shit-done/bin/lib/dispatcher/commands.js` - Single source of truth for all command-policy constants
- `get-shit-done/bin/lib/dispatcher/__tests__/commands.test.js` - 25 tests covering all exports

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- commands.js ready for import by sanitize.js, preview.js, and index.js in Plan 10-02
- All existing tests (11) continue to pass unchanged

---
*Phase: 10-shared-command-policy-foundation*
*Completed: 2026-02-24*
