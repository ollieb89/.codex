# Requirements: Codex Base Optimization

**Defined:** 2026-02-24
**Core Value:** Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## v1.2 Requirements

Requirements for Agent-to-Local Feedback Loop milestone. Each maps to roadmap phases.

### Error Recovery

- [ ] **ERR-01**: Dispatcher surfaces stderr content and exit code to output stream on non-zero exit
- [x] **ERR-02**: On non-zero exit, dispatcher prompts Retry / Edit (via editCommand) / Abort
- [ ] **ERR-03**: Recovery retries re-enter dispatchSelection with full sanitization (never bypass safety)
- [x] **ERR-04**: Hard stop after 2 failed recovery attempts for same root cause

### Session Memory

- [ ] **SESS-01**: Ring buffer stores last 3 dispatch actions in .planning/session.json
- [ ] **SESS-02**: Each record contains sanitized command, exit code, stderr snippet, and timestamp
- [ ] **SESS-03**: Writes use pid+timestamp temp file + renameSync (atomic, crash-safe)
- [ ] **SESS-04**: File permissions set to 0o600; all commands pass through redactSecrets before write

### Context Loading

- [ ] **CTX-01**: dispatchSelection returns context:{stdout,stderr,exitCode,command} alongside result
- [ ] **CTX-02**: Each context field capped at 2KB before redaction
- [ ] **CTX-03**: Context fields pass through redactSecrets before inclusion in return value

### Dry-Run Validation

- [ ] **DRY-01**: Dry-run returns DryRunResult with sanitizedCommand, redactions, estimatedMutating
- [ ] **DRY-02**: --force stripping regex scoped to GSD dispatch flag position only (not user git push --force)
- [ ] **DRY-03**: Fidelity test confirms dry-run preview matches actual execution path

## Future Requirements

Deferred to v1.3+. Tracked but not in current roadmap.

### Prompt Integration

- **PROMPT-01**: Automatic context injection into prompt templates ({{context.stdout}} / {{context.stderr}})
- **PROMPT-02**: Session replay as numbered selection menu

### Orchestration

- **ORCH-01**: Multi-turn agent loop orchestrator (runLoop()) wiring select -> dispatch -> context -> select

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-retry without human confirmation | Silent retries can amplify damage (privilege escalation risk) |
| Full stdout in session file | Unbounded disk growth; build output may contain secrets |
| Streaming stdout to agent | Breaks 88 existing runner tests; exec buffering is correct |
| Cross-CWD session sharing | Conflates unrelated command histories |
| Entropy-based secret detection | High false-positive rate on base64/hash content |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ERR-01 | Phase 13 | Pending |
| ERR-02 | Phase 14 | Complete |
| ERR-03 | Phase 14 | Pending |
| ERR-04 | Phase 14 | Complete |
| SESS-01 | Phase 13 | Pending |
| SESS-02 | Phase 13 | Pending |
| SESS-03 | Phase 13 | Pending |
| SESS-04 | Phase 13 | Pending |
| CTX-01 | Phase 16 | Pending |
| CTX-02 | Phase 16 | Pending |
| CTX-03 | Phase 16 | Pending |
| DRY-01 | Phase 15 | Pending |
| DRY-02 | Phase 15 | Pending |
| DRY-03 | Phase 15 | Pending |

**Coverage:**
- v1.2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — traceability populated for v1.2 roadmap*
