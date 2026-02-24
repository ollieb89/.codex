# Pitfalls Research

**Domain:** Adding STDERR recovery bridge, incremental context loading, session persistence, and agent dry-run validation to an existing Node.js/CJS CLI agent toolkit (v1.2 milestone)
**Researched:** 2026-02-24
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: STDERR Recovery Sends Unredacted Error Output to the Agent

**What goes wrong:**
The STDERR recovery bridge captures the raw stderr string from a failed dispatch and forwards it to the agent for analysis. If the command that failed contained a secret (e.g., `curl -H "Authorization: Bearer $TOKEN"`) the error output from the shell may echo the original command back verbatim — with the secret intact. This is immediately passed to the agent context, where it may be logged, persisted in session history, or sent upstream.

**Why it happens:**
`exec` error callbacks receive `stderr` as a plain string. The dispatcher already calls `redactSecrets` on the command *before* execution for preview purposes, but the `stderr` from the process is a new string — never passed through the sanitizer. Developers treat it as inert diagnostic text and forward it directly.

**How to avoid:**
- Pass every stderr string through `redactSecrets` before it leaves the recovery bridge.
- Apply the same sanitizer to the `err.message` from the exec callback — shell errors frequently reproduce the command.
- Add an explicit test: a command containing a token pattern that fails; assert the recovery bridge output contains `[REDACTED]` and not the raw token.

**Warning signs:**
- Recovery bridge tests that use error fixtures without any secret patterns in the command string.
- Code that concatenates `stderr + err.message` without sanitizing either.
- The existing `sanitizeAction` is only called once (pre-execution) and the result is not reused in the error path.

**Phase to address:** STDERR Recovery Bridge

---

### Pitfall 2: Secret Leakage Into Session Persistence File

**What goes wrong:**
Session persistence stores the last N actions as a local file (e.g., `.codex-session.json`). If a stored action's `command` field contains an unredacted secret — either because the sanitizer was bypassed, or because the redaction ran pre-preview but the original was stored — the secret is written to disk in plaintext and persists across reboots. Any process that reads the session file (including future agents) inherits the secret.

**Why it happens:**
The natural implementation stores the full action payload exactly as dispatched. The sanitizer was designed for *preview*, not *storage*. The two code paths diverge at the point where `action.command` (original) is handed to the runner while `sanitized.sanitizedCommand` is handed to `renderPreview`. Session persistence is a third consumer that is added later and developers reach for the already-constructed `action` object, not the sanitized version.

**How to avoid:**
- Always store `sanitized.sanitizedCommand` (redacted) in session files, never `action.command` (original).
- Add a session storage wrapper that enforces this: accept `{ sanitizedCommand, ...meta }` as its API, not the raw action.
- Add a test: persist an action with a token in the command; read the session file; assert the file does not contain the token pattern.
- Consider a secondary pass of `redactSecrets` at write-time as a last-resort safety net.

**Warning signs:**
- Session persistence code receives the `action` object directly from `dispatchSelection`'s return value.
- Session file format includes a `command` field that is populated from anywhere other than `sanitized.sanitizedCommand`.
- No test reads the session file on disk and asserts absence of secret patterns.

**Phase to address:** Session Persistence

---

### Pitfall 3: Dry-Run Preview Diverges From Actual Execution Path

**What goes wrong:**
Dry-run validation shows a sanitized, redacted preview of what would execute. The actual execution path modifies `action.command` after the dry-run check — for example, the `--force` flag stripping in `sanitizeAction` removes `--force` from `sanitizedCommand` but the runner receives the modified `action.command` (which may or may not have had `--force` stripped depending on whether `sanitizeAction` mutates in place or returns a new object). The user approves the dry-run preview of one command but a slightly different command executes.

