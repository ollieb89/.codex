# Phase 13: Foundation - Research

**Researched:** 2026-02-24
**Domain:** Node.js atomic file I/O, ring-buffer session persistence, stderr capture and redaction
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**RecoveryPayload shape**
- Minimal payload: `exitCode`, `stderrHint` (redacted snippet), `command` (redacted) — no error category or suggested action
- Phase 14 adds recovery routing on top; this module just surfaces the data
- Returns `null` on success (exit code 0) — caller checks for null to know if recovery is needed
- Stderr hint: keep the last N lines (5-10) — most diagnostic content is at the end
- Stderr hint always passes through `redactSecrets` before inclusion in payload

### Claude's Discretion

- Session record shape beyond what SESS-02 specifies (timestamp format, field naming)
- Redaction strategy details (what patterns `redactSecrets` catches, placeholder format) — `redactSecrets` already exists in `dispatcher/sanitize.js`; reuse as-is
- Ring buffer eviction policy (FIFO assumed), whether buffer size is configurable or hardcoded at 3
- Exact line count for stderr truncation (somewhere in 5-10 range)
- Test structure and assertion patterns for isolation tests

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | Ring buffer stores last 3 dispatch actions in `.planning/session.json` | FIFO eviction with array slice; `readFileSync`/`writeFileSync` via atomic rename |
| SESS-02 | Each record contains sanitized command, exit code, stderr snippet, and timestamp | ISO 8601 timestamp via `new Date().toISOString()`; `redactSecrets` from `dispatcher/sanitize.js` |
| SESS-03 | Writes use pid+timestamp temp file + `renameSync` (atomic, crash-safe) | `fs.renameSync` is atomic on POSIX when src and dst are on the same filesystem; temp in same dir as target |
| SESS-04 | File permissions set to `0o600`; all commands pass through `redactSecrets` before write | `fs.chmodSync(path, 0o600)` after write; or `fs.writeFileSync` with `mode` option — but mode is masked by umask; `chmodSync` after write is reliable |
| ERR-01 | Dispatcher surfaces stderr content and exit code to output stream on non-zero exit | `stderr-bridge.js` inspects runner result `{code, stderr}`; returns `RecoveryPayload` or `null` |
</phase_requirements>

---

## Summary

Phase 13 creates two leaf modules — `session/store.js` and `dispatcher/stderr-bridge.js` — that will be composed into the dispatcher in Phase 14. Both modules are intentionally isolated: they must not import from `dispatcher/index.js`. This constraint keeps the dependency graph acyclic and the modules independently testable.

The session store is a JSON ring buffer persisted to `.planning/session.json`. The critical implementation concerns are atomicity (temp-file + `renameSync`), permission hardening (`0o600`), and secret redaction before any write. All three patterns use Node.js built-in `fs` APIs that are well-understood and have no external dependencies.

The stderr bridge is a pure data-transformation function. It accepts a runner result `{code, stdout, stderr}`, and when `code !== 0`, trims stderr to the last N lines and passes it through the existing `redactSecrets` function before returning a `RecoveryPayload`. On `code === 0` it returns `null`. This design keeps Phase 13 free of side effects — the bridge never writes files or talks to the user.

**Primary recommendation:** Use Node.js built-in `fs` module throughout. No external dependencies needed. Place both modules at `get-shit-done/bin/lib/session/store.js` and `get-shit-done/bin/lib/dispatcher/stderr-bridge.js`. Tests go in `__tests__/` siblings using the same `node:test` runner the project already uses.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in (Node 25) | Atomic write, chmod, JSON read/write | Zero deps; `renameSync` is POSIX-atomic on same-filesystem |
| `node:os` | built-in | `os.tmpdir()` for temp file location — NOT used here; temp must be same dir as target | See pitfall below |
| `node:path` | built-in | Construct temp file path alongside target | Already used throughout codebase |
| `node:test` + `node:assert` | built-in (Node 18+) | Test runner used by all existing `__tests__/` files | Consistent with project; no Jest/Vitest needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `redactSecrets` from `./dispatcher/sanitize.js` | internal | Strip secrets from command strings and stderr | Every write path in `store.js`; every `RecoveryPayload` in `stderr-bridge.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:fs` sync rename | `node:fs/promises` async | Async adds complexity; session write is a post-dispatch fire-and-forget side effect; sync is simpler and Phase 14 will wrap in try/catch anyway |
| Hardcoded buffer size 3 | Configurable via env/param | Config adds surface area; SESS-01 specifies 3; hardcode now, extract later if needed |
| `os.tmpdir()` for temp file | Same dir as target | MUST use same dir — `renameSync` is only atomic when src and dst are on the same filesystem (see pitfall) |

