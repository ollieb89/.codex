# Roadmap — Codex Base Optimization

**Phases:** 6
**Requirements covered:** 12/12 ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Align Guidance | Stabilize RULES/PRINCIPLES/MODE/AGENTS includes and coherence | GUID-01, GUID-02, GUID-03 | 3 |
| 2 | Sync Commands & Prompts | Eliminate drift between commands/*.toml and prompts/*.toml | CMDS-01, CMDS-02, CMDS-03 | 3 |
| 3 | Harden Workflows | Ensure runtime helpers and key workflows run cleanly | FLOW-01, FLOW-02, FLOW-03 | 3 |
| 4 | Stabilize Skills | Pin and preflight skill scripts | SKILL-01, SKILL-02 | 2 |
| 5 | Secure & Pin Runtime | Add hygiene items: secrets, Node version, MCP pinning | SAFE-01, SAFE-02 | 2 |
| 6 | Optional Enhancements | Add optional validation and health checks | ENH-01, ENH-02 | 2 |

## Phase Details

**Phase 1: Align Guidance**
Goal: Stabilize RULES/PRINCIPLES/MODE/AGENTS includes and coherence
Requirements: GUID-01, GUID-02, GUID-03
Success criteria:
1. CODEX.md includes resolve without broken paths
2. MODE_*.md and agents/*.md reflect RULES/PRINCIPLES without contradictions
3. AGENTS/MODE docs clearly state when to use each agent/persona

**Phase 2: Sync Commands & Prompts**
Goal: Eliminate drift between commands/*.toml and prompts/*.toml
Requirements: CMDS-01, CMDS-02, CMDS-03
Success criteria:
1. TOML validation passes across commands/ (no tomllib errors)
2. Each commands entry has a matching prompt with aligned flags/mcp-servers
3. Prompt includes/templates resolve correctly

**Phase 3: Harden Workflows**
Goal: Ensure runtime helpers and key workflows run cleanly
Requirements: FLOW-01, FLOW-02, FLOW-03
Success criteria:
1. `gsd-tools init` handles missing STATE/config gracefully
2. new-project/map-codebase workflows complete without manual edits in a dry run
3. REQUIREMENTS↔ROADMAP traceability steps documented or automated

**Phase 4: Stabilize Skills**
Goal: Pin and preflight skill scripts
Requirements: SKILL-01, SKILL-02
Success criteria:
1. Skill scripts pin required tool versions (pnpm/Vite/Tailwind/etc.)
2. Scripts fail fast with actionable errors when env is missing

**Phase 5: Secure & Pin Runtime**
Goal: Add hygiene items: secrets, Node version, MCP pinning
Requirements: SAFE-01, SAFE-02
Success criteria:
1. Secret hygiene guidance and scan instructions present in docs
2. .nvmrc added (Node 20) and MCP/server versions pinned or documented

**Phase 6: Optional Enhancements**
Goal: Add optional validation and health checks
Requirements: ENH-01, ENH-02
Success criteria:
1. Optional lint/scan scripts documented and runnable locally
2. MCP health-check helper available (optional)

---
