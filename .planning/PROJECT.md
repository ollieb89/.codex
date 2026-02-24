# Codex Base Optimization

## What This Is

A focused effort to optimize the Codex local toolkit (prompts, agents, skills, workflows) for faster, safer, and more consistent operations. Targets: clearer prompts, streamlined agent behaviors, and tuned skills/scripts for reliability.

## Core Value

Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Prompts and command TOML are normalized, validated, and documented
- [ ] Agent guides and modes are coherent, deduplicated, and aligned with defaults
- [ ] Skills (web-artifacts-builder, frontend-design, skill-creator) are audited and tuned for reproducibility
- [ ] Workflows generate reliable planning artifacts (config/state/roadmap) without manual patching
- [ ] Git and config defaults support safe, repeatable runs

### Out of Scope

- Adding new product features unrelated to Codex internals — focus is internal optimization
- Building new external integrations — only existing MCP servers/settings are considered

## Context

- Codebase is a local prompts/agents/tooling bundle (Node.js CLI utilities, Markdown/TOML docs)
- Recent codebase map exists under `.planning/codebase/`
- No package manifest; dependencies are implicit via scripts (`npx` MCP servers, pnpm in skills)

## Constraints

- **Stack**: Keep current Node.js/CJS structure; avoid major rewrites
- **Determinism**: Prefer pinned versions/configs where possible to reduce drift
- **Security**: Avoid introducing secrets; reinforce secret hygiene in docs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use auto mode with standard depth | Faster end-to-end planning with balanced quality/cost | — Pending |
| Prioritize internal optimizations over new features | Focus effort on reliability and clarity of existing toolkit | — Pending |

---
*Last updated: 2026-02-24 after initialization*
