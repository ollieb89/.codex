# Feature Research

**Domain:** Agent-to-local feedback loop — STDERR recovery, incremental context loading, session persistence, dry-run validation
**Researched:** 2026-02-24
**Confidence:** HIGH

---

## Scope Note

This file covers **only the v1.2 additions**. The v1.0 baseline (numbered list rendering,
InputSelector, headless preselection, safe dispatch, secret redaction) and v1.1 additions
(shared constants, auto-reindexing normalizer, provider-specific secret patterns) are already
shipped and not reassessed here. Each feature below is assessed against what the existing
dispatcher and selector modules already provide.

**Existing integration points used by all four features:**

- `dispatchSelection()` in `dispatcher/index.js` — runner, dryRun, output/input injection
- `defaultRunner()` — wraps `child_process.exec`, already captures `{code, stdout, stderr}`
- `sanitizeAction()` in `dispatcher/sanitize.js` — CWD boundary enforcement, secret redaction
- `renderPreview()` in `dispatcher/preview.js` — outputs sanitized command before execution
- `normalizeOptions()` + `run()` in `selector/index.js` — raw AI text → numbered entries

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of any mature CLI agent toolkit assume exist. Missing these makes the
agent loop feel fragile: errors disappear silently, context is never fed back, and there is
no safety valve before destructive commands run.

| Feature | Why Expected | Complexity | Existing Gap | Notes |
|---------|--------------|------------|--------------|-------|
| STDERR surfacing after dispatch | Every CLI tool that runs subprocesses surfaces errors — curl, git, npm all print failure output. Swallowing STDERR from an agent-dispatched command and returning `{ran: true}` is surprising behavior. | LOW | `defaultRunner()` captures `stderr` in result but `dispatchSelection()` does not surface or act on non-empty STDERR after a successful exit (code 0). | Print STDERR to `output` when non-empty after execution. This alone closes the most visible gap. |
| Exit-code differentiated error reporting | Users expect `code !== 0` to be visually distinct from `code === 0`. git, make, and npm all print `Process exited with code N` for non-zero exits. | LOW | `dispatchSelection()` returns `{ran:true, result:{code,stdout,stderr}}` but does not render any failure indicator to the terminal. | Emit a formatted failure line (including exit code) when `result.code !== 0`. Reuse `output` stream consistent with existing `renderPreview()`. |
| "What would run" preview before execution | The `--dry-run` convention is universal: kubectl, git, rsync, ansible, Terraform all support it. An agent toolkit without it cannot be used safely in onboarding or review workflows. | LOW | `dryRun` flag already exists in `dispatchSelection()`. It prints `Skip execute: <cmd>` and returns `{dryRun:true}`. The flag exists but the output is minimal and there is no structured result for programmatic callers. | Extend the dry-run return value to include the sanitized command, estimated impact, and redaction metadata so callers can render a richer preview or pipe to test assertions. |
| Session action log (last N actions) | CI/agent tools like the OpenClaw agent, Claude Code, and Continue all maintain session state. Developers expect to answer "what did this agent just do?" without reading raw logs. | MEDIUM | No session state exists. Each `dispatchSelection()` call is stateless. | Append-only JSONL file in `.codex-session/` (or configurable path). Each entry: timestamp, command (sanitized), exit code, stderr snippet (truncated). Cap at N=3 entries retained in memory; flush to disk. |
| Context injection into next agent prompt | Any agentic loop (Pydantic-AI coding agent, GitHub Copilot agent) feeds command output back into the model before the next generation step. Without this, the agent is blind to what just happened. | MEDIUM | The selector and dispatcher are decoupled. There is no mechanism to attach `stdout`/`stderr` from the previous dispatch to the next `run()` call. | Define a context object `{stdout, stderr, exitCode, command}` returned from `dispatchSelection()` that callers can pass as `context` to the next `normalizeOptions()` / agent prompt. The selector itself need not change — this is a calling-convention contract. |

### Differentiators (Competitive Advantage)

