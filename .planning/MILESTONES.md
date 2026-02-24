# Milestones

## v1.0 Numbered CLI Selection UX (Shipped: 2026-02-24)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


## v1.1 Standardize Selection & Security (Shipped: 2026-02-24)

**Phases:** 10-12 (3 phases, 6 plans, 12 tasks)
**Commits:** 27 | **Lines:** +5,091 / -91 | **Tests:** 126 passing
**Git range:** cd5be59..cd204bf

**Key accomplishments:**
- Created shared commands.js constants module — single source of truth for all command-policy constants (SEC-03)
- Implemented 10-tier ordered secret redaction with provider-specific patterns and safe-value detection (SEC-01, SEC-02)
- Hardened normalizeOptions() to reindex gap lists, 0-indexed, leading-zero, and markdown-wrapped numbers to clean 1..N (SEL-01)
- Rewrote stripSimpleMarkdown() to preserve label text while cleaning number prefixes only (SEL-02)
- Wired run() convenience function as single-chokepoint normalize-then-select pipeline with headless support (SEL-03)
- 126 total tests with zero regressions across dispatcher and selector subsystems

**Tech debt:**
- `ps aux` exposes secrets in CLI arguments — accepted known limitation
- Phase 11 missing VERIFICATION.md (verified via SUMMARY frontmatter and test results)

---

