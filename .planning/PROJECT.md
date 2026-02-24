# Codex Base Optimization

## What This Is

A focused effort to optimize the Codex local toolkit (prompts, agents, skills, workflows) for faster, safer, and more consistent operations. Targets: clearer prompts, streamlined agent behaviors, and tuned skills/scripts for reliability.

## Core Value

Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## Current Milestone: v1.0 Numbered CLI Selection UX

**Goal:** Standardize numbered option output and selection handling so Codex CLIs can drive actions reliably without manual parsing.

**Target features:**
- Standardized AI output schema for numbered lists (1–N, no filler)
- Generic InputSelector helper to render lists and return selected item
- Input validation with 0-to-exit and non-numeric error handling
- Codex-style execution flow that triggers the associated action on selection

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Standardize AI numbered-list responses across Codex prompts/agents
- [ ] Provide a reusable InputSelector helper for CLI-driven selection
- [ ] Add input validation with 0-to-exit convention for CLI flows
- [ ] Link selections to Codex actions (execute command/apply diff) without manual parsing

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
*Last updated: 2026-02-24 after starting milestone v1.0 Numbered CLI Selection UX*
