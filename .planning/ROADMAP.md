# Roadmap — Codex Base Optimization

## Milestones

- ✅ **v1.0 Numbered CLI Selection UX** — Phases 7-9 (shipped 2026-02-24)
- ✅ **v1.1 Standardize Selection & Security** — Phases 10-12 (shipped 2026-02-24)
- 🚧 **v1.2 Agent-to-Local Feedback Loop** — Phases 13-16 (in progress)

## Phases

<details>
<summary>✅ v1.0 Numbered CLI Selection UX (Phases 7-9) — SHIPPED 2026-02-24</summary>

For full phase details, see: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

- [x] Phase 7: Schema & Selector — completed 2026-02-24
- [x] Phase 8: Safe Dispatch — completed 2026-02-24
- [x] Phase 9: UX Polish & Headless — completed 2026-02-24

</details>

<details>
<summary>✅ v1.1 Standardize Selection & Security (Phases 10-12) — SHIPPED 2026-02-24</summary>

For full phase details, see: [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

- [x] Phase 10: Shared Command Policy Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 11: Secure Dispatcher (2/2 plans) — completed 2026-02-24
- [x] Phase 12: Selection Normalization (2/2 plans) — completed 2026-02-24

</details>

### 🚧 v1.2 Agent-to-Local Feedback Loop (In Progress)

**Milestone Goal:** Close the loop between AI agents and local tools — Selection + Dispatch becomes a live conversation with error recovery, context awareness, session memory, and dry-run validation.

- [x] **Phase 13: Foundation** - Build session store and STDERR bridge as standalone, independently-tested leaf modules (completed 2026-02-24)
- [x] **Phase 14: Dispatcher Integration** - Wire recovery bridge and session store into dispatchSelection; structured return shape
- [ ] **Phase 15: Dry-Run Validation** - Structured DryRunResult, --force scoping fix, and fidelity test coverage
- [ ] **Phase 16: Context Envelope** - Context return fields with 2KB cap and redaction on every dispatchSelection call

## Phase Details

### Phase 13: Foundation
**Goal**: Two new leaf modules exist and are fully tested in isolation before any dispatcher changes
**Depends on**: Phase 12 (v1.1 baseline stable)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, ERR-01
**Success Criteria** (what must be TRUE):
  1. `session/store.js` appends a record to `.planning/session.json` and evicts oldest entry when ring buffer exceeds 3 items
  2. Session file on disk never contains a raw secret — every stored command passes through `redactSecrets` before write
  3. Session write uses atomic temp file + `renameSync` and sets permissions to `0o600`
  4. `dispatcher/stderr-bridge.js` returns a `RecoveryPayload` with a redacted stderr hint when exit code is non-zero
  5. Both modules are tested in complete isolation with zero imports from `dispatcher/index.js`
**Plans:** 2/2 plans complete
Plans:
- [ ] 13-01-PLAN.md — TDD session store (ring buffer, atomic write, redaction)
- [ ] 13-02-PLAN.md — TDD stderr bridge (RecoveryPayload, stderr truncation, redaction)

### Phase 14: Dispatcher Integration
**Goal**: Users see STDERR output and a Retry / Edit / Abort prompt on every failed dispatch; every dispatch appends to session memory
**Depends on**: Phase 13
**Requirements**: ERR-02, ERR-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Running a command that exits non-zero prints the stderr content and exit code before offering recovery options
  2. Choosing "Retry" or "Edit" re-enters `dispatchSelection` with full sanitization — no shortcut runner path
  3. After 2 failed recovery attempts for the same root cause, dispatch hard-stops with an abort message
  4. Every dispatch (success or failure) appends a sanitized record to session store; a session write error never crashes the dispatch
**Plans**: 2/2 completed

Plans:
- [x] 14-01-PLAN.md — Recovery prompt helpers and root-cause detection
- [x] 14-02-PLAN.md — Dispatcher recovery loop with session logging and strike limit

### Phase 15: Dry-Run Validation
**Goal**: `dispatchSelection` with `dryRun: true` returns a structured `DryRunResult` that accurately reflects the actual execution path
**Depends on**: Phase 14
**Requirements**: DRY-01, DRY-02, DRY-03
**Success Criteria** (what must be TRUE):
  1. Dry-run result contains `sanitizedCommand`, `redactions`, and `estimatedMutating` fields — callers can assert on them in tests
  2. `git push --force` passed through dispatcher dry-run retains its `--force` flag — GSD's own dispatch flag is stripped only at dispatch-level position
  3. A fidelity test confirms the command visible in dry-run preview matches what would execute on a live run
**Plans**: TBD

### Phase 16: Context Envelope
**Goal**: Every `dispatchSelection` return value includes a context object that agents can feed into the next prompt without extra work
**Depends on**: Phase 14
**Requirements**: CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE):
  1. `dispatchSelection` return value includes `context: { stdout, stderr, exitCode, command }` alongside `ran` and `result`
  2. Each context field is capped at 2,000 bytes — a command producing 1,000 lines of output does not bloat the return value
  3. All context fields pass through `redactSecrets` — a secret present in stdout is `[REDACTED]` in the returned context object
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Schema & Selector | v1.0 | 2/2 | Complete | 2026-02-24 |
| 8. Safe Dispatch | v1.0 | 2/2 | Complete | 2026-02-24 |
| 9. UX Polish & Headless | v1.0 | 2/2 | Complete | 2026-02-24 |
| 10. Shared Command Policy Foundation | v1.1 | 2/2 | Complete | 2026-02-24 |
| 11. Secure Dispatcher | v1.1 | 2/2 | Complete | 2026-02-24 |
| 12. Selection Normalization | v1.1 | 2/2 | Complete | 2026-02-24 |
| 13. Foundation | 2/2 | Complete    | 2026-02-24 | - |
| 14. Dispatcher Integration | v1.2 | Complete    | 2026-02-24 | 2026-02-24 |
| 15. Dry-Run Validation | v1.2 | 0/? | Not started | - |
| 16. Context Envelope | v1.2 | 0/? | Not started | - |

---
*For archived requirements, see: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) and [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)*
