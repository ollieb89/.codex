# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
[cwd]/
├── agents/                # Agent behavior guides
├── commands/              # Command definitions (mirrors sg/ variants)
├── get-shit-done/         # CLI utilities, templates, workflows
├── prompts/               # Prompt templates corresponding to commands
├── skills/                # Optional skills (web artifacts, frontend design, skill creator)
├── sessions/              # JSONL session transcripts
├── logs/                  # CLI execution logs
├── backups/               # Archived snapshots
├── hooks/                 # Codex hook scripts
├── policy/                # Default codex policy files
├── rules/                 # Default ruleset files
├── shell_snapshots/       # Stored shell command captures
├── MODE_*.md              # Mode profiles (behavior presets)
├── CODEX.md, FLAGS.md     # Global configuration docs
└── config.toml, settings.json # Local Codex settings
```

## Directory Purposes

**agents/**
- Purpose: Define specialized agent personas
- Contains: Markdown guides like `agents/gsd-codebase-mapper.md`
- Key files: Persona instructions per role
- Subdirectories: None

**commands/**
- Purpose: Declarative command metadata for slash commands
- Contains: Paired TOML files (base and sg variants) such as `commands/sg/build.toml`
- Key files: `commands/sg/*.toml` for active sg flows
- Subdirectories: `commands/sg/` mirrors top-level commands

**prompts/**
- Purpose: Prompt templates referenced by command definitions
- Contains: TOML and Markdown files; sg variants in `prompts/sg/`
- Key files: `prompts/sg/map-codebase.toml`, `prompts/gsd-new-project.md`
- Subdirectories: `prompts/sg/` holds sg-prefixed templates

**get-shit-done/**
- Purpose: Core runtime utilities and workflow scripts
- Contains: CLI entry `get-shit-done/bin/gsd-tools.cjs`, library modules under `get-shit-done/bin/lib/`, workflows under `get-shit-done/workflows/`, templates under `get-shit-done/templates/`
- Key files: `get-shit-done/bin/lib/core.cjs`, `get-shit-done/templates/codebase/*.md`
- Subdirectories: `bin/`, `templates/`, `workflows/`, `references/`

**skills/**
- Purpose: Optional scaffolding/generation skills
- Contains: `web-artifacts-builder`, `frontend-design`, `skill-creator`
- Key files: `skills/web-artifacts-builder/scripts/init-artifact.sh`, `skills/skill-creator/scripts/init_skill.py`
- Subdirectories: Each skill has scripts and LICENSE/SKILL docs

**sessions/**
- Purpose: Persist run transcripts for auditing/resume
- Contains: Date-stamped JSONL logs (`sessions/YYYY/MM/DD/*.jsonl`)
- Key files: Session files only
- Subdirectories: Nested by year/month/day

**logs/**
- Purpose: Store CLI/tool logs
- Contains: Text logs like `logs/supercodex_*.log`
- Subdirectories: None

**backups/**
- Purpose: Archive prior states
- Contains: Tarballs such as `backups/supercodex_backup_*.tar.gz`
- Subdirectories: None

**hooks/**
- Purpose: Codex hook scripts for status and updates
- Contains: `hooks/gsd-check-update.js`, `hooks/gsd-statusline.js`, `hooks/gsd-context-monitor.js`
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `get-shit-done/bin/gsd-tools.cjs`: Main CLI router for utility commands
- `CODEX.md`: Aggregates flags, principles, rules, and modes for agent initialization

**Configuration:**
- `config.toml`: Local Codex trust/model settings
- `settings.json`: MCP server definitions
- `.planning/config.json` (optional): Planning defaults consumed by `get-shit-done/bin/lib/config.cjs`

**Core Logic:**
- `get-shit-done/bin/lib/*.cjs`: Helpers for state, init, roadmap, template filling, git interactions
- `get-shit-done/workflows/*.md`: Stepwise workflow instructions (e.g., `get-shit-done/workflows/map-codebase.md`)
- `commands/sg/*.toml` + `prompts/sg/*.toml`: Command/prompt pairs driving task flows

**Testing:**
- No dedicated tests directory or fixtures

**Documentation:**
- `agents/*.md`, `MODE_*.md`, `PRINCIPLES.md`, `RULES.md`: Behavior/policy docs
- Templates for generated docs under `get-shit-done/templates/`

## Naming Conventions

**Files:**
- Modes: `MODE_<Name>.md` (PascalCase for name)
- Commands/Prompts: filenames match invocation (e.g., `implement.toml`, `slash-implement.toml`)
- Templates: codebase docs in `stack.md`, `architecture.md`, etc., lowercase filenames

**Directories:**
- sg-specific variants live under `commands/sg/` and `prompts/sg/`
- Skills grouped per capability under `skills/<skill-name>/`

**Special Patterns:**
- Workflow scripts use dash-separated names in `get-shit-done/workflows/`
- Session logs nested by date in `sessions/YYYY/MM/DD/`

## Where to Add New Code

**New Feature:**
- Primary code: `get-shit-done/bin/lib/` for new CLI capabilities; `commands/sg/` and `prompts/sg/` for new commands
- Config if needed: `.planning/config.json` for planning defaults

**New Component/Module:**
- Implementation: `get-shit-done/bin/lib/`
- Templates: `get-shit-done/templates/` for new scaffold files

**New Route/Command:**
- Definition: `commands/sg/<name>.toml`
- Prompt: `prompts/sg/<name>.toml`

**Utilities:**
- Shared helpers: `get-shit-done/bin/lib/core.cjs` or adjacent modules
- Skill scripts: under `skills/<skill>/scripts/`

## Special Directories

**sessions/**
- Purpose: Long-term transcript storage; may grow quickly
- Source: Auto-generated during runs
- Committed: Yes (present in repo)

**backups/**
- Purpose: Archived state snapshots; do not modify manually
- Source: Generated outside this workflow
- Committed: Yes (binary tarballs)

**shell_snapshots/**
- Purpose: Captured shell commands/history
- Source: Tooling-generated
- Committed: Yes

---

*Structure analysis: 2026-02-24*
*Update when directory structure changes*