Features that go beyond baseline expectations and make the feedback loop qualitatively better
than a raw `exec` wrapper with a menu in front of it.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| STDERR recovery bridge with fix-suggestion prompt | After a non-zero exit, present the STDERR output and ask the user (or agent) whether to retry, edit the command, or abort. This is the pattern used by Warp AI and the Spotify background coding agent. Closing the loop from failure → actionable suggestion is the v1.2 headline feature. | MEDIUM | Requires: (1) detecting non-zero exit, (2) formatting STDERR with context, (3) prompting "Retry / Edit / Abort". The `editCommand()` function already exists in `dispatcher/edit.js` and handles interactive command editing. Re-use it for the "Edit" path of the recovery bridge. No new editing infrastructure needed. |
| Incremental context loading: stdout/stderr fed to next selection | Enables genuine multi-turn agent loops: run command → feed output → generate next set of options → select → run. This is what GitHub Copilot CLI's "Task" agent does. Without it, the agent is a one-shot selector, not a loop. | MEDIUM | The context object (see table stakes) enables this. The differentiating step is defining a standard envelope so any prompt template can read `{{context.stdout}}` and `{{context.stderr}}` in the next invocation. Keep the envelope small: cap stdout/stderr at ~2KB to stay within typical prompt context budgets. |
| Session persistence with redacted command history | Persisting the last 3 actions (sanitized, no secrets) gives the agent memory of what it did this session without requiring an external store. Deep Agents CLI and OpenClaw both use JSONL for this reason: append-only, crash-safe, human-readable, greppable. | MEDIUM | JSONL is the correct format. File location: `.codex-session/history.jsonl` relative to CWD (inside workspace boundary). Each record: `{ts, command, exitCode, stderrSnippet, agentId}`. Max file size: 50KB before rotation (prevents unbounded growth in long sessions). Secret redaction is mandatory before write — reuse `redactSecrets()` from `sanitize.js`. |
| Structured dry-run result for test assertions | Current dry-run returns `{ran:false, dryRun:true}`. Returning `{ran:false, dryRun:true, sanitizedCommand, redactions, estimatedMutating}` lets integration tests assert on what would have run without executing it. This is the same structured result pattern that Ansible's check mode and Terraform's plan step provide. | LOW | Purely additive: enrich the existing dry-run return path in `dispatchSelection()`. Zero behaviour change for existing callers that ignore the extra fields. |
| Agent dry-run validation: dispatcher simulation without runner | Allow callers to call `dispatchSelection()` with `dryRun:true` and a mock `runner` to fully simulate the dispatch pipeline (sanitize → preview → mutating-gate → result) without touching the filesystem. This makes the dispatcher testable end-to-end in CI without side effects. | LOW | The `runner` injection point already exists in `dispatchSelection(opts.runner)`. Document the pattern explicitly; no code changes may be needed beyond the enriched dry-run result above. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-retry on STDERR without human confirmation | "The agent should fix itself" | Silent retries can amplify damage — a command that fails with a permission error might succeed after `sudo`, which is a privilege escalation the user never approved. | Present the STDERR and prompt the user (Retry / Edit / Abort). Never retry automatically. |
| Full stdout captured to session file | "I want the complete output history" | Stdout from builds or test runs can be megabytes. Writing all of it to a session file causes unbounded disk growth and leaks build artifacts (which may contain secrets). | Cap STDERR snippet at 500 chars. Store exit code and command. If full output is needed, redirect the command with `>> logfile` explicitly. |
| Streaming stdout back to the agent in real-time | "The agent should see output as it arrives" | `child_process.exec` buffers stdout; switching to `spawn` with streaming changes the entire runner contract and breaks the existing 88 dispatcher tests. | Use `exec` (existing), capture stdout after completion, pass to context object. For long-running processes, caller can use `spawn` with a custom `runner` injection. |
| Persistent session across CWD changes | "Remember what I did in other projects" | Cross-project memory conflates unrelated command histories and makes session replay ambiguous (a command like `npm run build` means different things in different repos). | Session file is always relative to CWD. Each project gets its own `.codex-session/history.jsonl`. |
| Entropy-based STDERR anomaly detection | "Flag unusual patterns in stderr automatically" | High false-positive rate. Base64 content, stack traces, and test output all look "high entropy". This would flag legitimate build errors as secrets. | Pattern-based `redactSecrets()` before writing to session file. No entropy analysis. |
| Storing original (unredacted) commands in session | "I need to replay commands exactly" | The session file is persisted to disk inside the workspace. If it contains raw credentials, any tool that reads the workspace (linters, git, CI) may expose them. | Store only the sanitized command. The caller is responsible for re-supplying secrets at replay time. |