**Why it happens:**
The existing dispatcher already does the right thing: dry-run uses `sanitized.sanitizedCommand` for display and returns early. But if dry-run validation is extracted into a reusable helper that callers invoke before the full dispatch, they may run sanitization once for the preview and again at dispatch time — with different results if the action object has been mutated between calls.

**How to avoid:**
- Dry-run must use the *exact same code path* as live execution, short-circuiting only at the runner invocation. Do not implement dry-run as a separate pre-flight check; wrap the existing `dispatchSelection` with `opts.dryRun = true`.
- The current `dryRun` path in `index.js` already returns early after `renderPreview`. Extend this rather than replacing it.
- Add a test that runs the same payload through dry-run and live dispatch and asserts the `sanitizedCommand` value is identical at the preview step in both cases.

**Warning signs:**
- Dry-run is implemented as a separate function rather than an `opts.dryRun` flag on the existing dispatcher.
- `sanitizeAction` is called twice for the same action (once for dry-run, once for actual dispatch).
- Dry-run tests do not assert the specific `sanitizedCommand` string — only that execution was skipped.

**Phase to address:** Agent Dry-Run Validation

---

### Pitfall 4: STDERR Recovery Loop — Agent Suggestions Execute Without Re-Entering the Safety Dispatch

**What goes wrong:**
The STDERR recovery bridge receives agent-generated fix suggestions (e.g., "try `git fetch --all` first"). These suggestions are new commands the agent is proposing. If the bridge takes the suggestion and passes it directly to the runner (bypassing `dispatchSelection` and `sanitizeAction`), the workspace boundary check, blocklist, and secret redaction are all skipped. An agent can suggest `rm -rf ./dist && git push --force`, which is allowed through unvetted.

**Why it happens:**
The recovery bridge is conceived as a "tight loop" — fail, get suggestion, retry. Developers implement the retry as a direct runner call to avoid re-displaying the already-seen preview. The safety dispatch is perceived as the user-facing confirmation layer, not a necessary security check.

**How to avoid:**
- All commands that originate from the recovery bridge must pass through `dispatchSelection` exactly as if they were a fresh user selection. There is no shortcut.
- Model the recovery suggestion as a new `selection` object with a `payload.command` equal to the suggested fix. Feed it back through the full dispatch pipeline.
- Add a test: recovery bridge receives a suggestion containing a path outside CWD; assert the dispatch returns `cancelled: true` with reason `'Path outside workspace'`.

**Warning signs:**
- Recovery bridge has its own `exec` call rather than calling `dispatchSelection`.
- Recovery bridge tests never assert that blocked commands are rejected when suggested by the agent.
- The phrase "retry the fixed command" appears in implementation code without a call to `sanitizeAction`.

**Phase to address:** STDERR Recovery Bridge

---

### Pitfall 5: Session Persistence Race Condition on Concurrent Invocations

**What goes wrong:**
Two GSD invocations run in the same workspace at the same time (e.g., a background CI step and an interactive terminal session). Both read the session file, append their action, and write back. The second write overwrites the first. One action entry is silently lost. With a rolling last-3-actions window, this means the session appears to have only one entry when two should exist.

**Why it happens:**
Node.js `fs.readFileSync` + mutate + `fs.writeFileSync` is not atomic. The pattern `read → modify → write` has a window between read and write where another process can overwrite. The Gemini CLI hit exactly this bug: fixed temporary filenames in atomic write logic cause ENOENT when two concurrent writes race.

**How to avoid:**
- Use `fs.writeFileSync` with an exclusive flag: write to a unique temp file named with `process.pid` + `Date.now()`, then `fs.renameSync` into the final path. This is an atomic operation on POSIX systems (same filesystem).
- Keep the session file format simple — a JSON array of the last N entries — so the write is a full replacement, not a partial append. A full replacement minimizes the window and makes temp-file atomicity effective.
- Accept the constraint: if concurrent writes race, the last writer wins. For a "last 3 actions" window, losing one entry is tolerable. Document this as a known limitation rather than implementing file locking (which requires `fs.open` with `O_EXLOCK` and is over-engineered for this use case).

