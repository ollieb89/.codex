# Codex Base Optimization

## What This Is

A focused effort to optimize the Codex local toolkit (prompts, agents, skills, workflows) for faster, safer, and more consistent operations. Features a numbered CLI selection UX with safety dispatch, secret redaction, and auto-reindexing normalization.

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
- ✓ Shared commands.js constants module as single source of truth — v1.1
- ✓ Provider-specific secret redaction with specific-to-generic ordering — v1.1
- ✓ Auto-reindexing normalization for AI-generated numbered lists — v1.1
- ✓ Label text and metadata preservation during normalization — v1.1
- ✓ Headless --select resolves post-normalization IDs — v1.1

### Active

(None — start next milestone to define)

### Out of Scope

- Adding new product features unrelated to Codex internals — focus is internal optimization
- Building new external integrations — only existing MCP servers/settings are considered
- Fuzzy/substring match for --select — non-deterministic; breaks CI pipelines silently
- Entropy-based secret detection — high false-positive rate on base64/hash content
- Interactive TUI arrow-key navigation — fails in headless/SSH; numbered list is always compatible

## Context

- Shipped v1.0 Numbered CLI Selection UX with safety dispatch and UX polish.
- Shipped v1.1 Standardize Selection & Security with shared constants, 10-tier secret redaction, and auto-reindexing normalization.
- Codebase consists of Node.js CLI utilities (CJS), Markdown prompts, and TOML configurations.
- ~6,600 LOC JS/CJS in `get-shit-done` core.
- 126 tests passing across dispatcher (88) and selector (38) subsystems.
- Tech debt: `ps aux` exposes secrets in CLI arguments (accepted limitation).

## Constraints

- **Stack**: Keep current Node.js/CJS structure; avoid major rewrites.
- **Determinism**: Prefer pinned versions/configs where possible to reduce drift.
- **Security**: Strict workspace boundary (CWD) and automated secret redaction in previews.
- **Dependencies**: Zero external runtime dependencies — all features use Node.js built-ins only.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use auto mode with standard depth | Faster end-to-end planning with balanced quality/cost | ✓ Good |
| Prioritize internal optimizations over new features | Focus effort on reliability and clarity of existing toolkit | ✓ Good |
| Strict numbered schema (1-N) | Enables deterministic parsing and re-indexing of agent outputs | ✓ Good |
| Payload-first execution contract | Ensures consistent behavior between interactive and headless flows | ✓ Good |
| Strict CWD workspace boundary | Mitigates risk of AI hallucinating paths outside project scope | ✓ Good |
| Secret redaction in previews | Prevents credential leakage during screen-sharing or logs | ✓ Good |
| Shared commands.js constants module | Single source of truth eliminates drift between dispatcher files | ✓ Good |
| Ordered secret patterns (specific-to-generic) | Prevents prefix collisions (e.g., sk-ant- vs sk-) | ✓ Good |
| Safe-value detection for generic fallback | Prevents false positives on numerics, file paths, short strings | ✓ Good |
| Prefix-only markdown stripping in normalizer | Preserves label text integrity while cleaning number prefixes | ✓ Good |
| Single-chokepoint normalize-then-select | All paths (interactive + headless) get normalized IDs consistently | ✓ Good |
| Zero external dependencies for v1.1 | Node.js built-ins sufficient; avoids supply chain risk | ✓ Good |

---
*Last updated: 2026-02-24 after v1.1 milestone*
