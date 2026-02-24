# Requirements: Codex Base Optimization

**Defined:** 2026-02-24
**Core Value:** Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## v1 Requirements

### Guidance
- [ ] **GUID-01**: `CODEX.md` includes correct paths to FLAGS, PRINCIPLES, RULES, MODE files
- [ ] **GUID-02**: MODE_*.md and agents/*.md are coherent and deduplicated against RULES/PRINCIPLES
- [ ] **GUID-03**: AGENTS/MODE docs clearly map to command usage

### Commands & Prompts
- [ ] **CMDS-01**: `commands/**/*.toml` align with corresponding `prompts/**/*.toml` (names, flags, mcp-servers)
- [ ] **CMDS-02**: TOML validates via `python -m tomllib` with no errors
- [ ] **CMDS-03**: Prompts reference correct templates/includes

### Runtime & Workflows
- [ ] **FLOW-01**: `get-shit-done/bin/lib/*.cjs` have guardrails for missing state/config and clear errors
- [ ] **FLOW-02**: `new-project` and `map-codebase` workflows run end-to-end without manual patching
- [ ] **FLOW-03**: Traceability updates REQUIREMENTS ↔ ROADMAP automatically or with documented steps

### Skills
- [ ] **SKILL-01**: Skill scripts pin required tool versions (pnpm/Vite/Tailwind/etc.)
- [ ] **SKILL-02**: Skill scripts include environment preflight checks with actionable errors

### Hygiene
- [ ] **SAFE-01**: Secret hygiene guidance present; secret scan instructions included
- [ ] **SAFE-02**: Add `.nvmrc` (Node 20) and, if applicable, minimal `package.json` for pinning MCP server versions

## v2 Requirements

### Enhancements
- **ENH-01**: Optional validation script for Markdown linting/shellcheck
- **ENH-02**: Optional MCP health-check helper before launches

## Out of Scope

| Feature | Reason |
|---------|--------|
| New external integrations | Focus is internal optimization |
| Heavy CI/CD pipelines | Keep tooling lightweight and local |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GUID-01 | Phase 1 | Pending |
| GUID-02 | Phase 1 | Pending |
| GUID-03 | Phase 1 | Pending |
| CMDS-01 | Phase 2 | Pending |
| CMDS-02 | Phase 2 | Pending |
| CMDS-03 | Phase 2 | Pending |
| FLOW-01 | Phase 3 | Pending |
| FLOW-02 | Phase 3 | Pending |
| FLOW-03 | Phase 3 | Pending |
| SKILL-01 | Phase 4 | Pending |
| SKILL-02 | Phase 4 | Pending |
| SAFE-01 | Phase 5 | Pending |
| SAFE-02 | Phase 5 | Pending |
| ENH-01 | Phase 6 | Pending |
| ENH-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initialization*
