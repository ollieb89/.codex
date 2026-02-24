# Phase 14: Dispatcher Integration - Research

**Researched:** 2026-02-24
**Domain:** Node.js CLI dispatcher error recovery and session recording
**Confidence:** HIGH

## Summary

Phase 14 wires two Phase 13 leaf modules (`stderr-bridge.js` and `session/store.js`) into the existing `dispatchSelection` function in `dispatcher/index.js`. The dispatcher currently runs a command via a runner function and returns `{ ran, dryRun, result }` with no error handling or session recording. This phase adds: (1) a recovery loop on non-zero exit that displays stderr and offers Retry/Edit/Abort, (2) session recording of every dispatch attempt, and (3) a 2-strike escalation that hard-stops after consecutive same-root-cause failures.

All work is pure internal wiring using existing Node.js built-in APIs (`readline`, `fs`, `child_process`) and existing project modules. No new external dependencies are needed.

**Primary recommendation:** Modify `dispatchSelection` to call `buildRecoveryPayload` after runner execution, display the recovery prompt on failure, loop for retry/edit with a strike counter, and wrap session `appendRecord` in try/catch at the dispatcher call site.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Boxed error block using the GSD checkpoint box pattern: double-line box header with "COMMAND FAILED (exit code N)", stderr content below, then separator + recovery menu
- Show the redacted command above stderr so user knows exactly what was run
- Numbered menu for recovery: 1) Retry, 2) Edit, 3) Abort -- user types 1-3 to select
- After successful retry/edit, show a brief one-line confirmation like "Command succeeded" before returning to selection flow
- Inline re-prompt: show original command as pre-filled text, user edits in-place and hits Enter
- Edited command re-enters `dispatchSelection` through the full pipeline (sanitization + selection matching) -- no shortcut runner path
- A completely different edited command resets the retry counter -- only consecutive failures of the same root cause escalate toward the 2-strike abort
- Ctrl+C during edit prompt = Abort (return to selection menu), not back to Retry/Edit/Abort
- Session write failures are swallowed silently -- session is non-critical metadata and must never interrupt command flow
- Every dispatch attempt gets its own session record: original, retries, and edits each recorded separately
- Writes are synchronous (consistent with Phase 13's writeFileSync + renameSync pattern)
- Try/catch lives at the dispatcher call site, not inside store.js -- keeps store.js pure (throws on error) while dispatcher decides the swallow policy

### Claude's Discretion
- Retry escalation: how to detect "same root cause" for the 2-strike limit (e.g., compare exit codes, stderr similarity, or command identity)
- Abort message wording and formatting
- Exact readline/input handling for the inline edit prompt
- Whether the numbered menu uses raw stdin or readline interface

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-02 | On non-zero exit, dispatcher prompts Retry / Edit (via editCommand) / Abort | Recovery loop in dispatchSelection using buildRecoveryPayload + numbered menu prompt |
| ERR-03 | Recovery retries re-enter dispatchSelection with full sanitization (never bypass safety) | Recursive call to dispatchSelection for both Retry and Edit paths |
| ERR-04 | Hard stop after 2 failed recovery attempts for same root cause | Strike counter comparing exit code + command identity between consecutive failures |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:readline | Built-in | Interactive numbered menu prompt | Already used throughout dispatcher (edit.js, preview.js, index.js) |
| node:fs | Built-in | Session file I/O | Already used in session/store.js |
| node:child_process | Built-in | Command execution | Already used in dispatcher/index.js defaultRunner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dispatcher/stderr-bridge.js | Phase 13 | Build RecoveryPayload from runner result | After every runner call to detect failures |
| session/store.js | Phase 13 | Append dispatch records to ring buffer | After every runner call (success or failure) |
| dispatcher/sanitize.js | Phase 10 | sanitizeAction, redactSecrets | Already imported in index.js; used by re-dispatch path |
| dispatcher/edit.js | Phase 11 | editCommand for inline editing | Used in Edit recovery option |

### Alternatives Considered
None -- all modules are existing project internals.

## Architecture Patterns

### Current Dispatcher Flow (index.js)
```
dispatchSelection(selection, opts)
  -> sanitizeAction
  -> handle block (editCommand)
  -> renderPreview
  -> mutating confirm
  -> runner(action)
  -> return { ran, result }
```

### Target Dispatcher Flow (after Phase 14)
```
dispatchSelection(selection, opts)
  -> sanitizeAction
  -> handle block (editCommand)
  -> renderPreview
  -> mutating confirm
  -> runner(action)
  -> appendRecord(session)  [try/catch, swallow errors]
  -> buildRecoveryPayload(result)
  -> if null (success): return { ran, result }
  -> if payload (failure):
     -> renderRecoveryPrompt(payload)
     -> prompt: 1) Retry, 2) Edit, 3) Abort
     -> if Retry: increment strike counter, recursive dispatchSelection
     -> if Edit: prompt inline edit, recursive dispatchSelection (resets counter if different command)
     -> if Abort: return { ran: true, result, aborted: true }
     -> if strikes >= 2: hard-stop with abort message
```

### Pattern 1: Recovery Loop via Recursive dispatchSelection
**What:** On failure, the recovery options (Retry/Edit) call `dispatchSelection` recursively rather than calling the runner directly.
**When to use:** Always for Retry and Edit -- this is a locked decision (ERR-03).
**Why:** Ensures every retry passes through full sanitization pipeline. No shortcut runner path.

### Pattern 2: Strike Counter via opts
**What:** Pass a `_recoveryState` object through opts to track consecutive same-root-cause failures across recursive calls.
**When to use:** Internal to dispatchSelection -- not exposed to external callers.
**Key design:** The state object carries `{ strikes, lastExitCode, lastCommand }`. On each failure, compare current exit code + command with last. If same root cause, increment strikes. If different (e.g., user edited to a completely different command), reset to 0.

### Pattern 3: Session Recording at Dispatcher Call Site
**What:** Wrap `appendRecord` in try/catch at the point where the runner returns, not inside store.js.
**When to use:** After every runner execution (success or failure).
**Why:** Keeps store.js pure (throws on error) while dispatcher decides swallow policy. Locked decision from CONTEXT.md.

### Anti-Patterns to Avoid
- **Direct runner call in recovery:** Never call `runner()` directly from recovery path -- always go through `dispatchSelection` (ERR-03)
- **Session errors bubbling up:** Never let session write failures propagate -- always catch at dispatcher call site
- **Infinite recovery loops:** Always enforce the 2-strike limit to prevent unbounded retries

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stderr extraction | Custom stderr parser | `buildRecoveryPayload` from stderr-bridge.js | Already handles tail truncation, redaction, null-on-success |
| Session persistence | Custom file writer | `appendRecord` from session/store.js | Already handles ring buffer, atomic write, redaction, permissions |
| Command editing | Custom editor prompt | `editCommand` from edit.js | Already handles inline/editor modes, cancellation |
| Secret redaction | Regex in dispatcher | `redactSecrets` from sanitize.js | Centralized patterns, already tested |

## Common Pitfalls

### Pitfall 1: Recursive opts pollution
**What goes wrong:** Passing the full `opts` object through recursive `dispatchSelection` calls causes the `_recoveryState` to accumulate or the `ask` function to be called with stale closures.
**Why it happens:** JavaScript object references are shared.
**How to avoid:** Spread opts and inject fresh `_recoveryState` on each recursive call. Do not mutate the original opts.
**Warning signs:** Tests pass individually but fail when chained; strike counter doesn't reset properly.

### Pitfall 2: readline interface conflicts
**What goes wrong:** Opening a new readline interface while a previous one is still open causes stdin conflicts.
**Why it happens:** The recovery prompt and the edit prompt both need user input.
**How to avoid:** Use the injected `ask` function consistently (already the pattern in index.js). The `ask` function creates/closes its own readline interface per question.
**Warning signs:** Prompt appears but input hangs; readline "close" events fire unexpectedly.

### Pitfall 3: Session path not configured
**What goes wrong:** `appendRecord` is called without a session file path, causing ENOENT or writing to wrong location.
**Why it happens:** The session file path (`.planning/session.json`) needs to be resolved relative to cwd.
**How to avoid:** Resolve session path using `path.join(cwd, '.planning/session.json')` at the top of dispatchSelection. Pass via opts for testability.
**Warning signs:** Session file appears in wrong directory; tests that mock fs fail.

### Pitfall 4: Edited command not re-entering full pipeline
**What goes wrong:** After user edits a command, the code calls `runner()` directly instead of going through `dispatchSelection` with full sanitization.
**Why it happens:** Tempting shortcut to avoid recursive call complexity.
**How to avoid:** Always construct a new selection object from the edited command and call `dispatchSelection` recursively.
**Warning signs:** Edited commands bypass allowlist checks; out-of-bounds paths not caught in edits.

## Code Examples

### Recovery Prompt Rendering (GSD checkpoint box pattern)
```javascript
function renderRecoveryPrompt(payload, opts = {}) {
  const output = opts.output || process.stdout;
  output.write('\n');
  output.write('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n');
  output.write(`\u2551  COMMAND FAILED (exit code ${payload.exitCode})${' '.repeat(Math.max(0, 38 - String(payload.exitCode).length))}\u2551\n`);
  output.write('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');
  output.write(`\n$ ${payload.command}\n\n`);
  output.write(`${payload.stderrHint}\n\n`);
  output.write('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n');
  output.write('  1) Retry\n');
  output.write('  2) Edit\n');
  output.write('  3) Abort\n');
  output.write('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n');
}
```

### Same Root Cause Detection
```javascript
// Compare exit code + command identity to determine if failure is "same root cause"
function isSameRootCause(current, previous) {
  if (!previous) return false;
  return current.exitCode === previous.exitCode
    && current.command === previous.command;
}
```

### Session Recording with Swallowed Errors
```javascript
// At dispatcher call site, after runner returns
try {
  appendRecord(sessionPath, {
    command: action.command,
    exitCode: res.code,
    stderrSnippet: (res.stderr || '').slice(-500),
  });
} catch (_err) {
  // Session is non-critical -- swallow silently per CONTEXT.md decision
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dispatchSelection returns {ran, result} with no error info | Phase 14 adds recovery loop and session recording | This phase | Callers get error recovery UX; session history available for future context injection |

## Open Questions

1. **Session file path convention**
   - What we know: CONTEXT.md says `.planning/session.json` (from STATE.md decisions)
   - What's unclear: Whether this should be configurable via opts or hardcoded
   - Recommendation: Pass via `opts.sessionPath` with default `path.join(cwd, '.planning/session.json')` for testability

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `get-shit-done/bin/lib/dispatcher/index.js` (current dispatcher implementation)
- Codebase analysis: `get-shit-done/bin/lib/dispatcher/stderr-bridge.js` (Phase 13 module)
- Codebase analysis: `get-shit-done/bin/lib/session/store.js` (Phase 13 module)
- Codebase analysis: `get-shit-done/bin/lib/dispatcher/edit.js` (existing edit flow)
- Phase 13 SUMMARYs: `13-01-SUMMARY.md`, `13-02-SUMMARY.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all modules are existing project internals, no external dependencies
- Architecture: HIGH - straightforward wiring of tested leaf modules into existing dispatcher
- Pitfalls: HIGH - identified from codebase patterns and recursive call complexity

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (internal codebase, stable)