**Installation:** No new packages required. All APIs are Node.js built-ins.

---

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/bin/lib/
├── dispatcher/
│   ├── commands.js         # existing
│   ├── edit.js             # existing
│   ├── index.js            # existing — Phase 13 does NOT touch this
│   ├── preview.js          # existing
│   ├── sanitize.js         # existing — redactSecrets imported from here
│   ├── stderr-bridge.js    # NEW in Phase 13
│   └── __tests__/
│       ├── commands.test.js
│       ├── dispatcher.test.js
│       ├── sanitize.test.js
│       └── stderr-bridge.test.js   # NEW in Phase 13
└── session/
    ├── store.js            # NEW in Phase 13
    └── __tests__/
        └── store.test.js   # NEW in Phase 13
```

### Pattern 1: Atomic JSON Write with Temp File

**What:** Write to a `${target}.${pid}.${Date.now()}.tmp` file in the same directory as the target, then `fs.renameSync` to the target path. Apply `fs.chmodSync(target, 0o600)` after rename.

**When to use:** Any time a file must not be observed in a partial-write state and must survive a crash mid-write.

**Example:**
```javascript
// Source: Node.js docs — fs.renameSync is atomic on POSIX same-filesystem
const fs = require('node:fs');
const path = require('node:path');

function atomicWriteJSON(targetPath, data) {
  const dir = path.dirname(targetPath);
  const tmp = path.join(dir, `.session-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, targetPath);
  fs.chmodSync(targetPath, 0o600);
}
```

**Critical:** The temp file MUST be in the same directory (and same filesystem mount) as the target. Using `os.tmpdir()` silently falls back to a non-atomic copy+delete on many Linux configurations where `/tmp` is on `tmpfs` and the project is on a different mount.

### Pattern 2: FIFO Ring Buffer in JSON

**What:** Read existing array from file (default `[]`), push new record, slice to last N entries, write back.

**When to use:** Bounded history with automatic oldest-first eviction.

**Example:**
```javascript
const RING_SIZE = 3;

function appendRecord(filePath, record) {
  let entries = [];
  try {
    entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    // File doesn't exist yet or is corrupt — start fresh
  }
  entries.push(record);
  if (entries.length > RING_SIZE) {
    entries = entries.slice(entries.length - RING_SIZE); // keep last 3
  }
  atomicWriteJSON(filePath, entries);
}
```

### Pattern 3: Stderr Bridge — Pure Function

**What:** Accept runner result, return `RecoveryPayload | null`. No I/O, no side effects.

**When to use:** Isolation boundary between execution and recovery logic.

**Example:**
```javascript
const { redactSecrets } = require('./sanitize');

const STDERR_TAIL_LINES = 7; // within 5-10 range per user decision

function buildRecoveryPayload(runnerResult, command) {
  if (!runnerResult || runnerResult.code === 0) return null;

  const rawStderr = runnerResult.stderr || '';
  const lines = rawStderr.split('\n');
  const tail = lines.slice(-STDERR_TAIL_LINES).join('\n').trim();

  const { redacted: stderrHint } = redactSecrets(tail);
  const { redacted: redactedCommand } = redactSecrets(command || '');

  return {
    exitCode: runnerResult.code,
    stderrHint,
    command: redactedCommand,
  };
}

module.exports = { buildRecoveryPayload };
```

### Pattern 4: Test Isolation — Import Only the Target Module

**What:** `__tests__/store.test.js` imports only `../store.js`. `__tests__/stderr-bridge.test.js` imports only `../stderr-bridge.js`. Neither file imports `dispatcher/index.js`.

**Example:**
```javascript
// store.test.js — correct isolation
const { appendRecord, readRecords } = require('../store');
// NEVER: require('../../dispatcher/index') — would violate success criterion 5

// stderr-bridge.test.js — correct isolation
const { buildRecoveryPayload } = require('../stderr-bridge');
```

### Anti-Patterns to Avoid

- **Temp file in `os.tmpdir()`:** Breaks atomicity when `/tmp` is on a different mount. Always co-locate temp file with target.
- **`writeFileSync` mode option for permissions:** The `mode` option in `writeFileSync` is filtered through the process umask, making it unreliable for enforcing `0o600`. Use `chmodSync` after write.
- **Storing raw command before redaction:** Redact with `redactSecrets` before constructing the session record, not after. Fail-safe direction: if redaction throws, let it propagate rather than storing raw.
- **Catching all errors in `appendRecord` silently:** The session write wrapping try/catch belongs in Phase 14's dispatcher integration, not in the store module itself. The store should be a thin, correct implementation; fault-tolerance is the caller's concern.
- **Importing from `dispatcher/index.js`:** This creates a circular dependency and violates success criterion 5. `stderr-bridge.js` needs only `./sanitize.js`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret redaction | Custom regex in `store.js` or `stderr-bridge.js` | `redactSecrets` from `./dispatcher/sanitize.js` | Already implemented, tested with 30 assertions covering 10 provider patterns + generic fallback |
| Atomic file write | Custom lock files, write-rename logic from scratch | `fs.renameSync` (same dir temp) | POSIX kernel guarantees atomicity; no library needed |
| Test runner | Jest, Vitest | `node:test` + `node:assert` | Already in use across all 126 existing tests; zero setup cost |

**Key insight:** Both new modules are thin wrappers around Node.js built-ins and the existing `redactSecrets` function. The implementation complexity is low; the testing complexity is where the work is.

---

## Common Pitfalls

### Pitfall 1: Cross-Filesystem `renameSync`

**What goes wrong:** `fs.renameSync` throws `EXDEV: cross-device link not permitted` if source and destination are on different filesystems (e.g., `/tmp` is `tmpfs`, project is on ext4).

**Why it happens:** POSIX `rename(2)` is atomic only within the same filesystem. Node.js does not fall back silently — it throws.

**How to avoid:** Construct the temp file path using `path.join(path.dirname(targetPath), ...)` so temp and target share the same directory and filesystem mount.

**Warning signs:** Works in development (single disk), fails in Docker or CI where `/tmp` is a separate mount.

### Pitfall 2: `writeFileSync` Mode Does Not Enforce `0o600`

**What goes wrong:** `fs.writeFileSync(path, data, { mode: 0o600 })` creates the file with permissions filtered through the process umask (e.g., umask `0o022` yields `0o644`, not `0o600`).

**Why it happens:** The `mode` parameter is combined with umask using `mode & ~umask`.

**How to avoid:** Call `fs.chmodSync(targetPath, 0o600)` after `renameSync`. `chmodSync` sets permissions directly without umask filtering.

**Warning signs:** `ls -la .planning/session.json` shows `rw-r--r--` instead of `rw-------`.

### Pitfall 3: JSON Parse Failure Corrupts Session

**What goes wrong:** If `session.json` is empty or malformed (e.g., interrupted write from a previous crash), `JSON.parse` throws and the store becomes permanently broken.

**How to avoid:** Wrap the initial `readFileSync` + `JSON.parse` in a try/catch that defaults to `[]`. This handles: file doesn't exist, file is empty, file has partial content. The atomic write pattern prevents new corruption.

### Pitfall 4: Redacting Stderr AFTER Constructing the Payload Object

**What goes wrong:** If `redactSecrets` is called on the assembled `RecoveryPayload` rather than on the raw strings, nested JSON serialization of the object may introduce formatting that breaks regex matches (e.g., escaped quotes).

**How to avoid:** Call `redactSecrets(rawStderr)` and `redactSecrets(rawCommand)` on raw strings before constructing the payload. Assign `{ redacted }` destructuring directly to payload fields.

### Pitfall 5: Stdout in Session Record

**What goes wrong:** REQUIREMENTS.md explicitly excludes "Full stdout in session file" — unbounded disk growth and stdout may contain secrets. SESS-02 specifies stderr snippet only.

**How to avoid:** The session record shape is: `{ command, exitCode, stderrSnippet, timestamp }` — no `stdout` field.

---

## Code Examples

Verified patterns from Node.js built-in APIs (confirmed against Node 25 `fs` module behavior):

### Session Record Shape (SESS-02 compliant)

```javascript
// Source: REQUIREMENTS.md SESS-02 + CONTEXT.md decisions
function makeRecord(command, exitCode, stderrSnippet) {
  const { redacted: redactedCommand } = redactSecrets(command || '');
  return {
    command: redactedCommand,
    exitCode,
    stderrSnippet, // already redacted by caller (stderr-bridge or store itself)
    timestamp: new Date().toISOString(), // ISO 8601
  };
}
```

### File Permission Check in Tests

```javascript
// Verify 0o600 in test
const stat = fs.statSync(sessionFilePath);
const mode = stat.mode & 0o777; // mask to permission bits only
assert.strictEqual(mode, 0o600, 'session file must be mode 0o600');
```

### Stderr Tail Extraction

```javascript
// Last N lines, ignoring trailing blank lines
function tailLines(str, n) {
  const lines = str.split('\n');
  return lines.slice(-n).join('\n').trim();
}
```

### Test Runner Command (project standard)

```bash
# Run all dispatcher tests
node --test get-shit-done/bin/lib/dispatcher/__tests__/*.test.js

# Run new store tests
node --test get-shit-done/bin/lib/session/__tests__/store.test.js

# Run all tests (126 existing + new)
node --test get-shit-done/bin/lib/dispatcher/__tests__/*.test.js \
          get-shit-done/bin/lib/selector/__tests__/*.test.js \
          get-shit-done/bin/lib/session/__tests__/store.test.js
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External test frameworks (Jest/Mocha) | `node:test` built-in | Node 18 (stable Node 20+) | Zero install, same speed |
| `writeFile` + `chmod` without atomicity | temp-file + `renameSync` + `chmodSync` | Standard POSIX practice | Crash-safe; no partial-read risk |
| Storing full command history without bound | Ring buffer (fixed size, FIFO eviction) | Design decision in SESS-01 | Predictable disk usage |

**Deprecated/outdated:**
- `graceful-fs`: Not needed for this use case. Built-in `fs` handles the retry-on-EMFILE case adequately for a single-file session store.
- Writing `JSON.stringify` without `null, 2` pretty-printing: acceptable for machine-only session files, but pretty-printing makes manual inspection of `.planning/session.json` easier — Claude's discretion call.

---

## Open Questions

1. **Where does `stderr-bridge.js` live — `dispatcher/` or a new top-level `lib/` directory?**
   - What we know: The module imports `redactSecrets` from `./dispatcher/sanitize.js`. If placed in `dispatcher/`, the relative import is clean (`./sanitize`). If placed elsewhere, the import path gets longer.
   - What's unclear: Whether Phase 14 integration into `dispatcher/index.js` is cleaner with sibling placement.
   - Recommendation: Place at `dispatcher/stderr-bridge.js` (sibling to `sanitize.js`). This keeps the import simple and the boundary clear — `stderr-bridge.js` is part of the dispatcher subsystem, just not part of `index.js`.

2. **Should `session/store.js` export a `readRecords()` function for tests, or only `appendRecord()`?**
   - What we know: Tests must verify ring buffer eviction and file content. Without a read function, tests would call `JSON.parse(fs.readFileSync(...))` directly — workable but not idiomatic.
   - Recommendation: Export both `appendRecord(filePath, record)` and `readRecords(filePath)`. The read function is a thin wrapper over `readFileSync` + `JSON.parse` with the same empty-default logic used in append.

3. **Buffer size: hardcode `3` or accept as parameter?**
   - What we know: SESS-01 specifies 3. CONTEXT.md leaves this to Claude's discretion.
   - Recommendation: Export a `RING_SIZE = 3` constant from `store.js` and use it internally. `appendRecord` does not take a size parameter. If a future requirement changes the size, one line changes.

---

## Sources

### Primary (HIGH confidence)

- Node.js 25 `fs` module docs (built-in, runtime-verified by running tests) — `renameSync`, `chmodSync`, `writeFileSync`, `readFileSync`, `statSync`
- Existing codebase: `dispatcher/sanitize.js` — `redactSecrets` function inspected directly; behavior verified by 30 passing tests
- Existing codebase: `dispatcher/__tests__/sanitize.test.js` — test patterns and assertion style
- REQUIREMENTS.md — SESS-01 through SESS-04, ERR-01 requirements text
- CONTEXT.md — locked decisions on `RecoveryPayload` shape, stderr tail lines (5-10), null-on-success

### Secondary (MEDIUM confidence)

- POSIX `rename(2)` atomicity guarantee (cross-filesystem throws EXDEV) — standard POSIX behavior, verified by understanding of OS filesystem semantics; not runtime-tested in this session

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js built-ins, no external packages, runtime-verified test infrastructure
- Architecture: HIGH — derived directly from existing codebase patterns and locked user decisions
- Pitfalls: HIGH (cross-fs rename, chmod/umask) / MEDIUM (JSON corruption recovery) — standard Node.js gotchas, well-documented

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain — Node.js fs APIs do not change rapidly)
