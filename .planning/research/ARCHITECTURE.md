# Architecture Research

**Domain:** Agent-to-local feedback loop — v1.2 integration with existing dispatcher/selector
**Researched:** 2026-02-24
**Confidence:** HIGH — all claims based on direct inspection of the live codebase

---

## Context: What This Document Covers

This document replaces the v1.1 ARCHITECTURE.md for the v1.2 milestone. It focuses exclusively on how four new features integrate with the existing `dispatcher/` and `selector/` subsystems:

- **STDERR Recovery Bridge** — capture dispatch failures, route to agent for fix suggestions
- **Incremental Context Loading** — agents inspect command output before generating next selection
- **Session Persistence** — maintain last 3 actions as local workspace memory
- **Agent Dry-Run Validation** — simulate commands through dispatcher with sanitized preview before confirmation

The v1.1 architecture (normalizer.js, commands.js constants, secret redaction, headless.js) is fully shipped and stable. v1.2 builds on top of it without modifying v1.1 foundations.

---

## Current System Overview (v1.1 Baseline)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Prompts / Agents Layer                          │
│  Markdown/TOML prompts; AI generates numbered-list output            │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ raw AI text
┌──────────────────────▼───────────────────────────────────────────────┐
│               selector/normalizer.js  (v1.1, stable)                 │
│  Re-index AI output → sequential entries[]                           │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ entries[] {id, label, value, payload, metadata}
┌──────────────────────▼───────────────────────────────────────────────┐
│               selector/index.js  (v1.0, stable)                      │
│  Headless shortcut → handleHeadless(); TTY readline loop             │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ selected entry
┌──────────────────────▼───────────────────────────────────────────────┐
│               dispatcher/index.js — dispatchSelection()              │
│  sanitizeAction → renderPreview → confirm → runner                   │
│  dryRun flag already present (opts.dryRun)                           │
│  runner returns {code, stdout, stderr}                               │
└──────────────────────────────────────────────────────────────────────┘
                       │ {ran, result: {code, stdout, stderr}}
                       │ (result currently unused by caller)
                       ▼
                 caller discards result
```

The critical gap for v1.2: `dispatchSelection` returns `{ran, result}` but callers discard it. The `result.stderr` from a failed run is never fed back to the agent. The session has no memory of prior actions. Dry-run is wired in `dispatchSelection` but produces no structured preview artifact for agent consumption.

---

## Standard Architecture

### System Overview — v1.2 Target State

```
┌────────────────────────────────────────────────────────────────────────┐
│                       Prompts / Agents Layer                           │
│  Agents receive: context snapshot + last-N session actions +           │
│  stderr feedback on failure + dry-run preview before commit            │
└───────────────────────┬────────────────────────────────────────────────┘
                        │ raw AI text
┌───────────────────────▼────────────────────────────────────────────────┐
│            selector/normalizer.js  (unchanged v1.1)                    │
└───────────────────────┬────────────────────────────────────────────────┘
                        │ entries[]
┌───────────────────────▼────────────────────────────────────────────────┐
│            selector/index.js  (unchanged v1.0)                         │
└───────────────────────┬────────────────────────────────────────────────┘
                        │ selected entry
┌───────────────────────▼────────────────────────────────────────────────┐
│            dispatcher/index.js — dispatchSelection()                   │
│            [MODIFIED: dry-run returns structured preview artifact]     │
└───────────────────────┬────────────────────────────────────────────────┘
          ┌─────────────┴────────────────────┐
          │ dryRun=true                       │ dryRun=false
          ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────────────────────┐
│ dispatcher/         │           │         runner executes              │
│ preview.js          │           │  {code, stdout, stderr} returned     │
│ (sanitized preview) │           └───────────────┬─────────────────────┘
│ returns             │                           │
│ DryRunResult struct │           ┌───────────────▼──────────────┐
└─────────────────────┘           │ dispatcher/stderr-bridge.js   │
                                  │ [NEW] on code !== 0:          │
                                  │ format stderr + context →     │
                                  │ structured RecoveryPayload    │
                                  └───────────────┬───────────────┘
                                                  │ RecoveryPayload
                                  ┌───────────────▼───────────────┐
                                  │ session/store.js  [NEW]        │
                                  │ append action record (last-3)  │
                                  │ write to .planning/session.json│
                                  └───────────────────────────────┘
