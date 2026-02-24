# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Modes use `MODE_<Name>.md` (PascalCase component), e.g., `MODE_Brainstorming.md`
- Commands/prompts mirror invocation names (`build.toml`, `slash-build.toml`, `commands/sg/build.toml`)
- Templates and guides remain lowercase with hyphens where needed (e.g., `get-shit-done/workflows/map-codebase.md`)

**Functions:**
- camelCase for CommonJS functions (e.g., `normalizePhaseName` in `get-shit-done/bin/lib/core.cjs`)
- No special prefix for async functions; many helpers are synchronous
- CLI router uses verb-noun naming (e.g., `cmdStateUpdate`, `cmdStateRecordMetric`)

**Variables:**
- camelCase for locals; uppercase snake case for constant maps (e.g., `MODEL_PROFILES`)
- Descriptive, multi-word names favored over abbreviations

**Types:**
- Not typed (plain JS); type hints absent

## Code Style

**Formatting:**
- CommonJS with single quotes; semicolons used consistently
- Manual formatting; no formatter config tracked
- Comments used sparingly to explain intent over mechanics

**Linting:**
- No ESLint/Prettier; rely on reviewer discipline

## Import Organization

**Order:**
1. Node built-ins (`fs`, `path`, `child_process`)
2. Local modules (e.g., `require('./lib/core.cjs')`)
3. No external package imports inside the repo code

**Grouping:**
- Related requires grouped at top without blank-line separation

**Path Aliases:**
- None; relative paths only

## Error Handling

**Patterns:**
- Fail fast: `error(message)` in `get-shit-done/bin/lib/core.cjs` logs to stderr and exits
- Helpers often return `{ exitCode, stdout, stderr }` objects (e.g., `execGit`) for callers to inspect
- Minimal try/catch; assumes happy-path execution and direct process exit on invalid input

**Error Types:**
- Standard Error objects; no custom subclasses
- Input validation performed inline (e.g., argument presence checks in `gsd-tools.cjs`)

## Logging

**Framework:**
- Standard `console`/stdout prints; no structured logger

**Patterns:**
- Operational logs accumulated as JSONL sessions (`sessions/**`) and plaintext files in `logs/`
- Hook scripts (`hooks/gsd-context-monitor.js`) emit brief status updates only

## Comments

**When to Comment:**
- Explain intent behind helpers or non-obvious behavior; avoid restating obvious code
- Templates include inline guidance to instruct agents/users

**TODO Comments:**
- Rare; backlog managed via workflow docs rather than inline TODOs

## Function Design

**Size:**
- Helpers kept relatively small; larger flows broken into subcommands (state, roadmap, verify)

**Parameters:**
- Positional arguments for CLI parsing; option flags resolved manually (e.g., `args.indexOf('--phase')`)
- Objects used when passing structured options to helper functions

**Return Values:**
- CLI commands return via stdout; library helpers return plain objects or throw

## Module Design

**Exports:**
- CommonJS `module.exports = { ... }` pattern across `get-shit-done/bin/lib/*.cjs`
- Shared constants/functions defined near top; supporting utilities below

**State:**
- File-backed state; functions accept `cwd` to avoid global process mutations

---

*Conventions analysis: 2026-02-24*
*Update when style or naming patterns change*
