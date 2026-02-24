# Project Research Summary

**Project:** Codex CLI — agent-to-local feedback loop (v1.2)
**Domain:** Node.js CLI toolkit — agentic dispatch with STDERR recovery, session persistence, context loading, and dry-run validation
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

Codex v1.2 extends an already-stable dispatcher/selector CLI toolkit with four features that close the agent feedback loop: STDERR recovery, incremental context loading, session persistence, and structured dry-run validation. All research confirms this is a well-understood pattern, directly comparable to Warp AI terminal, GitHub Copilot CLI, and Spotify's background coding agent. The recommended approach is entirely additive — no new external dependencies, no rewrites. Two new modules (`dispatcher/stderr-bridge.js`, `session/store.js`) and targeted modifications to `dispatcher/index.js` and `dispatcher/preview.js` cover the full scope. The existing `redactSecrets`, `sanitizeAction`, `editCommand`, and `dryRun` flag paths are all reused directly.

The biggest risk in this milestone is not technical complexity — the individual changes are modest — but the security surface that opens when agent-generated content (recovery suggestions, context payloads, session entries) is handled without consistent redaction. Every string crossing from command execution into agent-visible state must pass through `redactSecrets`. The second risk is architectural: recovery retry commands must re-enter `dispatchSelection` with full sanitization, not bypass it via a direct runner call. Both risks have clear prevention patterns and verification tests; they need discipline in implementation.

The recommended build order is: (1) `session/store.js` and `dispatcher/stderr-bridge.js` in parallel (no internal deps), then (2) wire both into `dispatcher/index.js`, then (3) extend the dry-run return path in `dispatcher/index.js`/`dispatcher/preview.js`. This sequencing means each step is independently testable before integration. Target is approximately 150 total tests at v1.2 completion (up from 126).

---

## Key Findings

### Recommended Stack

No new external dependencies are introduced. All four features use Node.js built-ins exclusively, consistent with the project's zero-external-deps constraint. The runtime is Node.js 25.6.1, and all required APIs (`child_process.exec`, `execFileSync`, `fs`, `path`, `os`) are confirmed working on this machine.

**Core technologies:**
- `node:child_process` (`exec`): STDERR recovery — already used in `defaultRunner`; stderr is already buffered separately in `result.stderr`
- `node:child_process` (`execFileSync`): Incremental context loading (git status, ls capture) — uses argv array to avoid shell injection; scoped to `cwd` with `maxBuffer: 64KB`
- `node:fs` (sync): Session persistence — follows existing `state.cjs` convention; single-process CLI, sync I/O is correct
- `node:path` / `node:os`: Path resolution for session file — already used throughout codebase

**New files to create:**
- `get-shit-done/bin/lib/dispatcher/stderr-bridge.js` — pure data transform, no I/O, no imports
- `get-shit-done/bin/lib/session/store.js` — ring buffer (max 3 entries), `node:fs` only

**Modified files:**
- `get-shit-done/bin/lib/dispatcher/index.js` — structured return, bridge call, session append
- `get-shit-done/bin/lib/dispatcher/preview.js` — dry-run returns `DryRunResult` struct

### Expected Features

**Must have (table stakes — ship in v1.2):**
- STDERR surfacing on non-zero exit — eliminates silent failures; approximately 5-line change in `dispatchSelection`
- STDERR recovery bridge — on non-zero exit: prompt Retry / Edit (reuse `editCommand`) / Abort; closes the agent feedback loop
- Enriched dry-run result — add `sanitizedCommand`, `redactions`, `estimatedMutating` to `{ran:false, dryRun:true}`; enables test assertions on dispatch pipeline
- Session persistence (last 3 actions) — ring-buffer JSON at `.planning/session.json`; write sanitized command, exit code, stderr snippet, timestamp
- Context envelope return — `dispatchSelection` returns `context:{stdout,stderr,exitCode,command}` (capped at 2KB each) for the caller to feed into the next agent prompt

**Should have (P2 — ship in v1.2 if straightforward):**
- Context envelope return from `dispatchSelection` — additive fields, low implementation risk, moderate agent value

**Defer to v1.3+:**
- Automatic context injection into prompt templates (`{{context.stdout}}` / `{{context.stderr}}` in Markdown files) — wait for a real consumer
- Session replay as numbered menu — wait for confirmed user demand
- Multi-turn agent loop orchestrator (`runLoop()`) — defer until context envelope stabilizes across real callers

### Architecture Approach

v1.2 builds on top of the v1.1 stable baseline without touching the selector subsystem. The critical gap is that `dispatchSelection` currently returns `{ran, result}` but callers discard it — STDERR from failed runs is never surfaced and there is no session memory. The fix promotes `result` to a first-class return value, adds a passive formatting bridge for failure payloads, and appends records to a file-based ring buffer. The selector layer (`normalizer.js`, `index.js`, `headless.js`, `format.js`) has zero changes.