**Warning signs:**
- Session file write uses `fs.appendFileSync` (append-only, not atomic).
- No process ID or timestamp in the temp file name if atomic write is used.
- Tests never run two concurrent writes against the same session file path.

**Phase to address:** Session Persistence

---

### Pitfall 6: Incremental Context Loading Passes the Full Raw Command Output to the Agent

**What goes wrong:**
Incremental context loading lets the agent inspect the output of the previous command before generating the next selection. The implementation reads `result.stdout` (potentially thousands of lines from `git log`, `ls -la /`, or `cat` of a large file) and attaches it verbatim to the agent's next prompt. The agent context window bloats, latency increases, and the agent's attention is buried in noise rather than focused on the relevant part.

**Why it happens:**
The "inspect output before next selection" feature sounds like "just pass stdout to the agent". Developers do not add truncation because they want the agent to have all available information. The connection between context size and agent response quality/cost is underestimated.

**How to avoid:**
- Cap the context payload at a fixed byte limit (recommended: 2,000 bytes / ~40 lines). Truncate from the end, not the start — the end of command output usually has the most diagnostic content (error messages, exit status indicators).
- Add a `truncated: true` flag to the context payload when output is cut; the agent can request more if needed.
- Never include stdout if the command succeeded and the agent only needs to know "it worked". Pass `{ success: true, exitCode: 0 }` for clean exits; reserve full output for error paths.
- Apply `redactSecrets` to all context payloads before passing to the agent. Command output may echo secrets (e.g., `env` dump, `cat .env`).

**Warning signs:**
- Context payload is constructed as `{ stdout: result.stdout }` with no length cap.
- The feature is tested only with short fixture strings, never with 1,000-line outputs.
- No redaction step on the context payload.

**Phase to address:** Incremental Context Loading

---

### Pitfall 7: Over-Engineering the Session Format — Treating It Like a Database

**What goes wrong:**
Session persistence is designed with a rich schema: action type, timestamps, normalized command, outcome status, agent ID, phase reference, error message, redacted secrets list, duration, metadata tags. The implementation requires a migration strategy when the schema changes and the reader must handle multiple schema versions. After two months the schema has v1, v1.1, and v2 readers. A corrupted session file crashes the CLI.

**Why it happens:**
"Session persistence" sounds like a data modelling problem. Developers apply database-thinking: normalize the schema, version it, plan for migration. The actual requirement is "last 3 actions as local workspace memory" — a rolling window of diagnostic context, not a historical audit log.

**How to avoid:**
- Use the simplest possible format: a JSON array of at most 3 entries, each with only the fields the next-action agent actually reads (`command`, `exitCode`, `stderrSnippet`, `timestamp`).
- Treat the session file as throwaway — if parsing fails, delete and recreate. Never crash. `try { parse } catch { reset to [] }`.
- No versioning, no migration. If the schema must change, a new field is added with a safe default. Old readers that don't know about the field ignore it (JSON is forward-compatible in this direction).
- Cap total file size. If all 3 entries serialize to > 8KB, truncate the oldest entry's content fields.

**Warning signs:**
- Session schema has more than 8 fields per entry.
- Code checks for `entry.schemaVersion` before reading.
- A session schema change requires updating more than one file.

**Phase to address:** Session Persistence

---

### Pitfall 8: Dry-Run Validation Confirms the Preview Command, Not the Execution Command

**What goes wrong:**
The dry-run shows the `sanitizedCommand` (with `[REDACTED]` in place of secrets and `--force` stripped). The user approves. Execution proceeds with `action.command` (original, with `--force` present). The user confirmed a command that does not reflect what will actually execute. Specifically: `git push origin main --force` is displayed as `git push origin main` in dry-run; user approves thinking force-push was not requested; force-push executes.

