---
phase: 13-foundation
plan: 02
subsystem: dispatcher
tags: [stderr, recovery-payload, redaction, pure-function]

requires:
  - phase: 10-shared-command-policy-foundation
    provides: redactSecrets function in dispatcher/sanitize.js
provides:
  - buildRecoveryPayload pure function (RecoveryPayload | null)
  - STDERR_TAIL_LINES constant for stderr truncation
affects: [14-integration, dispatcher, error-recovery]

tech-stack:
  added: []
  patterns: [pure-function-bridge, stderr-tail-truncation, null-on-success]

key-files:
  created:
    - get-shit-done/bin/lib/dispatcher/stderr-bridge.js
    - get-shit-done/bin/lib/dispatcher/__tests__/stderr-bridge.test.js
  modified: []

key-decisions:
  - "STDERR_TAIL_LINES set to 7 (within 5-10 range per user discretion)"
  - "Returns null on success (code 0) — caller checks for null"
  - "Minimal payload: exitCode, stderrHint, command only — no error category or recovery suggestion"

patterns-established:
  - "Null-on-success: bridge returns null when no recovery needed, payload when it is"
  - "Redact-before-construct: raw strings pass through redactSecrets before payload assembly"
  - "Tail truncation: split on newline, slice(-N), rejoin and trim"

requirements-completed: [ERR-01]

duration: 3min
completed: 2026-02-24
---

# Plan 13-02: Stderr Bridge Summary

**Pure-function stderr bridge returning RecoveryPayload with redacted stderr hints on non-zero exit**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T19:00:00Z
- **Completed:** 2026-02-24T19:03:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files created:** 2

## Accomplishments
- buildRecoveryPayload returns null on exit code 0 or null/undefined input
- Returns {exitCode, stderrHint, command} on non-zero exit (ERR-01)
- Stderr truncated to last 7 lines for concise diagnostic hints
- Both stderrHint and command pass through redactSecrets before inclusion
- Pure function with zero I/O and zero side effects
- 12 isolation tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests** - `05ea0b8` (test)
2. **Task 2: GREEN — Implementation** - `f5d44f7` (feat)

_TDD plan: RED phase wrote 12 failing tests, GREEN phase implemented stderr-bridge.js to pass all._

## Files Created/Modified
- `get-shit-done/bin/lib/dispatcher/stderr-bridge.js` - Pure-function stderr bridge returning RecoveryPayload or null
- `get-shit-done/bin/lib/dispatcher/__tests__/stderr-bridge.test.js` - 12 isolation tests covering ERR-01

## Decisions Made
- STDERR_TAIL_LINES = 7 (within the 5-10 range from user constraints)
- Module placed at dispatcher/stderr-bridge.js (sibling to sanitize.js) for clean import paths
- Defensive null/undefined handling on both runnerResult and command parameters

## Deviations from Plan

### Auto-fixed Issues

**1. [Test fix] Updated secret redaction test input to match actual SECRET_PATTERNS**
- **Found during:** Task 2 (GREEN phase test run)
- **Issue:** Test used `STRIPE_SECRET_KEY=sk_live_abc123` but the pattern requires key ending with SECRET/API_KEY/TOKEN and stripe-specific needs 24+ chars
- **Fix:** Changed test to use `MY_SECRET=supersecret123` which correctly matches generic_env pattern
- **Files modified:** get-shit-done/bin/lib/dispatcher/__tests__/stderr-bridge.test.js
- **Verification:** 12/12 tests pass
- **Committed in:** f5d44f7 (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (test input alignment with actual redaction patterns)
**Impact on plan:** Trivial test data change. No scope creep.

## Issues Encountered
None beyond the test input fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- stderr-bridge.js ready for Phase 14 dispatcher integration
- buildRecoveryPayload can be called after runner execution to detect failures
- RecoveryPayload can be injected into prompt context for error recovery

---
*Phase: 13-foundation*
*Completed: 2026-02-24*