---

## Feature Dependencies

```
STDERR Recovery Bridge
    └──requires──> defaultRunner() captures {code, stdout, stderr}  [already true]
    └──requires──> dispatchSelection() checks result.code after runner()  [new]
    └──reuses──> editCommand() from dispatcher/edit.js for Edit path  [already exists]
    └──enhances──> Session Persistence (failed commands logged with stderr snippet)

Incremental Context Loading
    └──requires──> dispatchSelection() returns context object  [new return fields]
    └──feeds──> normalizeOptions() / run() on next invocation  [caller responsibility]
    └──enhances──> STDERR Recovery Bridge (stderr is part of context envelope)

Session Persistence
    └──requires──> redactSecrets() from dispatcher/sanitize.js  [already exists]
    └──requires──> dispatchSelection() result includes command + exit code  [already true]
    └──requires──> File write inside CWD boundary  [must use isInsideWorkspace() check]
    └──enhanced by──> STDERR Recovery Bridge (failed dispatch events recorded)

Agent Dry-Run Validation
    └──requires──> dispatchSelection() dryRun path  [already exists]
    └──requires──> sanitizeAction() result available at dry-run return point  [already true]
    └──enhances──> Session Persistence (dry-run runs are NOT written to session log)
    └──uses──> runner injection point  [already exists]
```

### Dependency Notes

- **STDERR Recovery Bridge reuses `editCommand()`:** The existing `edit.js` module handles
  interactive command editing with the same `ask`/`input`/`output` injection pattern as the
  rest of the dispatcher. No new editing infrastructure is needed for the recovery bridge.

- **Incremental context loading is a return-value contract, not a new module:** The selector
  and dispatcher do not need to know about each other. The context envelope (`{stdout, stderr,
  exitCode, command}`) is returned by `dispatchSelection()` and passed by the caller into the
  next `run()` call or prompt template. This keeps the modules decoupled.

- **Session persistence must enforce CWD boundary:** The file `.codex-session/history.jsonl`
  must be resolved with `path.resolve(cwd, '.codex-session/history.jsonl')` and validated
  with `isInsideWorkspace()` before writing. This is non-negotiable given the project's
  workspace-boundary security model.

- **Dry-run enrichment is purely additive:** Existing callers that destructure only
  `{ran, dryRun}` are unaffected by adding `sanitizedCommand`, `redactions`, and
  `estimatedMutating` to the dry-run return object.

- **Build order within v1.2:** Session Persistence depends on `redactSecrets()` (available
  now) and `dispatchSelection()` result shape (stable). STDERR Recovery Bridge depends on
  the dispatcher result. Dry-Run Validation depends on the same result enrichment. Recommended
  build order: (1) enrich dispatchSelection() return, (2) STDERR recovery bridge, (3) session
  persistence, (4) incremental context loading contract, (5) dry-run validation documentation.

---

## MVP Definition for v1.2

### Launch With (this milestone)

- [ ] **STDERR surface on non-zero exit** — print stderr content + exit code to `output` stream
      after dispatch; no silently-swallowed failures
- [ ] **STDERR recovery bridge** — on non-zero exit: prompt Retry / Edit (reuse `editCommand()`)
      / Abort; resolved selection feeds back into dispatcher
- [ ] **Enriched dry-run result** — add `sanitizedCommand`, `redactions`, `estimatedMutating`
      to the `{ran:false, dryRun:true}` return object
- [ ] **Session persistence (last 3)** — append-only JSONL at `.codex-session/history.jsonl`;
      write sanitized command, exit code, stderr snippet, timestamp, agentId; cap at 3 in-memory,
      rotate file at 50KB
