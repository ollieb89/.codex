---
phase: 14-dispatcher-integration
plan: 01
subsystem: dispatcher
tags: [cli, recovery, node, dispatcher]
requires:
  - phase: 13-foundation
    provides: stderr-bridge RecoveryPayload
provides:
  - Reusable recovery prompt renderer for dispatcher failures
  - Root-cause comparison helper and menu constants for retry loop
affects: [dispatcher, recovery, session-recording]
tech-stack:
  added: []
  patterns: [checkpoint-box prompt rendering, strict exitCode+command root-cause detection]
key-files:
  created: [get-shit-done/bin/lib/dispatcher/recovery.js, get-shit-done/bin/lib/dispatcher/__tests__/recovery.test.js]
  modified: []
key-decisions:
  - "Same root cause uses strict exitCode + command equality; null previous returns false."
  - "Recovery prompt uses fixed-width checkpoint box with numbered Retry/Edit/Abort menu."
patterns-established:
  - "Recovery prompts share checkpoint box framing and numbered menu constants for dispatcher reuse."
requirements-completed: [ERR-02, ERR-04]
# Metrics
duration: 18 min
completed: 2026-02-24
---

# Phase 14 Plan 01: Recovery Helpers Summary

**Recovery helper module now renders the boxed failure prompt and exposes root-cause comparison for dispatcher retries**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-24T19:14:30Z
- **Completed:** 2026-02-24T19:32:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `recovery.js` with boxed recovery prompt renderer, menu constants, and same-root-cause helper.
- Added node:test coverage that captures prompt output and validates menu ordering and comparison logic.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement recovery helpers** - `6b5be1d` (feat)
2. **Task 2: Add coverage for prompt and root-cause logic** - `780c320` (test)

**Plan metadata:** will be recorded in docs commit (see completion notes)

## Files Created/Modified
- `get-shit-done/bin/lib/dispatcher/recovery.js` - Renders boxed failure prompt and provides same-root-cause helper + menu constants.
- `get-shit-done/bin/lib/dispatcher/__tests__/recovery.test.js` - Captures prompt output and verifies menu mapping plus comparison helper behavior.

## Decisions Made
- None beyond plan requirements — followed locked design for boxed prompt and exitCode+command root-cause detection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Helpers are in place; dispatcher integration (14-02) can import `renderRecoveryPrompt`, `isSameRootCause`, and `RECOVERY_CHOICES` to drive the recovery loop.

---
*Phase: 14-dispatcher-integration*
*Completed: 2026-02-24*
