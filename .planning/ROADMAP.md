# Roadmap — Codex Base Optimization

## Milestones

- ✅ **v1.0 Numbered CLI Selection UX** — Phases 7-9 (shipped 2026-02-24)
- 🚧 **v1.1 Standardize Selection & Security** — Phases 10-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Numbered CLI Selection UX (Phases 7-9) — SHIPPED 2026-02-24</summary>

For full phase details, see: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

- [x] Phase 7: Schema & Selector — completed 2026-02-24
- [x] Phase 8: Safe Dispatch — completed 2026-02-24
- [x] Phase 9: UX Polish & Headless — completed 2026-02-24

</details>

### 🚧 v1.1 Standardize Selection & Security (In Progress)

**Milestone Goal:** Standardize the CLI selection experience and harden the dispatch layer with consolidated constants, expanded secret redaction, and auto-reindexing normalization.

- [x] **Phase 10: Shared Command Policy Foundation** - Extract dispatcher constants into a single source-of-truth module (completed 2026-02-24)
- [ ] **Phase 11: Secure Dispatcher** - Expand secret redaction and consolidate destructive-command detection
- [ ] **Phase 12: Selection Normalization** - Auto-reindex AI-generated numbered lists before render and headless resolution

## Phase Details

### Phase 10: Shared Command Policy Foundation
**Goal**: A single `dispatcher/commands.js` constants module exists and all three dispatcher files import from it, eliminating independent inline definitions
**Depends on**: Phase 9 (v1.0 complete)
**Requirements**: SEC-03
**Success Criteria** (what must be TRUE):
  1. `dispatcher/commands.js` exists and exports `BLOCKED_COMMANDS`, `GRAY_COMMANDS`, `DESTRUCTIVE_HIGHLIGHT_TERMS`, and `MUTATING_PATTERN`
  2. `dispatcher/sanitize.js`, `dispatcher/preview.js`, and `dispatcher/index.js` each import their constants from `commands.js` rather than defining them inline
  3. Adding a new destructive term to `commands.js` is reflected in confirmation gating without any further edits to other files
  4. All existing dispatcher tests pass without modification after the extraction
**Plans:** 2/2 plans complete
Plans:
- [ ] 10-01-PLAN.md — Create shared commands.js constants module and test suite
- [ ] 10-02-PLAN.md — Refactor sanitize.js, preview.js, index.js to import from commands.js

### Phase 11: Secure Dispatcher
**Goal**: Command previews redact the full set of real-world credential patterns with specific-to-generic ordering so no known secret leaks in terminal output or CI logs
**Depends on**: Phase 10
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. Previews redact OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Stripe `sk_live_*`, PEM blocks, and connection string credentials
  2. Secret patterns are applied in specific-to-generic order so provider-prefixed secrets are caught before the generic fallback fires
  3. Benign values (`TOKEN_COUNT=5`, file paths containing keyword substrings) are not redacted in previews
  4. The original, unredacted command is what `child_process.exec` receives — redaction affects display only
**Plans:** 2 plans
Plans:
- [ ] 11-01-PLAN.md — Define SECRET_PATTERNS ordered array and isSafeValue helper in commands.js with tests
- [ ] 11-02-PLAN.md — Refactor redactSecrets() in sanitize.js to use SECRET_PATTERNS with comprehensive tests

### Phase 12: Selection Normalization
**Goal**: AI-generated numbered lists are always presented as a clean 1..N sequence before any render or headless resolution, regardless of gaps or non-standard source numbering
**Depends on**: Phase 10
**Requirements**: SEL-01, SEL-02, SEL-03
**Success Criteria** (what must be TRUE):
  1. A numbered list with gaps (e.g., 1, 3, 7) renders as 1, 2, 3 in the selection prompt
  2. The original label text and metadata for each entry are unchanged after normalization
  3. `--select=2` and `GS_DONE_SELECT=2` resolve to the item at post-normalization position 2 consistently
  4. A list with duplicate leading numbers causes a hard error with a retry hint rather than silently selecting the wrong item
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Schema & Selector | v1.0 | 2/2 | Complete | 2026-02-24 |
| 8. Safe Dispatch | v1.0 | 2/2 | Complete | 2026-02-24 |
| 9. UX Polish & Headless | v1.0 | 2/2 | Complete | 2026-02-24 |
| 10. Shared Command Policy Foundation | 2/2 | Complete   | 2026-02-24 | - |
| 11. Secure Dispatcher | v1.1 | 0/2 | Planned | - |
| 12. Selection Normalization | v1.1 | 0/? | Not started | - |

---
*For archived requirements, see: [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)*