**Major components:**
1. `dispatcher/stderr-bridge.js` — accepts `(action, result)` where `result.code !== 0`; returns a `RecoveryPayload` with `hint` (first 500 chars of stderr, redacted); pure data transform, no I/O
2. `session/store.js` — `append(cwd, record)` / `read(cwd)` / `clear(cwd)`; ring buffer (max 3 entries); writes to `{cwd}/.planning/session.json`; atomic write via pid+timestamp temp file + `renameSync`; file permissions `0o600`
3. `dispatcher/index.js` (modified) — calls bridge and store after runner; extends return to `{ran, dryRun, cancelled, result, recovery, preview}`; session append wrapped in try/catch (non-fatal)
4. `dispatcher/preview.js` (modified) — dry-run returns `DryRunResult { preview: { command, sanitizeStatus, mutating, redactions } }` instead of bare `{ran:false, dryRun:true}`

**New dependency edge:** `dispatcher/index.js` requires `../session/store` is the only new cross-directory dependency.

### Critical Pitfalls

1. **STDERR forwarded to agent without redaction** — `result.stderr` (and `err.message`) must pass through `redactSecrets` before reaching the bridge output; shell errors often echo the original command verbatim including secrets. Prevention: explicit test with a token-pattern fixture; assert `[REDACTED]` in bridge output.

2. **Session file stores raw `action.command` instead of `sanitized.sanitizedCommand`** — the sanitizer was designed for preview, not storage; developers reach for the convenient `action` object when session persistence is added later. Prevention: session store API must accept only `sanitizedCommand`; test that reads session file on disk and asserts the raw token is absent.

3. **Recovery retry commands bypass `dispatchSelection`** — implementing retry as a direct `runner()` call skips workspace boundary check, blocklist, and secret redaction. Prevention: all recovery suggestions must re-enter `dispatchSelection` as a new `selection` object.

4. **Dry-run preview diverges from actual execution** — `--force` stripping regex in `sanitize.js` matches any `--force` in the command string, including the user's own `git push --force`; user approves a preview that does not reflect what executes. Prevention: scope GSD's `--force` stripping to dispatch-level flag position only; add a `git push --force` fidelity test.

5. **Context payload bloat — full stdout passed to agent without cap** — a single `npm install` or `git log` can produce hundreds of kilobytes. Cap stdout/stderr at 2,000 bytes before running `redactSecrets`; include `truncated: true` flag; for clean exits pass `{ success: true, exitCode: 0 }` without stdout.

---

## Implications for Roadmap

Based on research, suggested phase structure (4 phases ordered by internal dependency):

### Phase 1: Foundation — Session Store and STDERR Bridge
**Rationale:** Both new modules have zero internal dependencies and can be built and fully tested in isolation before the dispatcher is touched. Starting here de-risks the integration step (Phase 2) by ensuring stable, independently-verified building blocks. ARCHITECTURE.md recommends building these in parallel.
**Delivers:** `session/store.js` (ring buffer, atomic write, file permissions `0o600`) and `dispatcher/stderr-bridge.js` (RecoveryPayload formatter, redaction enforced)
**Addresses:** Session persistence (table stakes), STDERR recovery foundation
**Avoids:** Pitfall 2 (session stores raw command) — enforced by store API design; Pitfall 1 (unredacted stderr) — enforced in bridge module

### Phase 2: Dispatcher Integration — Structured Return and Session Wiring
**Rationale:** Depends on Phase 1 being stable. This is the single highest-impact change: promoting `result` to a first-class return value and wiring the bridge and store calls into `dispatchSelection`. All other features flow from this structured return.
**Delivers:** Modified `dispatcher/index.js` with `recovery` field on failure, session append on every dispatch (try/catch wrapped), structured return shape `{ran, result, recovery, preview}`
**Uses:** `stderr-bridge.js` and `session/store.js` from Phase 1; existing `sanitizeAction`, `defaultRunner`
**Avoids:** Pitfall 3 (recovery bypass) — retry path documented as `dispatchSelection` re-entry; Pitfall 5 (session write blocks dispatch) — try/catch wraps `store.append`

### Phase 3: Dry-Run Validation — Structured Preview Result
**Rationale:** Extends the existing `dryRun` flag path in `dispatcher/index.js` (lines 84-87) with a `DryRunResult` struct. Depends on Phase 2 because the structured return shape is now established. This is a purely additive, backwards-compatible change; existing callers checking `result.dryRun === true` are unaffected.
**Delivers:** `DryRunResult { preview: { command, sanitizeStatus, mutating, redactions } }` from `dispatchSelection` when `opts.dryRun = true`; enables CI test assertions on dispatch pipeline without executing commands
**Avoids:** Pitfall 4 (dry-run divergence) — same code path as live dispatch, short-circuit only at runner; Pitfall 8 (--force stripping) — fidelity test enforced here

