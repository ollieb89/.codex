# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Dependency Management:**
- Issue: No `package.json` or lockfile; external CLIs (`npx` MCP servers, pnpm installs in skill scripts) pull latest versions implicitly
- Why: Repository is treated as static prompt/config bundle rather than a managed Node project
- Impact: Tooling behavior may change unexpectedly with upstream updates; reproducibility is low
- Fix approach: Add minimal manifest with pinned CLI versions for MCP server launches and scaffold dependencies

**Validation Workflow:**
- Issue: Workflows rely on manual adherence (e.g., running `python -m tomllib`); no automated lint/test gates
- Why: Designed for human-in-the-loop operations
- Impact: Silent drift or syntax errors in TOML/Markdown can slip in
- Fix approach: Introduce lightweight CI or local preflight scripts to validate commands/prompts

## Known Bugs

**State Absence Handling:**
- Symptoms: Some workflows assume `.planning/STATE.md` exists; when absent they may exit early without clear guidance
- Trigger: Running state-aware helpers in a fresh repo
- Workaround: Manually create `.planning/config.json` and STATE templates from `get-shit-done/templates/`
- Root cause: Minimal guarding around optional planning files

## Security Considerations

**Session Logs:**
- Risk: `sessions/**` and `logs/**` capture prior interactions that may contain sensitive context
- Current mitigation: None beyond file permissions
- Recommendations: Review before sharing archives; consider `.gitignore` for sensitive snapshots if needed

**External Keys:**
- Risk: Env vars for MCP/Brave keys are referenced but not managed; accidental inclusion in generated docs is possible
- Current mitigation: Key files not tracked; workflow includes manual secret scan
- Recommendations: Enforce secret scanning on commits and keep key material out of repository paths

## Performance Bottlenecks

**Large Searches:**
- Problem: Utilities rely on synchronous filesystem scans (e.g., `rg`, `fs.readdirSync` in `get-shit-done/bin/lib/core.cjs`)
- Measurement: Acceptable for current size; may slow on very large worktrees
- Cause: Simplicity over streaming
- Improvement path: Add pagination/async traversal if repo size grows significantly

## Fragile Areas

**Core CLI Modules:**
- Why fragile: `get-shit-done/bin/lib/*.cjs` functions are tightly coupled and lack tests
- Common failures: Argument parsing edge cases; git calls failing in non-repo directories
- Safe modification: Add defensive checks and dry-run changes with sample STATE/ROADMAP files
- Test coverage: None

## Dependencies at Risk

**`npx`-fetched MCP Servers:**
- Risk: Pulling latest `@playwright/mcp`, `@modelcontextprotocol/server-sequential-thinking`, `@upstash/context7-mcp` can introduce breaking changes
- Impact: Workflow startup failures or changed API surface
- Migration plan: Pin versions in a manifest or wrapper script; cache binaries locally

## Missing Critical Features

**Automated Validation:**
- Problem: No CI or scripted checks for TOML/Markdown correctness
- Current workaround: Manual review and ad-hoc commands
- Blocks: Harder to trust updates across many command/prompt pairs
- Implementation complexity: Low (shell script or GitHub Actions)

## Test Coverage Gaps

**Runtime Helpers:**
- What's not tested: State parsing, roadmap manipulation, git helpers in `get-shit-done/bin/lib/`
- Risk: Regressions unnoticed until run-time failures
- Priority: High if core behavior changes
- Difficulty to test: Moderate due to filesystem/git side effects; can be mitigated with fixtures and mocks

---

*Concerns audit: 2026-02-24*
*Update as issues are fixed or new ones discovered*
