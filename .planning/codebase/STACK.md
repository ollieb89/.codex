# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- Markdown - All behavioral guides and templates in `CODEX.md`, `AGENTS.md`, `MODE_*.md`, and `get-shit-done/templates/`
- TOML - Command and prompt definitions in `commands/**/*.toml` and `prompts/**/*.toml`
- JavaScript (CommonJS) - CLI helpers in `get-shit-done/bin/gsd-tools.cjs` and `get-shit-done/bin/lib/*.cjs`

**Secondary:**
- Bash - Scaffolding scripts such as `skills/web-artifacts-builder/scripts/init-artifact.sh`
- Python - Skill packaging utilities in `skills/skill-creator/scripts/*.py`

## Runtime

**Environment:**
- Node.js 18+ (CLI utilities rely on modern fs/path APIs; web-artifacts builder enforces >=18)
- System git binary required for commits and ignore checks in `get-shit-done/bin/lib/core.cjs`

**Package Manager:**
- None tracked for the repo itself (no `package.json` or lockfile)
- pnpm assumed by `skills/web-artifacts-builder/scripts/init-artifact.sh` when scaffolding new projects

## Frameworks

**Core:**
- Vanilla Node.js CLI (no application framework)

**Testing:**
- None present (no test runner configured)

**Build/Dev:**
- Node built-ins plus shell utilities; scaffolding scripts install Vite/Tailwind in generated projects but not in this repo

## Key Dependencies

**Critical:**
- Node built-ins `fs`, `path`, `child_process` across `get-shit-done/bin/lib/*.cjs` for file/state/git operations
- Git CLI via `execGit` in `get-shit-done/bin/lib/core.cjs` for status and commits

**Infrastructure:**
- External MCP servers started via `settings.json` (npx commands for `@modelcontextprotocol/server-sequential-thinking`, `@upstash/context7-mcp`, `@playwright/mcp`)
- Brave Search API optionally used by `get-shit-done/bin/lib/commands.cjs` when `BRAVE_API_KEY` is configured

## Configuration

**Environment:**
- `.planning/config.json` (optional) influences model profile and commit behavior; defaults resolved in `get-shit-done/bin/lib/config.cjs`
- `config.toml` sets trusted project roots and default model/personality
- `settings.json` defines MCP server commands; requires env vars like `BRAVE_API_KEY`, `TWENTYFIRST_API_KEY`, `MORPH_API_KEY` when enabling optional servers

**Build:**
- No build configuration files; repository is consumed as raw text/templates

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js 18+, git CLI, and standard POSIX shell utilities
- pnpm only needed when running scaffold scripts under `skills/web-artifacts-builder/scripts/`

**Production:**
- Not deployed; files are consumed by the Codex/GSD tooling directly from the filesystem

---

*Stack analysis: 2026-02-24*
*Update after major dependency changes*
