# Stack Research — Codex Base Optimization

**Context:** Optimize a local Codex toolkit of prompts/agents/skills; Node.js/CJS utilities, Markdown/TOML configs, no package manifest.

## Recommended Stack (2026)

- Node.js 20 LTS for scripting reliability and fs performance
- Keep CommonJS for compatibility with existing files; consider gradual ESM only if tooling aligns
- Add minimal `package.json` with pinned devDependencies for scripts used via `npx` (e.g., `@playwright/mcp`, `@modelcontextprotocol/server-sequential-thinking`, `@upstash/context7-mcp`), to avoid latest drift
- Prefer `pnpm` for deterministic installs in skill scaffolds; pin Vite/Tailwind versions in scripts

## Supporting Tools

- `python -m tomllib` for TOML validation (already suggested in docs)
- `rg` for fast search; ensure it is standard in instructions
- Optional: `shellcheck` for skill scripts, `markdownlint` for prompt docs (non-blocking)

## Configuration Practices

- Centralize defaults in `.planning/config.json`; keep `config.toml` for trust roots only
- Explicit MCP server versions in `settings.json` or wrapper scripts
- Add `.nvmrc` (Node 20) for consistent runtime

## What NOT to change

- Do not introduce heavy frameworks or transpilation; keep plain text and Node scripts
- Avoid breaking CommonJS loading in `get-shit-done/bin/lib/*.cjs`

## Confidence

- Stack/runtime recommendations: High (matches current usage)
- Version pinning suggestions: Medium (requires minor edits but reduces drift)