- [ ] **Context envelope return** — `dispatchSelection()` returns `context:{stdout,stderr,
      exitCode,command}` (capped at 2KB each) alongside existing result fields

### Defer to v1.3+

- [ ] **Automatic context injection into prompt templates** — standardize
      `{{context.stdout}}` / `{{context.stderr}}` variables in Markdown prompt files;
      wait until at least one real consumer prompt needs it
- [ ] **Session replay** — read `.codex-session/history.jsonl` and re-present last N actions
      as numbered options; depends on real user demand
- [ ] **Multi-turn agent loop orchestrator** — a higher-level `runLoop()` that wires
      select → dispatch → context → select automatically; defer until the context
      envelope pattern stabilises across a few real callers

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| STDERR surface (non-zero exit) | HIGH — eliminates silent failures | LOW — 5-line change in dispatchSelection() | P1 |
| STDERR recovery bridge | HIGH — closes the agent feedback loop | MEDIUM — new recovery prompt + Retry/Edit/Abort flow | P1 |
| Enriched dry-run result | HIGH — enables test assertions on dispatch pipeline | LOW — additive fields on existing return object | P1 |
| Session persistence (JSONL) | MEDIUM — workspace memory for multi-turn loops | MEDIUM — file I/O, redaction, rotation logic | P1 |
| Context envelope return | MEDIUM — enables incremental context loading | LOW — additive fields on dispatchSelection() return | P2 |
| Automatic prompt template injection | LOW — nice to have, no current consumer | MEDIUM | P3 |
| Session replay as numbered menu | LOW — convenience feature | MEDIUM | P3 |

**Priority key:** P1 = ship in v1.2, P2 = ship in v1.2 if straightforward, P3 = defer

---

## Comparable Tool Patterns

| Behavior | Warp AI terminal | GitHub Copilot agent (CLI) | Spotify coding agent | Codex v1.2 target |
|----------|-----------------|---------------------------|----------------------|-------------------|
| STDERR on failure | Surfaces inline with suggestion | Shows in terminal output | Logged to session | Print to `output` stream with exit code |
| Error recovery prompt | AI suggests fix automatically | Manual re-prompt | Human-in-the-loop retry | Retry / Edit (editCommand) / Abort |
| Session memory | Per-session AI context | Conversation thread | JSONL per session | `.codex-session/history.jsonl`, last 3 |
| Context fed to next step | Automatic (agent manages) | Tool call result → model context | Full loop | Context envelope returned from dispatchSelection() |
| Dry-run / preview | Not applicable | `--dry-run` on some commands | Plan step | Enriched dryRun return with sanitizedCommand |
| Secret redaction before log | Not built-in | Not built-in | Not built-in | redactSecrets() before JSONL write |

---

## Sources

- [Coding Agent CI Feedback Loop — agentic-patterns.com](https://agentic-patterns.com/patterns/coding-agent-ci-feedback-loop/)
- [Background Coding Agents: Feedback Loops — Spotify Engineering, Dec 2025](https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3)
- [Warp embeds AI agents into CLI — DevOps.com](https://devops.com/warp-embeds-ai-agents-into-a-cli-to-provide-better-feedback-loop/)
- [Building your own CLI Coding Agent with Pydantic-AI — martinfowler.com](https://martinfowler.com/articles/build-own-coding-agent.html)
- [GitHub Copilot CLI: Enhanced agents, context management — GitHub Changelog, Jan 2026](https://github.blog/changelog/2026-01-14-github-copilot-cli-enhanced-agents-context-management-and-new-ways-to-install/)
- [In praise of --dry-run — Hacker News](https://news.ycombinator.com/item?id=27263136)
- [CLI Tools that support previews, dry runs — nickjanetakis.com](https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions)
- [Node.js child_process documentation — official](https://nodejs.org/api/child_process.html)
- [OpenClaw agent session JSONL pattern — custom agent framework article](https://nader.substack.com/p/how-to-build-a-custom-agent-framework)
- [Error Recovery and Fallback Strategies in AI Agent Development — gocodeo.com](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development)

---

*Feature research for: Codex CLI agent-to-local feedback loop — v1.2 milestone*
*Researched: 2026-02-24*
