# Research Summary — Codex Base Optimization

## Stack
- Stay on Node.js 20 LTS, CommonJS; add minimal `package.json` to pin MCP server versions and skill dependencies; provide `.nvmrc` for consistency.
- Keep repo framework-free; use `python -m tomllib` and `rg` as standard utilities; optional shellcheck/markdownlint for hygiene.

## Features Focus
- Table stakes: prompt/command alignment, agent/mode coherence, workflow reliability, secret hygiene, skill determinism.
- Differentiators: preflight validation, MCP pinning/health checks, automatic traceability enforcement, UX clarity in prompts/banners.
- Anti-features: avoid new product features or heavy CI; stay lightweight and internal.

## Architecture
- Layers: guidance → commands/prompts → runtime utilities → templates/workflows → skills → operational data.
- Optimization order: guidance alignment → command/prompt sync → runtime hardening → skill pinning → validation scripts.

## Pitfalls & Mitigations
- Drift between commands/prompts → alignment checklist/validator.
- Unpinned dependencies → pin versions in manifest/scripts.
- Broken template paths → path validation and include checks.
- Secret leakage → avoid realistic keys; document scans.
- Skill env mismatch → preflight checks and clearer errors.
- Traceability gaps → enforce REQUIREMENTS↔ROADMAP mapping updates.
