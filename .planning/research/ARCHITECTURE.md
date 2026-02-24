# Architecture Research — Codex Base Optimization

**Current structure:** Monolithic local toolkit: Markdown/TOML guidance, CommonJS utilities (`get-shit-done/bin/lib/*.cjs`), templates, skills scripts.

## Recommended Component Boundaries

- **Guidance Layer:** `CODEX.md`, `RULES.md`, `PRINCIPLES.md`, `MODE_*.md`, `AGENTS.md` — source of truth; ensure includes resolve
- **Command/Prompt Layer:** `commands/**/*.toml`, `prompts/**/*.toml` — mirrored pairs; validate names/flags/mcp-servers alignment
- **Runtime Layer:** `get-shit-done/bin/gsd-tools.cjs` + `bin/lib/*.cjs` — utilities for init, state, roadmap, commit; add guardrails and version hints
- **Templates/Workflows:** `get-shit-done/templates/**`, `get-shit-done/workflows/**` — ensure references intact and up to date
- **Skills:** `skills/**` — isolated scripts; pin dependencies and add environment checks
- **Operational Data:** `.planning/`, `sessions/`, `logs/`, `backups/` — keep paths and permissions safe

## Data Flow

- Commands/prompts feed agents → runtime helpers write artifacts to `.planning/`
- Workflows reference templates and rules; state tracked in `.planning/STATE.md`
- Skills run externally; rely on scripts and local tools

## Build Order / Optimization Order

1) Stabilize guidance (RULES/PRINCIPLES/MODE/AGENTS) and includes
2) Align commands ↔ prompts metadata
3) Harden runtime helpers (init, commit, map-codebase, new-project)
4) Pin skill scripts and add validation
5) Add lightweight validation scripts/docs (TOML/Markdown, secret scan)

## Cross-Cutting Concerns

- Version pinning for MCP servers and skill dependencies
- Secret hygiene in templates and docs
- Deterministic search/tools (`rg`, python tomllib)

## Confidence

- Boundary mapping: High
- Build/optimization order: Medium-High
