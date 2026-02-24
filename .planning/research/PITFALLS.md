# Pitfalls Research — Codex Base Optimization

## Common Pitfalls

1) **Prompt/command drift**
- Warning: Flags or includes differ between commands and prompts
- Prevention: Add alignment checklist and optional TOML validation
- Phase: Early validation

2) **Unpinned MCP/skill dependencies**
- Warning: `npx` pulls latest causing behavior changes
- Prevention: Add pinned versions in manifest or scripts; document expected versions
- Phase: Skill/tooling hardening

3) **Template path breakage**
- Warning: Includes in `CODEX.md` or templates reference moved files
- Prevention: Validate paths; keep casing consistent
- Phase: Guidance alignment

4) **Secret leakage in docs/logs**
- Warning: Examples accidentally include tokens
- Prevention: Secret scan guidance; avoid realistic-looking keys in docs
- Phase: Validation and docs pass

5) **Skill scripts failing on env mismatch**
- Warning: Assumes pnpm/node versions not present
- Prevention: Preflight checks, clear error messages, pin versions
- Phase: Skill hardening

6) **State/traceability gaps**
- Warning: REQUIREMENTS ↔ ROADMAP mapping not updated
- Prevention: Scripted check or clearer instructions in roadmapper output
- Phase: Roadmap creation