```

---

### Component Responsibilities

| Component | Responsibility | v1.2 Status |
|-----------|---------------|-------------|
| `selector/format.js` | ANSI stripping, Unicode-aware width, truncation | STABLE (v1.1) |
| `selector/headless.js` | Headless preselection, audit log to stderr | STABLE (v1.1) |
| `selector/normalizer.js` | Re-index AI numbered output → sequential entries[] | STABLE (v1.1) |
| `selector/index.js` | Entry point: headless shortcut, TTY loop | STABLE (v1.0) |
| `dispatcher/commands.js` | Shared constants: BLOCKED, GRAY, patterns | STABLE (v1.1) |
| `dispatcher/sanitize.js` | Workspace boundary, secret redaction | STABLE (v1.1) |
| `dispatcher/preview.js` | Destructive highlighting, confirmation, dry-run output | MODIFIED: structured DryRunResult |
| `dispatcher/edit.js` | Inline readline or $EDITOR on blocked command | STABLE (v1.0) |
| `dispatcher/index.js` | Orchestrates full pipeline; returns result to caller | MODIFIED: structured return, feeds bridge |
| `dispatcher/stderr-bridge.js` | Capture stderr from failed runs; emit RecoveryPayload | NEW |
| `session/store.js` | Ring buffer of last-3 actions; read/write `.planning/session.json` | NEW |

---

## Recommended Project Structure

```
get-shit-done/bin/lib/
├── selector/                     # (unchanged from v1.1)
│   ├── index.js
│   ├── normalizer.js
│   ├── format.js
│   ├── headless.js
│   └── __tests__/
│       ├── format.test.js
│       ├── headless.test.js
│       ├── normalizer.test.js
│       └── selector.test.js
├── dispatcher/
│   ├── index.js                  # MODIFIED: structured return, dry-run result, bridge call
│   ├── commands.js               # (unchanged from v1.1)
│   ├── sanitize.js               # (unchanged from v1.1)
│   ├── preview.js                # MODIFIED: dry-run returns DryRunResult struct
│   ├── edit.js                   # (unchanged)
│   ├── stderr-bridge.js          # NEW: failure capture + RecoveryPayload formatting
│   └── __tests__/
│       ├── dispatcher.test.js    # MODIFIED: test structured return, dry-run result
│       ├── sanitize.test.js      # (unchanged)
│       └── stderr-bridge.test.js # NEW
└── session/                      # NEW directory
    ├── store.js                  # Ring buffer, read/write session.json
    └── __tests__/
        └── store.test.js         # NEW
```

### Structure Rationale

- **`dispatcher/stderr-bridge.js`** lives in `dispatcher/` because it post-processes a runner result — it is the final stage of the dispatch pipeline. It has no dependency on the selector.
- **`session/store.js`** gets its own directory because it is a cross-cutting concern used by both the dispatcher (to record actions after run) and by prompt/agent callers (to read context before generating next selection). Putting it in `dispatcher/` would create an upward dependency violation if the selector ever needed to read session context.
- **No changes to `selector/`** — the selector remains ignorant of execution outcomes and session state. This preserves the clean selector↔dispatcher boundary from v1.0/v1.1.

---

## Architectural Patterns

### Pattern 1: Structured Return from dispatchSelection

**What:** `dispatchSelection` currently returns `{ran, dryRun, cancelled, reason, result}` where `result` is the raw `{code, stdout, stderr}` from the runner. Callers ignore it. v1.2 promotes `result` to a first-class return value that callers must handle.

**When to use:** Any caller that needs to feed runner output back to an agent.

**Trade-offs:** Callers that currently discard the return value will continue to work (the return shape is additive). New callers opt in to the richer result by reading `result.stderr` and `result.code`.

**Example:**
```javascript
// dispatcher/index.js (modified return)
const res = await runner({ ...action, command: action.command });
const runResult = { code: res.code, stdout: res.stdout, stderr: res.stderr };