### Phase 4: Context Envelope and Incremental Context Loading
**Rationale:** Depends on Phase 2's structured return (`result.stdout`, `result.stderr`, `result.code` promoted to first-class). The context envelope is a low-risk additive return field; the incremental context loading contract is a calling convention, not a new module. Defer prompt template integration to v1.3.
**Delivers:** `context:{stdout,stderr,exitCode,command}` (each capped at 2KB, redacted) returned from `dispatchSelection`; `dispatcher/context.js` for `execFileSync` git status and ls capture; documented context envelope contract for agent callers
**Avoids:** Pitfall 6 (context bloat) — 2KB cap enforced and tested with 1,000-line fixture; Pitfall 10 (out-of-workspace output in context) — only capture output from `status: 'allow'` dispatches

### Phase Ordering Rationale

- Phases 1 and 2 must be sequential because the dispatcher integration depends on stable bridge and store modules.
- Phase 3 is independent of Phase 4 — dry-run enrichment and context loading do not interact; they can be swapped or parallelized if desired.
- All phases produce independently testable artifacts — approximately 10 tests for store, 8 for bridge, 6 new dispatcher tests, 8 for context/dry-run. Total target: approximately 150 tests (from 126).
- No phase requires external research — all APIs are Node.js built-ins verified on this runtime.

### Research Flags

Phases with standard, well-documented patterns — no `/gsd:research-phase` needed:
- **Phase 1 (Session Store + STDERR Bridge):** Pure Node.js `fs` and data transform. Pattern is identical to existing `state.cjs`. Atomic write via temp file + `renameSync` is standard POSIX practice.
- **Phase 2 (Dispatcher Integration):** Additive modifications to an existing, well-tested module. Integration points are fully mapped in ARCHITECTURE.md with line-number references.
- **Phase 3 (Dry-Run Validation):** Extends an existing `dryRun` flag path. Purely additive return shape.
- **Phase 4 (Context Envelope):** `execFileSync` with `git status --porcelain` and `ls -1` is verified working. Cap and redaction pattern is documented.

All four phases are well-understood with implementation patterns verified by direct codebase inspection. No phases require research-phase during planning.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified by direct runtime test on Node.js 25.6.1; no new dependencies; `execFileSync` and `fs` behaviour confirmed |
| Features | HIGH | Feature set validated against Warp AI, GitHub Copilot CLI, Spotify coding agent patterns; all four features have confirmed integration points in existing codebase |
| Architecture | HIGH | All claims from direct code inspection of `dispatcher/index.js`, `sanitize.js`, `preview.js`, `state.cjs`; integration boundaries mapped with line numbers |
| Pitfalls | HIGH | 10 pitfalls sourced from real bug reports (Gemini CLI race condition issue #18504, Claude Code session issue #24125) and direct gap analysis of existing sanitizer code paths |

**Overall confidence:** HIGH

### Gaps to Address

- **`--force` stripping scope in `sanitize.js`:** Research identified that the current regex may strip user-intended `--force` flags (e.g., `git push --force`) alongside GSD's own dispatch-level flag. Needs a focused code review of the stripping regex before Phase 3 work begins. Resolution: read `sanitize.js` at phase planning time and scope the regex fix precisely.

- **`isRecoverable` classifier threshold:** The recommended heuristic (`code > 0 && code <= 127 && stderr.length > 0`) is a reasonable starting point, but exact boundaries for exit codes 125-127 may need tuning based on observed failures. Resolution: implement with the documented heuristic and adjust within the same phase.

- **Session file location discrepancy:** STACK.md and FEATURES.md each suggest slightly different paths (`.planning/session.json` vs `.codex-session/history.jsonl`). ARCHITECTURE.md resolves this in favor of `.planning/session.json` to match the existing workspace memory convention. Confirm in the Phase 1 plan.

---

## Sources

### Primary (HIGH confidence)
- Direct runtime verification: Node.js 25.6.1 — `child_process.exec`, `execFileSync`, `fs`, `path`, `os` all confirmed importable and functional
- Direct code inspection: `dispatcher/index.js` lines 8-19 (runner captures stderr), lines 84-87 (existing dryRun path)
- Direct code inspection: `dispatcher/sanitize.js` — `sanitized.sanitizedCommand`, `sanitized.redactions`, `sanitized.status` all computed before dryRun guard
- Direct code inspection: `state.cjs` — synchronous `fs.readFileSync`/`fs.writeFileSync` on `.planning/` as established codebase convention
- `.planning/PROJECT.md` — v1.2 feature list, zero external deps constraint, CWD boundary requirement

### Secondary (MEDIUM confidence)
- Gemini CLI issue #18504 — race condition in atomic write with fixed temp filenames; informed atomic write pattern recommendation
- Claude Code issue #24125 — race condition in session storage path initialization
- Manus context engineering blog — context size vs. agent quality tradeoff; supports 2KB cap recommendation
- Spotify Engineering (Dec 2025) — feedback loops in background coding agents; confirms session memory pattern
- GitHub Copilot CLI changelog (Jan 2026) — context management patterns; confirms context envelope calling convention
- agentic-patterns.com — coding agent CI feedback loop; confirms recovery bridge design pattern

### Tertiary (LOW confidence — informational only)
- Warp AI terminal, OpenClaw agent, Pydantic-AI coding agent articles — comparative feature patterns (not primary implementation sources)

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
