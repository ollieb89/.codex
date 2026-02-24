# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Monolithic local prompt/agent toolkit (CLI-oriented)

**Key Characteristics:**
- File-based guidance and state; no server component
- Node.js CLI utilities orchestrate planning workflows
- Commands and prompts defined declaratively in TOML/Markdown
- Operational transcripts logged under `sessions/` for traceability

## Layers

**Guidance & Policy:**
- Purpose: Encode global behavior and safety rules for agents
- Contains: `CODEX.md`, `FLAGS.md`, `PRINCIPLES.md`, `RULES.md`, `MODE_*.md`, `AGENTS.md`
- Depends on: None; referenced by workflows and commands
- Used by: Command prompts and runtime to shape persona behavior

**Command Definitions:**
- Purpose: Map slash commands to task descriptions and metadata
- Contains: `commands/**/*.toml`, notably `commands/sg/*.toml` for sg-prefixed flows
- Depends on: Prompt templates in `prompts/`
- Used by: CLI workflows to generate prompts for agents

**Runtime Utilities:**
- Purpose: Execute workflow logic, parse state, and interact with git
- Contains: `get-shit-done/bin/gsd-tools.cjs`, supporting modules under `get-shit-done/bin/lib/*.cjs`
- Depends on: Local filesystem and git CLI
- Used by: Workflow scripts and shell snippets in documentation

**Templates & References:**
- Purpose: Provide scaffolds for plans, summaries, codebase maps, and research artifacts
- Contains: `get-shit-done/templates/**`, `get-shit-done/references/**`
- Depends on: None; consumed by runtime utilities
- Used by: Workflow commands (e.g., map-codebase) to generate standard outputs

**Skills & Generators:**
- Purpose: Optional code generation helpers for specific domains
- Contains: `skills/web-artifacts-builder`, `skills/frontend-design`, `skills/skill-creator`
- Depends on: Shell/Python runtimes when executed
- Used by: External automation outside the core CLI

**Operational Data:**
- Purpose: Persist run history and backups
- Contains: `sessions/**`, `logs/**`, `backups/`
- Depends on: Runtime utilities writing transcripts
- Used by: Review and continuity tooling

## Data Flow

**Workflow Execution (e.g., map-codebase):**
1. User invokes a workflow; `get-shit-done/bin/lib/init.cjs` loads config/state
2. `get-shit-done/bin/gsd-tools.cjs` resolves models and working directories
3. Workflow-specific steps read templates under `get-shit-done/templates/`
4. Outputs are written to `.planning/` or reported via CLI; sessions recorded in `sessions/YYYY/MM/DD/*.jsonl`

**State Management:**
- File-based; `.planning/STATE.md` (when present) parsed and mutated via functions in `get-shit-done/bin/lib/state.cjs`

## Key Abstractions

**Model Profiles:**
- Purpose: Map agent types to model tiers (`MODEL_PROFILES` in `get-shit-done/bin/lib/core.cjs`)
- Examples: `gsd-codebase-mapper`, `gsd-planner`
- Pattern: Lookup table used by `resolve-model` commands

**Workflow Steps:**
- Purpose: Declarative step-by-step instructions per task
- Examples: Markdown workflows under `get-shit-done/workflows/*.md`
- Pattern: Human-readable scripts executed manually by operators/agents

**Templates:**
- Purpose: Standardize generated artifacts (plans, summaries, codebase docs)
- Examples: `get-shit-done/templates/codebase/*.md`
- Pattern: Markdown files with section scaffolding

## Entry Points

**CLI Utility:**
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Triggers: Direct node invocation (`node get-shit-done/bin/gsd-tools.cjs ...`)
- Responsibilities: Route subcommands, call library helpers, and write outputs

**Guidance Loader:**
- Location: `CODEX.md`
- Triggers: Included by host tooling to set behavior defaults
- Responsibilities: Aggregate RULES/PRINCIPLES/FLAGS and mode files

## Error Handling

**Strategy:** Lightweight validation with immediate process exit

**Patterns:**
- `error(message)` in `get-shit-done/bin/lib/core.cjs` writes to stderr and exits non-zero
- Most library functions throw or return structured errors; caller surfaces to user without retries

## Cross-Cutting Concerns

**Logging:**
- Session transcripts stored as JSONL under `sessions/YYYY/MM/DD/`

**Validation:**
- TOML/Markdown validation left to manual commands (e.g., `python -m tomllib`), no centralized linter

**Authentication:**
- None baked in; relies on environment variables when external services are enabled

---

*Architecture analysis: 2026-02-24*
*Update when major patterns change*
