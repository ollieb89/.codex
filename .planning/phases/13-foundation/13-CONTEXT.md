# Phase 13: Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new leaf modules — `session/store.js` and `dispatcher/stderr-bridge.js` — built and fully tested in isolation before any dispatcher changes. Covers requirements SESS-01 through SESS-04 and ERR-01.

</domain>

<decisions>
## Implementation Decisions

### RecoveryPayload shape
- Minimal payload: `exitCode`, `stderrHint` (redacted snippet), `command` (redacted) — no error category or suggested action
- Phase 14 adds recovery routing on top; this module just surfaces the data
- Returns `null` on success (exit code 0) — caller checks for null to know if recovery is needed
- Stderr hint: keep the last N lines (5-10) — most diagnostic content is at the end
- Stderr hint always passes through `redactSecrets` before inclusion in payload

### Claude's Discretion
- Session record shape beyond what SESS-02 specifies (timestamp format, field naming)
- Redaction strategy details (what patterns `redactSecrets` catches, placeholder format)
- Ring buffer eviction policy (FIFO assumed), whether buffer size is configurable or hardcoded at 3
- Exact line count for stderr truncation (somewhere in 5-10 range)
- Test structure and assertion patterns for isolation tests

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-foundation*
*Context gathered: 2026-02-24*