// Feed to session store and stderr bridge (new in v1.2)
sessionStore.append({ command: action.command, result: runResult, timestamp: Date.now() });

return {
  ran: true,
  dryRun: false,
  result: runResult,                          // promoted — was already there
  recovery: runResult.code !== 0
    ? stderrBridge.buildPayload(action, runResult)
    : null,                                   // new: null on success, RecoveryPayload on failure
};
```

---

### Pattern 2: STDERR Recovery Bridge (stderr-bridge.js)

**What:** A new module that accepts a failed action and its runner result, formats the stderr into a structured `RecoveryPayload`, and returns it to the caller. The caller (agent or workflow) decides how to handle recovery — the bridge only formats, never prompts.

**When to use:** Whenever `runner` returns `code !== 0`. The bridge is called inside `dispatchSelection` after detecting failure. It never calls `runner` itself.

**Trade-offs:** The bridge is passive — it produces a payload but does not re-run anything. This keeps the module simple and independently testable. Recovery strategy (retry? show to agent? ask user?) remains the caller's responsibility.

**Interface:**
```javascript
// dispatcher/stderr-bridge.js

/**
 * Build a structured recovery payload from a failed dispatch.
 * @param {object} action  — the action that was dispatched
 * @param {object} result  — {code, stdout, stderr} from runner
 * @returns {RecoveryPayload}
 */
function buildPayload(action, result) {
  return {
    command: action.command,
    exitCode: result.code,
    stderr: result.stderr,
    stdout: result.stdout,
    // Summarized hint for agent consumption (first 500 chars of stderr)
    hint: result.stderr ? result.stderr.slice(0, 500).trim() : null,
    timestamp: Date.now(),
  };
}

module.exports = { buildPayload };
```

**Key constraint:** `stderr-bridge.js` has NO imports from `selector/`. Its only dependency is Node.js built-ins (none needed for v1 — pure data transformation). It does not write to disk; that is `session/store.js`'s job.

---

### Pattern 3: Session Store (session/store.js)

**What:** A ring-buffer store (max 3 entries) that persists to `.planning/session.json`. Each entry is an action record: `{command, exitCode, stderr, stdout, timestamp}`. Entries are appended after each dispatch and trimmed to the last 3. The store is read by agents/prompts to provide context for the next selection.

**When to use:** After every `dispatchSelection` call (both success and failure). The session.json file is the workspace memory that closes the agent-to-local loop.

**Trade-offs:** File-based persistence means no memory leaks and natural durability across Claude Code sessions. Three entries is enough context for sequential debugging (last error, last success, prior state) without blowing token budgets when included in prompts.

**Interface:**
```javascript
// session/store.js

const MAX_ENTRIES = 3;

/**
 * Append an action record to the session store.
 * Trims to MAX_ENTRIES (oldest first, newest last).
 * @param {string} cwd
 * @param {object} record — {command, exitCode, stderr, stdout, timestamp}
 */
function append(cwd, record) { ... }

/**
 * Read the current session entries (up to MAX_ENTRIES).
 * Returns [] if file does not exist.
 * @param {string} cwd
 * @returns {object[]}
 */
function read(cwd) { ... }

/**
 * Clear the session store.
 * @param {string} cwd
 */
function clear(cwd) { ... }