**Why it happens:**
The preview intentionally shows a cleaned version for safety (hide secrets, strip GSD-internal flags). The problem is conflating "GSD's own `--force` flag" (stripped by sanitizer to avoid conflict with the command's own `--force`) with "the user's `--force` argument on the underlying command". The stripping logic in `sanitizeAction` removes `--force` globally from the sanitized command, which may remove legitimate `--force` flags that the user did intend.

**How to avoid:**
- The sanitizer should only strip the GSD-internal `--force` flag when it is explicitly part of the GSD invocation protocol, not from arbitrary positions in the command string. Review the regex `\s+--force\b` used in sanitize.js — it matches any `--force` anywhere in the command.
- Dry-run approval must show the user what will actually execute, including any `--force` flags. The display should be: "This command will run: `[command with all flags except GSD-internal --force]`".
- Add a test: payload command contains `git push --force`; dry-run preview must show `--force`; execution must include `--force`.

**Warning signs:**
- The `--force` stripping regex in `sanitize.js` is applied to `redacted.redacted` which is the full command, not just the GSD-flag position.
- Tests for force-push commands only check that `status: 'allow'` and never assert the sanitized command string retains `--force`.
- Dry-run test assertions only check `{ ran: false, dryRun: true }` without inspecting the previewed command.

**Phase to address:** Agent Dry-Run Validation

---

### Pitfall 9: STDERR Recovery Bridge Invoked for Non-Recoverable Failures

**What goes wrong:**
The recovery bridge is triggered whenever `result.code !== 0`. This includes permission errors (`EACCES`), out-of-disk (`ENOSPC`), process-killed signals (`code: null, signal: 'SIGKILL'`), and network timeouts. The agent is asked to suggest a fix for "command exited with code null". The suggestion is meaningless, the round-trip adds latency, and the user sees a confusing AI response for a problem that requires human intervention (e.g., free disk space).

**Why it happens:**
"Invoke recovery on failure" is the obvious first implementation. Classifying failure types requires more thought. Developers treat all non-zero exits as "agent can fix this" without considering whether the failure is actionable by a command substitution.

**How to avoid:**
- Only invoke the recovery bridge for failures where a different command might succeed. Heuristic: stderr contains text (the shell produced a diagnostic message) and exit code is between 1-127 (conventional command failure). Signal kills, null exit codes, and known system-level errors (`EACCES`, `ENOSPC`, `ENOENT` with a path outside workspace) should return a static error message to the user without recovery.
- Add a `isRecoverable(result)` classifier function. Keep it simple: `result.code > 0 && result.code <= 127 && result.stderr.length > 0`.
- Test with: a `SIGKILL` result (code null), a successful-but-empty command (code 0 with stderr), a permission error (code 126), and a standard command failure (code 1 with stderr message). Assert bridge is only invoked in the last case.

**Warning signs:**
- Recovery bridge is triggered whenever `result.code !== 0` with no further classification.
- No test with `result.code === null` (signal kill).
- Agent suggestions for disk-full or permission-denied errors are nonsensical in manual testing.

**Phase to address:** STDERR Recovery Bridge

---

### Pitfall 10: Incremental Context Loading Stores Output From Commands Outside the Workspace

**What goes wrong:**
The dispatcher allows some commands to run against paths outside CWD (e.g., global git config queries, `node --version`). When incremental context loading captures the output of these commands and stores it in the session context, it may inadvertently include directory listings, file contents, or error messages that reference paths outside the CWD workspace boundary. A subsequent agent turn uses this out-of-scope context to suggest commands that reference those external paths.

**Why it happens:**
Context loading captures `result.stdout` generically for all commands that ran successfully. The workspace boundary check (`sanitizeAction`) guards the *input* (which paths the command may access) but not the *output* (what the command reveals about the environment outside the workspace).

**How to avoid:**
- For incremental context storage, only capture output from commands that were dispatched with `status: 'allow'` and did not reference external paths (i.e., `outOfBounds` was empty).
- If a command produces output referencing absolute paths, strip them from the context payload before storage. Apply the same `isSafeValue`/redaction pass that the sanitizer uses.
- In practice: if a command runs outside workspace scope (allowed by a gray-list exemption or `--force`), mark its output context as `externalOutput: true` and exclude it from the next agent context payload.

**Warning signs:**
- Context payload includes stdout from `git remote -v` (reveals external URLs), `cat ~/.npmrc` (reveals auth tokens), or any command touching paths outside CWD.
- No test asserts that external-path outputs are excluded from the persisted context.

**Phase to address:** Incremental Context Loading

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store raw `action.command` in session file instead of `sanitized.sanitizedCommand` | One less object to thread through | Secrets written to disk on every session write | Never |
| Single recovery bridge invocation for all non-zero exits | Simple implementation | Agent invoked for unrecoverable failures; adds latency and confusion | Never — add `isRecoverable` classifier from day one |
| Copy-paste dry-run as separate function rather than `opts.dryRun` flag | Faster to write | Preview and execution diverge as code evolves independently | Never — extend existing dispatcher |
| Store full stdout in context payload without truncation | Agent has all info | Context bloat, higher latency, buried signal | Only during development with short fixture outputs; never in production code paths |
| Session file schema with versioning from day one | Forward-compatible | Requires migration logic that will never be used; JSON format changes are trivial to handle ad hoc | Never for "last 3 actions" use case |
| Implement context loading as a new module unaware of `redactSecrets` | Faster to build | Secret exposure in context payloads | Never — import and apply existing sanitizer |

---

## Integration Gotchas

Specific mistakes when wiring v1.2 features into the existing dispatcher and selector.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `dispatchSelection` return value → session persistence | Storing `result.result.stdout` directly in session | Only store `result.result.stderr` (truncated, redacted) and exit code; not stdout |
| Recovery bridge → command retry | Calling `runner(suggestedAction)` directly | Call `dispatchSelection(newSelection, opts)` so full sanitization runs |
| Dry-run → existing `dryRun: true` flag | Building a new parallel dry-run function | Pass `opts.dryRun = true` to existing `dispatchSelection`; it already handles this at line 84 |
| Context payload → agent prompt | Attaching `result.stdout` verbatim | Run through `redactSecrets`, cap at 2,000 bytes, include `truncated` flag |
| Session file write → concurrent access | `readFileSync` + modify + `writeFileSync` | Write to pid-timestamped temp file, then `renameSync` for atomic replacement |
| `sanitizeAction` result → multiple consumers | Running `sanitizeAction` twice (dry-run + live) on same action | Run once, store result, pass `sanitized` object to both preview and execution consumers |
| Gray-list `--force` stripping → user's own `--force` | Regex strips all `--force` from sanitizedCommand | Only strip GSD's dispatch-level `--force` flag, not subcommand flags |
| Error path output → recovery bridge | Passing `err.message + stderr` without redaction | Both `err.message` and `stderr` must pass through `redactSecrets` before use |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running `redactSecrets` on large stdout payloads in context loading | Noticeable delay before next menu render | Cap stdout at 2,000 bytes *before* running `redactSecrets`; regex over 20 lines is negligible | If stdout is uncapped: any command that produces large output (e.g., `git log`) |
| Reading session file synchronously on every dispatch to check last 3 actions | Perceptible latency on every invocation | Read session file once at startup and cache in memory; only write on state change | On slow disks or network-mounted home directories |
| Session file path resolved with `realpathSync` on every write | Additional I/O per dispatch | Resolve session path once at module init and cache; CWD does not change mid-session | Always avoidable; low individual cost but adds up with frequent writes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Agent-generated recovery commands bypass `sanitizeAction` | Shell injection, workspace escape, blocked command execution | All recovery suggestions must pass through `dispatchSelection` with full sanitation |
| Session file written to a path derived from user input | Path traversal: session written outside workspace | Session path must be `path.join(cwd, '.codex-session.json')` where `cwd` is the validated CWD, never from payload |
| Context payload passed to agent before secret redaction | Secret exposure to agent/logs | Always call `redactSecrets` on any string before inclusion in context payload |
| Session file readable by other users on shared systems | Credential exposure from stored session entries | Enforce `0o600` permissions (`fs.writeFileSync(path, data, { mode: 0o600 })`) on session file write |
| Dry-run approval used as authorization to skip confirmation on actual execute | User approves sanitized preview; mutating confirmation is skipped on live execute | Dry-run and live execute are independent flows; `dryRun: true` never sets a "pre-approved" flag that carries over |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| STDERR recovery bridge presents agent suggestion without indicating it is AI-generated | User mistakes AI suggestion for a definitive fix; executes it blindly | Label suggestion clearly: `[Agent suggestion]` before the proposed command; always require confirmation |
| Dry-run shows `[REDACTED]` where a flag was and user cannot tell what the command will do | Trust breakdown; user cannot audit the preview | Show `[REDACTED]` only for secret *values*, never for structural flags; retain all non-secret arguments in the preview |
| Session context from 3 sessions ago is surfaced to agent as "recent" | Agent makes decisions based on stale state | Timestamp each session entry; surface only entries from the current calendar day unless the user explicitly asks for history |
| Recovery bridge fires on every error including ones the user already understands | Noise; user has to dismiss AI output they did not want | Recovery bridge should be opt-in or skipped when user manually cancelled (reason: `'user cancelled'`) |
| Incremental context shows previous command's stdout in the next menu header | Menu becomes unreadable with large output | Never render context payload in the menu UI; it is for the agent only, not the display layer |

---

## "Looks Done But Isn't" Checklist

- [ ] **STDERR Recovery — Secret Redaction:** Recovery bridge passes stderr and err.message through `redactSecrets` before forwarding. Test with a fixture command that contains a provider key pattern and fails; assert `[REDACTED]` appears in bridge output.
- [ ] **STDERR Recovery — Safety Re-Entry:** Agent-suggested retry commands call `dispatchSelection`, not the runner directly. Test with a suggestion containing a blocked command; assert `cancelled: true`.
- [ ] **STDERR Recovery — Recoverability Classifier:** Bridge has `isRecoverable(result)` guard. Test with `code: null` (signal kill), `code: 126` (permission denied), `code: 1` with stderr message. Only the last triggers recovery.
- [ ] **Session Persistence — No Secrets on Disk:** Session file is written from `sanitized.sanitizedCommand`, not `action.command`. Write a session entry with a token in the command; read the file; assert the raw token is absent.
- [ ] **Session Persistence — Atomic Write:** Write uses pid+timestamp temp file + `renameSync`. Simulate two concurrent writes; assert both entries appear or last-writer-wins without corruption.
- [ ] **Session Persistence — File Permissions:** Session file is written with mode `0o600`. Assert `fs.statSync(sessionPath).mode & 0o777 === 0o600`.
- [ ] **Session Persistence — Corrupt File Resilience:** Delete last two bytes of session file; assert next startup resets to `[]` without throwing.
- [ ] **Dry-Run — Path Identity:** Same payload run through `opts.dryRun: true` and live dispatch produces identical `sanitizedCommand` at the preview step.
- [ ] **Dry-Run — Force Flag Fidelity:** Payload with `git push --force` in the command; dry-run preview must display `--force`; execution must include `--force`. GSD's internal `--force` dispatch flag must not strip it.
- [ ] **Incremental Context — Truncation:** Command that produces 1,000 lines of stdout; context payload capped at 2,000 bytes; `truncated: true` included in payload.
- [ ] **Incremental Context — Redaction:** Command that produces output containing a provider key pattern; context payload contains `[REDACTED]`, not raw key.
- [ ] **Incremental Context — Clean Exit Shortcut:** Command with exit code 0 and no stderr; context payload is `{ success: true, exitCode: 0 }` without full stdout.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Session file contains an exposed secret | HIGH | Rotate the credential immediately; delete `.codex-session.json`; patch session write to use `sanitizedCommand`; audit any logs that read the session file |
| Recovery bridge executed an unsafe agent-suggested command | MEDIUM | Restore from git if mutating; add full `dispatchSelection` call to bridge; add test asserting blocked commands are rejected from suggestions |
| Dry-run divergence caused a force-push the user did not intend | HIGH | Revert with `git revert` or restore from backup; patch the `--force` stripping regex to scope it correctly; add `git push --force` dry-run fidelity test |
| Session file corruption crashes the CLI on startup | LOW | Delete session file; wrap parse with try/catch reset; no functional regression |
| Context payload bloat caused high latency / degraded agent response | LOW | Add 2,000-byte cap; re-test; no data loss |
| Agent invoked for unrecoverable failure (SIGKILL, disk full) | LOW | Add `isRecoverable` classifier; no code path damage |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| STDERR unredacted before forwarding to agent | STDERR Recovery Bridge | Test: failed command with token; assert `[REDACTED]` in bridge output |
| Recovery suggestion bypasses safety dispatch | STDERR Recovery Bridge | Test: blocked command suggested; assert `cancelled: true` |
| Recovery triggered for unrecoverable failures | STDERR Recovery Bridge | Test: SIGKILL result; assert bridge not invoked |
| Session stores unredacted command | Session Persistence | Test: write action with token; read file; assert token absent |
| Session file race condition on concurrent write | Session Persistence | Test: two concurrent writes; assert valid JSON result |
| Session file permissions expose stored entries | Session Persistence | Test: assert file mode `0o600` after write |
| Session schema over-engineering creates migration burden | Session Persistence | Design gate: schema must be <= 4 fields per entry; no version field |
| Dry-run diverges from live execution path | Agent Dry-Run Validation | Test: same payload through dry-run and live; assert identical `sanitizedCommand` at preview |
| `--force` stripping removes user's own `--force` flag | Agent Dry-Run Validation | Test: `git push --force`; assert preview and execution retain `--force` |
| Context payload contains full stdout without cap | Incremental Context Loading | Test: 1,000-line output; assert payload <= 2,000 bytes with `truncated: true` |
| Context payload leaks secrets from command output | Incremental Context Loading | Test: `env` output with token; assert payload contains `[REDACTED]` |
| Context loading adds latency via large regex over uncapped output | Incremental Context Loading | Enforce cap-before-redact order in implementation; test with large fixture |

---

## Sources

- Node.js `child_process.exec` documentation — `stderr` as callback argument, signal handling, null exit codes: https://nodejs.org/api/child_process.html
- Gemini CLI issue #18504 — race condition in atomic write logic with fixed temp filenames: https://github.com/google-gemini/gemini-cli/issues/18504
- Claude Code issue #24125 — race condition in session storage path initialization: https://github.com/anthropics/claude-code/issues/24125
- Nick Janetakis — CLI tools that support previews and dry-runs (validation vs. simulation divergence patterns): https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions
- Manus context engineering lessons — context size vs. agent quality tradeoff, rolling window patterns: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- Salesforce CLI discussion — validate vs. dry-run: what differs and when they diverge: https://github.com/forcedotcom/cli/discussions/2484
- Existing codebase analysis: `dispatcher/index.js`, `dispatcher/sanitize.js`, `dispatcher/preview.js`, `dispatcher/commands.js`, `selector/headless.js`, `bin/lib/state.cjs`

---
*Pitfalls research for: v1.2 agent-to-local feedback loop — STDERR recovery, incremental context loading, session persistence, agent dry-run validation*
*Researched: 2026-02-24*
