# Stack Research

**Domain:** Node.js CLI toolkit — agent-to-local feedback loop (v1.2)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Context: What Already Exists (Do Not Re-research)

The codebase runs on Node.js 25.6.1 with zero external runtime dependencies. All four new
features build on top of the existing dispatcher (`exec` runner in `dispatcher/index.js`,
sanitize, preview) and selector subsystems. This file covers ONLY what is new for v1.2.

Confirmed existing capabilities:
- `exec` runner already captures `{ code, stdout, stderr }` — verified by code inspection of `dispatcher/index.js` lines 8-19
- `dispatchSelection` already has a `dryRun` code path (lines 84-87) but returns no structured preview data
- `sanitized` object (containing `sanitizedCommand`, `status`, `redactions`) is fully computed before the `dryRun` guard fires
- `state.cjs` establishes the pattern: synchronous `fs.readFileSync`/`fs.writeFileSync` on `.planning/` files

---

## Recommended Stack

### Core Technologies

No new technologies. All four features use Node.js built-ins exclusively.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 25.6.1 (current runtime) | Execution environment for all four features | Already running; all required built-ins present and runtime-verified |
| `node:child_process` — `exec` | built-in | STDERR recovery bridge | Already used in `defaultRunner`; stderr is already buffered separately in `result.stderr`. The bridge is a logic layer on the existing return value, not an API change |
| `node:child_process` — `execFileSync` | built-in | Incremental context loading (git status, ls capture) | No shell invocation (argv array, not shell string) — no injection surface. Hard-cap with `maxBuffer` + `timeout` options. Verified working on this runtime |
| `node:fs` (sync) | built-in | Session persistence JSON store | Already the codebase convention in `state.cjs`. Sync I/O is correct for a single-process CLI; no concurrency to coordinate |
| `node:path` | built-in | Session file path resolution | Already used throughout; no change needed |
| `node:os` | built-in | `os.homedir()` as fallback for locating session file | Already used in `dispatcher/edit.js` for tmpdir |

### Feature-to-API Mapping

| Feature | Node.js APIs Used | Integration Point | What Changes |
|---------|------------------|-------------------|--------------|
| STDERR recovery bridge | `child_process.exec` (already in place) | `dispatcher/index.js` — post-`runner()` call | Add check: `if (res.code !== 0 && res.stderr?.trim())` then return `{ ran: true, failed: true, result: res, stderrSummary: res.stderr.slice(0, 500) }`. Cap stderr at 500 chars to prevent flooding agent context |
| Incremental context loading | `child_process.execFileSync` | New `dispatcher/context.js` module | `execFileSync('git', ['status','--porcelain'])` and `execFileSync('ls', ['-1'])` scoped to `cwd`. Return `{ gitStatus, lsEntries, capturedAt }`. Wrap each in try/catch — git may not be installed or CWD may not be a repo |
| Session persistence | `node:fs` sync, `node:path`, `JSON.parse`/`JSON.stringify` | New `dispatcher/session.js` module | Write to `<cwd>/.planning/session.json`. Keep last 3 action records as an array. Per dispatch: load → push → slice(-3) → write. Guard against corrupt JSON by wrapping parse in try/catch |
| Agent dry-run validation | No new APIs — extend existing `dryRun` path | `dispatcher/index.js` lines 84-87 | Change return value from `{ ran: false, dryRun: true, cancelled: false }` to add `preview: { sanitizedCommand, diff, impact, sourceAgentId, sanitizeStatus, redactions }`. All fields already computed above the guard. Backwards-compatible additive change |

### Supporting Built-ins (no change to existing usage)