module.exports = { append, read, clear };
```

**Storage path:** `.planning/session.json` — co-located with STATE.md and config.json to respect the existing convention that `.planning/` is the workspace memory directory. This means the store naturally lives within the CWD workspace boundary already enforced by the dispatcher.

**No external dependencies.** Uses `node:fs` only.

---

### Pattern 4: Structured Dry-Run Result

**What:** The existing `dryRun` path in `dispatchSelection` writes `"Skip execute: ..."` to stdout and returns `{ran: false, dryRun: true}`. v1.2 extends this to return a structured `DryRunResult` that includes the sanitized command preview, the sanitize status, and a flag for agent consumption.

**When to use:** When an agent wants to validate a command through the full sanitize + preview pipeline before asking the user to confirm execution. The agent receives the dry-run result, displays it (or includes it in the next prompt), then re-runs with `dryRun: false` for actual execution.

**Trade-offs:** Requires the caller to run `dispatchSelection` twice (once dry, once live) for validated execution. This is intentional — dry-run is a validation step, not a caching mechanism. The overhead is one extra pipeline pass with no runner invocation.

**Modified return in `dispatchSelection`:**
```javascript
if (dryRun) {
  // (existing stdout write preserved for backward compat)
  output.write(`[dry-run] ${sanitized.sanitizedCommand || action.command}\n`);
  return {
    ran: false,
    dryRun: true,
    cancelled: false,
    preview: {
      command: sanitized.sanitizedCommand || action.command,
      sanitizeStatus: sanitized.status,           // 'allow' | 'gray' | 'block'
      mutating: MUTATING_PATTERN.test(action.command),
      redactions: sanitized.replacements || [],   // secret fields that were redacted
    },
  };
}
```

**Key constraint:** The `preview.command` in the dry-run result is the **redacted** version (safe for display/logging). This matches the existing redact-for-display, execute-original pattern from v1.1.

---

## Data Flow

### v1.2 Complete Request Flow

```
[Agent generates numbered list]
    │
    ▼
selector/normalizer.js
    │ entries[]
    ▼
selector/index.js (selectOption)
    │ selected entry
    ▼
dispatchSelection(selection, { dryRun: true, cwd })   ← OPTIONAL VALIDATION PASS
    │
    ├── sanitizeAction()
    ├── [dry-run path] → return DryRunResult { preview: { command, sanitizeStatus, mutating, redactions } }
    │
    └── [agent reviews DryRunResult, decides to proceed]
    │
    ▼
dispatchSelection(selection, { dryRun: false, cwd })  ← EXECUTION PASS
    │
    ├── sanitizeAction()
    ├── renderPreview() → stdout
    ├── confirm() if mutating
    ├── runner() → { code, stdout, stderr }
    │
    ├── [success: code === 0]
    │       ├── session/store.js.append(cwd, { command, exitCode:0, stdout, stderr, timestamp })
    │       └── return { ran: true, result: { code, stdout, stderr }, recovery: null }
    │
    └── [failure: code !== 0]
            ├── dispatcher/stderr-bridge.js.buildPayload(action, result) → RecoveryPayload
            ├── session/store.js.append(cwd, { command, exitCode, stdout, stderr, timestamp })
            └── return { ran: true, result: { code, stdout, stderr }, recovery: RecoveryPayload }
```

### Incremental Context Loading Flow

```
[Before generating next selection]
    │
    ▼
session/store.js.read(cwd)
    │ last-3 action records [{command, exitCode, stderr, stdout, timestamp}]
    │
    ▼
[Caller/agent formats records into prompt context]
    │ "Last 3 actions: [1] git add . (exit 0) [2] git commit ... (exit 128, stderr: ...)"
    │
    ▼
