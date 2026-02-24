# Phase 14: Dispatcher Integration - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `stderr-bridge.js` and `session/store.js` (from Phase 13) into the dispatcher. On every failed dispatch, users see STDERR output and a Retry / Edit / Abort prompt. Every dispatch (success or failure) appends a sanitized record to session memory. Covers requirements ERR-02, ERR-03, ERR-04.

</domain>

<decisions>
## Implementation Decisions

### Recovery prompt UX
- Boxed error block using the GSD checkpoint box pattern: double-line box header with "COMMAND FAILED (exit code N)", stderr content below, then separator + recovery menu
- Show the redacted command above stderr so user knows exactly what was run
- Numbered menu for recovery: 1) Retry, 2) Edit, 3) Abort — user types 1-3 to select
- After successful retry/edit, show a brief one-line confirmation like "Command succeeded" before returning to selection flow

### Edit flow behavior
- Inline re-prompt: show original command as pre-filled text, user edits in-place and hits Enter
- Edited command re-enters `dispatchSelection` through the full pipeline (sanitization + selection matching) — no shortcut runner path
- A completely different edited command resets the retry counter — only consecutive failures of the same root cause escalate toward the 2-strike abort
- Ctrl+C during edit prompt = Abort (return to selection menu), not back to Retry/Edit/Abort

### Session write resilience
- Session write failures are swallowed silently — session is non-critical metadata and must never interrupt command flow
- Every dispatch attempt gets its own session record: original, retries, and edits each recorded separately
- Writes are synchronous (consistent with Phase 13's writeFileSync + renameSync pattern)
- Try/catch lives at the dispatcher call site, not inside store.js — keeps store.js pure (throws on error) while dispatcher decides the swallow policy

### Claude's Discretion
- Retry escalation: how to detect "same root cause" for the 2-strike limit (e.g., compare exit codes, stderr similarity, or command identity)
- Abort message wording and formatting
- Exact readline/input handling for the inline edit prompt
- Whether the numbered menu uses raw stdin or readline interface

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

*Phase: 14-dispatcher-integration*
*Context gathered: 2026-02-24*
