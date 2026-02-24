# Codex Base Optimization

## What This Is

A focused effort to optimize the Codex local toolkit (prompts, agents, skills, workflows) for faster, safer, and more consistent operations. Targets: clearer prompts, streamlined agent behaviors, and tuned skills/scripts for reliability.

## Core Value

Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## Requirements

### Validated

- ✓ Standardized AI numbered-list responses across Codex prompts/agents — v1.0
- ✓ Reusable InputSelector helper for CLI-driven selection — v1.0
- ✓ Input validation with 0-to-exit convention for CLI flows — v1.0
- ✓ Link selections to Codex actions (execute command/apply diff) with safety dispatch — v1.0
- ✓ Width-aware truncation and Unicode-aware alignment — v1.0
- ✓ Headless preselection support for scripts and CI — v1.0

### Active

(Planning next milestone)

### Out of Scope

- Adding new product features unrelated to Codex internals — focus is internal optimization
- Building new external integrations — only existing MCP servers/settings are considered

## Context

- Shipped v1.0 Numbered CLI Selection UX with safety dispatch and UX polish.
- Codebase consists of Node.js CLI utilities (CJS), Markdown prompts, and TOML configurations.
- Safety dispatch layer includes strict workspace boundary and secret redaction.
- ~6,600 LOC JS/CJS in `get-shit-done` core.

## Constraints

- **Stack**: Keep current Node.js/CJS structure; avoid major rewrites.
- **Determinism**: Prefer pinned versions/configs where possible to reduce drift.
- **Security**: Strict workspace boundary (CWD) and automated secret redaction in previews.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use auto mode with standard depth | Faster end-to-end planning with balanced quality/cost | ✓ Good |
| Prioritize internal optimizations over new features | Focus effort on reliability and clarity of existing toolkit | ✓ Good |
| Strict numbered schema (1–N) | Enables deterministic parsing and re-indexing of agent outputs | ✓ Good |
| Payload-first execution contract | Ensures consistent behavior between interactive and headless flows | ✓ Good |
| Strict CWD workspace boundary | Mitigates risk of AI hallucinating paths outside project scope | ✓ Good |
| Secret redaction in previews | Prevents credential leakage during screen-sharing or logs | ✓ Good |

---
*Last updated: 2026-02-24 after v1.0 milestone*