[Agent generates next numbered list, informed by prior outcomes]
```

### State Management

```
.planning/session.json          ← session/store.js manages this
.planning/STATE.md              ← state.cjs manages this (unchanged)
.planning/config.json           ← config.cjs manages this (unchanged)
```

The session store is intentionally separate from STATE.md because:
1. session.json is ephemeral workspace memory (last 3 actions, rewritten often)
2. STATE.md is durable planning state (phase progress, decisions, blockers)
3. Keeping them separate avoids parsing complexity and race conditions

---

## Integration Points with Existing Modules

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `dispatcher/index.js` → `stderr-bridge.js` | `buildPayload(action, result)` call | bridge is called inside dispatchSelection after runner; pure data transform, no I/O |
| `dispatcher/index.js` → `session/store.js` | `append(cwd, record)` call | called after every runner invocation (success and failure); store handles file I/O |
| `session/store.js` ← caller | `read(cwd)` call | agent/workflow reads context before generating next selection; store returns array |
| `dispatchSelection` return | `{ran, dryRun, cancelled, result, recovery, preview}` | additive — existing callers unaffected; `recovery` and `preview` are new optional fields |
| `selector/` modules | unchanged | no new dependencies on session or bridge modules |

### What Does NOT Change

| Module | Why Stable |
|--------|-----------|
| `selector/normalizer.js` | v1.2 features are post-dispatch; normalizer is pre-dispatch |
| `selector/index.js` | No awareness of execution outcomes or session state |
| `selector/headless.js` | No changes needed; headless path still routes through dispatchSelection |
| `selector/format.js` | UI rendering only; no execution awareness |
| `dispatcher/sanitize.js` | Dry-run validation uses existing sanitizeAction(); no changes needed |
| `dispatcher/commands.js` | Constants unchanged |
| `dispatcher/edit.js` | Blocked-command editing unchanged |
| `state.cjs` | STATE.md operations unaffected |
| `gsd-tools.cjs` router | No new top-level commands needed for v1.2 features |

### New Dependency Graph

```
session/store.js
  └── requires: node:fs, node:path   (no internal deps)

dispatcher/stderr-bridge.js
  └── requires: (none — pure data transform)

dispatcher/index.js (modified)
  └── requires: (existing) sanitize, preview, edit, commands
  └── requires: (new) ./stderr-bridge
  └── requires: (new) ../session/store
```

**The session/store path from dispatcher/index.js:** `require('../session/store')` — the `session/` directory is a sibling of `dispatcher/` under `lib/`. This is the only new cross-directory dependency introduced in v1.2.

---

## Anti-Patterns

### Anti-Pattern 1: Retrying Inside the Bridge

**What people do:** Make `stderr-bridge.js` re-invoke `runner` with a corrected command as an attempt at auto-recovery.

**Why it's wrong:** Auto-retry on STDERR creates a recursive failure loop. The bridge has no context about whether a retry is safe, idempotent, or desired. It bypasses the confirm gate for mutating commands.

**Do this instead:** The bridge returns a `RecoveryPayload` to the caller. The caller (agent or workflow) decides whether to retry, prompt the user, or give up. The retry, if attempted, goes through the full `dispatchSelection` pipeline (sanitize → preview → confirm → run).

---

### Anti-Pattern 2: Writing Session State Inside the Bridge

**What people do:** Have `stderr-bridge.js` write to `session.json` directly as a side effect of `buildPayload`.

**Why it's wrong:** The bridge becomes stateful and has a hidden file I/O side effect. Unit tests must now mock the filesystem. The bridge's single responsibility is formatting a RecoveryPayload from a failed result.

**Do this instead:** `dispatcher/index.js` calls both `stderrBridge.buildPayload()` and `sessionStore.append()` separately. Each module does one thing.

---

### Anti-Pattern 3: Including Full stdout/stderr in Session Records

**What people do:** Write the complete stdout and stderr from every command into `session.json` without truncation.

**Why it's wrong:** A single command output (e.g., `npm install`) can produce hundreds of kilobytes. Three such records in session.json make prompt context bloated and slow. Token budget for incremental context loading is the primary constraint.

**Do this instead:** Truncate `stderr` and `stdout` to a fixed limit (recommended: 2000 characters each) before writing to the session store. The `hint` field in `RecoveryPayload` is already limited to 500 characters for the same reason.

---

### Anti-Pattern 4: Making dispatchSelection Wait for Session Write

**What people do:** `await sessionStore.append(...)` inside `dispatchSelection` before returning, blocking the caller.

**Why it's wrong:** Session persistence is best-effort bookkeeping — a failed write to session.json should never fail the dispatch. The user should get their result; the session record is a bonus.

**Do this instead:** Wrap the `sessionStore.append()` call in a try/catch that silently swallows errors. If the file write fails (permissions, disk full), the dispatch result is still returned normally.

```javascript
// dispatcher/index.js
try {
  sessionStore.append(cwd, { command: action.command, exitCode: res.code, ... });
} catch (_) {
  // session write failure is non-fatal
}
```

---

### Anti-Pattern 5: Session Store in a Non-CWD Location

**What people do:** Write `session.json` to a fixed global path like `~/.gsd/session.json`.

**Why it's wrong:** The toolkit enforces a strict CWD workspace boundary. A global session file would contain commands from multiple projects mixed together, breaking incremental context loading (which is project-scoped).

**Do this instead:** Store at `{cwd}/.planning/session.json`. The `cwd` is always passed as a parameter, consistent with all other modules that write to `.planning/`.

---

## Suggested Build Order

Dependencies between the four v1.2 features determine the correct sequence:

```
1. session/store.js                    [no internal deps — start here]
       └── session/__tests__/store.test.js

