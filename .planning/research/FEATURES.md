# Features Research — Codex Base Optimization

**Goal:** Clarify the functional areas to optimize in the Codex toolkit.

## Table Stakes (must-have)

- Prompt/command consistency: commands and prompts stay in sync (names, flags, includes)
- Agent guide coherence: MODE_*.md and agents/*.md align with RULES/PRINCIPLES defaults
- Workflow reliability: new-project/map-codebase/test flows produce artifacts without manual fixes
- Secret hygiene: guidance and templates avoid leaking keys; scans documented
- Skills determinism: scripts pin versions and validate environment before scaffolding

## Differentiators

- Pre-flight validation suite (TOML/Markdown checks) integrated into docs or hooks
- MCP server pinning and health checks before use
- Traceability updates auto-ensured between REQUIREMENTS.md and ROADMAP.md
- UX polish: clearer banners, next-step blocks, and reduced noisy prompts

## Anti-Features / Out of Scope

- Building new product features beyond Codex internals
- Adding heavy CI/CD pipelines; keep lightweight local validation

## Complexity Notes

- Syncing prompts/commands requires cross-file checks but low technical complexity
- Skill determinism may require adjusting scripts and adding lockfiles (medium complexity)
- Adding validation hooks needs careful non-intrusive defaults

## Dependencies

- Node runtime; git available
- Optional tools: python for tomllib, rg installed