| Built-in | Purpose | When to Use |
|---------|---------|-------------|
| `JSON.parse` / `JSON.stringify` | Session record serialisation | Session persistence load-parse-push-serialise-write cycle |
| `Date.now()` | Timestamps for session action records and context snapshots | Each dispatch call that writes a session record |
| `Array.prototype.slice(-3)` | Rolling window enforcement | Session store — ensures exactly last 3 records after push |
| `fs.mkdirSync(dir, { recursive: true })` | Create `.planning/` if missing on first run | Session persistence initialisation |
| `try/catch` + `fs.existsSync` | Graceful init of missing session file | Session persistence — first run creates file; subsequent runs load it |

---

## Installation

No new packages. Zero external dependencies maintained.

```bash
# No install step required — all Node.js built-ins

# New files to create:
#   get-shit-done/bin/lib/dispatcher/context.js   (incremental context loading)
#   get-shit-done/bin/lib/dispatcher/session.js   (session persistence)

# Files to modify:
#   get-shit-done/bin/lib/dispatcher/index.js     (STDERR bridge + dry-run return value extension)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `exec` (existing) for STDERR bridge | Migrate to `spawn` with streaming stderr pipes | Only if commands produce large continuous output streams that need line-by-line handling. For shell commands completing in <5s the buffered approach via `exec` is simpler and already in place |
| `execFileSync` for context capture | `execSync` (shell string) | Never prefer — `execSync` passes command through `/bin/sh`, which introduces shell metacharacter injection risk if any CWD path segment contains special characters |
| Workspace-scoped `session.json` in `.planning/` | `~/.codex/gsd-session.json` (home dir) | Home dir only if you want cross-project session persistence intentionally. Per-workspace file matches the `.planning/` convention, is gitignore-able per project, and avoids leaking stale commands from unrelated projects into agent context |
| Synchronous `fs` for session I/O | Async `fs/promises` | Async only if session reads/writes happen inside an async pipeline with other I/O that benefits from parallelism. The CLI is single-process; sync keeps call sites identical to the existing `state.cjs` pattern |
| Extend `dryRun` return value in-place | Separate `dryRunValidate()` export | Separate export only if the preview pipeline diverges significantly from dispatch. Currently they share the same sanitize/preview path — in-place extension is non-breaking and avoids duplication |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `execSync` for context capture | Passes args through `/bin/sh` — shell metacharacters in CWD path segments break it silently | `execFileSync` with explicit argv array |
| External file-locking libraries (`proper-lockfile`, etc.) | Violates zero external deps constraint; unnecessary — CLI is single-process | Plain sync `fs` read/write; single-process assumption is intentional and documented |
| `AsyncLocalStorage` (`node:async_hooks`) for session context propagation | Session state is written to disk and read per-call, not threaded through async call chains | `fs` read/write at dispatch call boundaries |
| `EventEmitter` for STDERR bridge | STDERR recovery is call-and-return (dispatch → check → return structured error), not an event stream. EventEmitter would add indirection with no benefit | Return value extension on `dispatchSelection` |
| `stream.Transform` for stderr passthrough | No streaming STDERR needed — CLI commands complete before output is relevant to agent; `exec` already buffers both streams correctly | Existing `exec` buffering |
| SQLite or any database | Overkill for a 3-record rolling window; violates zero external deps | JSON file via `node:fs` |
| Increasing `exec` `maxBuffer` for context capture | Default 1 MB is enough; increasing it masks runaway output bugs. `execFileSync` with explicit `maxBuffer: 64 * 1024` is the correct boundary | `execFileSync` with explicit cap |
| Entropy-based secret detection on STDERR content | High false-positive rate on base64/hash content in error messages; explicitly out of scope per PROJECT.md | Existing `redactSecrets` from `sanitize.js` applied to STDERR summary if needed |

---

## Stack Patterns by Variant

**For STDERR recovery bridge:**
- Check `res.code !== 0 && res.stderr?.trim()` immediately after `runner()` resolves in `dispatchSelection`
- Return `{ ran: true, failed: true, result: res, stderrSummary: res.stderr.slice(0, 500) }` — 500 char cap prevents flooding agent context
- Do NOT re-throw or call `process.exit` — let the caller decide recovery action
- If `redactSecrets` from `sanitize.js` is applied to `stderrSummary`, it prevents credential leak in error messages forwarded to agent

**For incremental context loading:**
- Always scope `execFileSync` to `opts.cwd || process.cwd()` — never capture global system state
- Wrap both `git` and `ls` in separate try/catch blocks — return partial results when one command fails: `{ gitStatus: null, gitError: 'not a repo', lsEntries: [...] }`
- `git status --porcelain` preferred over `git status` — machine-readable, stable across git versions, no color codes, no pager

**For session persistence:**
- Session file path: `path.join(cwd, '.planning', 'session.json')`
- Create `.planning/` directory if missing: `fs.mkdirSync(dir, { recursive: true })` before first write
- Guard against corrupt JSON: wrap `JSON.parse` in try/catch; on parse failure start fresh with `{ version: 1, actions: [] }`
- Record schema: `{ version: 1, actions: [{ ts, command, code, stderr, cwd }] }`
- Rolling window: `actions.push(newRecord); actions = actions.slice(-3); write back`

**For agent dry-run validation:**
- The `sanitized` object is computed before the `dryRun` guard fires — use it directly
- Extend the `dryRun` return: `{ ran: false, dryRun: true, cancelled: false, preview: { sanitizedCommand, diff: payload.diff, impact: payload.impact, sourceAgentId, sanitizeStatus: sanitized.status, redactions: sanitized.redactions } }`
- This is a backwards-compatible additive change — existing callers checking `result.dryRun === true` ignore the new `preview` key

---

## Version Compatibility

| Module / API | Node.js Minimum | Notes |
|-------------|----------------|-------|
| `execFileSync` with `maxBuffer` + `timeout` options | Node.js 0.12+ | Available on all Node versions; verified on v25.6.1 |
| `fs.mkdirSync` with `{ recursive: true }` | Node.js 10.12+ | Required for session directory creation; available on v25.6.1 |
| `JSON.parse` / `JSON.stringify` | All versions | No version constraint |
| `Array.prototype.slice(-N)` | All versions | No version constraint |
| `String.prototype.slice(0, N)` | All versions | Used for STDERR cap |

---

## Sources

- **Verified by direct runtime test on this machine** — `node --version` → v25.6.1; `child_process.exec`, `child_process.execFileSync`, `node:fs`, `node:path`, `node:os` all confirmed importable and functional. `execFileSync` with `git status --porcelain` and `ls -1` both verified working with correct output (HIGH confidence)
- **Verified by code inspection — `dispatcher/index.js`** — Lines 8-19: `exec` runner already returns `{ code, stdout, stderr }`. Line 11: `exec` called with `(err, stdout, stderr)` callback — stderr already separated. Lines 84-87: existing `dryRun` path confirmed returns no preview data. Line 99: `runner()` return value is passed through as `result` in dispatch return — `result.stderr` available to callers (HIGH confidence)
- **Verified by code inspection — `dispatcher/sanitize.js`** — `sanitized.sanitizedCommand`, `sanitized.redactions`, `sanitized.status` all computed in `sanitizeAction()` before `dispatchSelection` reaches the `dryRun` guard. Available in scope for dry-run return extension without re-computation (HIGH confidence)
- **Verified by code inspection — `state.cjs`** — Synchronous `fs.readFileSync`/`fs.writeFileSync` on `.planning/` files is the established codebase convention. Session persistence follows this exact pattern (HIGH confidence)
- **Node.js documentation (built-in knowledge)** — `execFileSync` bypasses shell because it takes argv array directly; confirmed no shell injection surface. `exec` buffers stdout and stderr as separate strings in the callback. Both behaviours confirmed by runtime tests above (HIGH confidence)

---

*Stack research for: Codex CLI v1.2 — agent-to-local feedback loop*
*Researched: 2026-02-24*