2. dispatcher/stderr-bridge.js         [no deps — parallel with step 1]
       └── dispatcher/__tests__/stderr-bridge.test.js

3. dispatcher/index.js                 [depends on steps 1 and 2]
       • import stderr-bridge.js
       • import session/store.js
       • structured return: add recovery + preview fields
       • dry-run returns DryRunResult
       • session append wrapped in try/catch
       └── dispatcher/__tests__/dispatcher.test.js   [update existing tests]

4. dispatcher/preview.js               [if DryRunResult needs preview.js changes]
       • optional: expose sanitize status in dry-run output
       └── dispatcher/__tests__/  [update if modified]
```

**Rationale:**
- Steps 1 and 2 have zero internal dependencies and can be built in parallel.
- Step 3 (`dispatcher/index.js`) is the integration point — it requires both the bridge and the store to be stable before modification.
- Step 4 is optional and deferred: the current dry-run path in `dispatcher/index.js` can return a structured result without changes to `preview.js`, since `sanitizeAction()` already returns `sanitized.status` and `sanitized.sanitizedCommand`.

**Test count expectation:**
- `session/store.test.js`: ~10 tests (append, read, clear, truncation, ring-buffer trim, missing file, write failure)
- `stderr-bridge.test.js`: ~8 tests (non-zero exit, zero exit returns null, stderr truncation, stdout capture, null stderr handling)
- `dispatcher.test.js` additions: ~6 new tests (structured return on success, structured return on failure, recovery field present/absent, dry-run preview struct, session record written)

Total expected new tests: ~24. Combined with existing 126, target is ~150 tests at v1.2 completion.

---

## Scaling Considerations

This is a local CLI toolkit — scaling to N users is not a concern. The relevant "scale" question is token budget for incremental context.

| Concern | Conservative Limit | Rationale |
|---------|-------------------|-----------|
| Session entries (ring buffer) | 3 | Enough for "last error, last success, prior state" without exceeding 2K tokens in context |
| stderr truncation per entry | 2000 chars | First 2K captures the error message; build output beyond this adds noise |
| stdout truncation per entry | 2000 chars | Most commands produce short output; build logs are captured elsewhere |
| session.json total file size | ~15KB max | 3 × (2K stderr + 2K stdout + metadata) stays well under any file I/O concerns |

---

## Sources

- Direct code inspection: `get-shit-done/bin/lib/dispatcher/index.js` — confirmed `dryRun` flag, `runner` return shape, current return struct (2026-02-24)
- Direct code inspection: `get-shit-done/bin/lib/dispatcher/sanitize.js` — confirmed `{status, sanitizedCommand, replacements}` return shape (2026-02-24)
- Direct code inspection: `get-shit-done/bin/lib/dispatcher/preview.js` — confirmed no dry-run structured output currently (2026-02-24)
- `.planning/PROJECT.md` — v1.2 feature list and constraints (zero external dependencies, CWD boundary, no major rewrites)
- `.planning/codebase/ARCHITECTURE.md` — file-based state, `.planning/` as workspace memory directory convention
- Prior `.planning/research/ARCHITECTURE.md` (v1.1) — component boundaries, data flow, anti-patterns still valid

---

*Architecture research for: v1.2 agent-to-local feedback loop integration*
*Researched: 2026-02-24*
