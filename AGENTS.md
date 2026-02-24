# Repository Guidelines

## Project Structure & Module Organization
- `CODEX.md` is the entrypoint that includes `FLAGS.md`, `PRINCIPLES.md`, `RULES.md`, and the `MODE_*.md` behavior profiles; edits here change global defaults.
- `commands/sg/*.toml` define task commands with metadata, personas, and full prompt text; filenames mirror command names (e.g., `build.toml`).
- `prompts/sg/*.toml` hold companion prompt templates; keep them in sync with the command definitions.
- Operational data such as `backups/`, `sessions/`, and `logs/` record run history; avoid manual edits unless diagnosing issues.
- `config.toml` stores trusted project roots; adjust cautiously to avoid widening access unintentionally.

## Build, Test, and Development Commands
- No build pipeline is needed; files are plain text. Use `rg 'keyword' commands/sg` or `rg 'keyword' prompts/sg` to navigate content quickly.
- Validate TOML syntax after significant edits, e.g., `python -m tomllib commands/sg/build.toml >/dev/null`.
- For Markdown, rely on simple heading/paragraph structure; no generator or formatter is required.

## Coding Style & Naming Conventions
- Markdown: start with an H1, keep sections concise, favor bullet lists over dense prose.
- TOML: align key/value pairs without extra indentation, prefer triple-quoted strings for prompt bodies, and use Title Case for persona names.
- Filenames: new modes should follow `MODE_<Name>.md` (PascalCase), and new commands should match the invocation name (`estimate.toml`, `cleanup.toml`).
- Default to ASCII; only introduce special characters if the file already uses them and they are intentional.

## Testing Guidelines
- No automated tests exist; review diffs carefully and dry-run new prompts mentally for clarity, consistency, and safety.
- When touching files referenced with `@` includes in `CODEX.md`, double-check paths and casing so imports keep resolving.
- If changing operational data directories, verify permissions and avoid deleting historical context unless explicitly required.

## Commit & Pull Request Guidelines
- The repository currently lacks git history; if committing elsewhere, prefer conventional commits (e.g., `chore: update sg prompts`) with focused scopes.
- PR descriptions should explain what changed, why it improves agent behavior, and what manual validation you performed; include sample navigation commands where useful.

## Security & Configuration Tips
- Do not store secrets in prompts, backups, or session logs; scrub sensitive content before sharing artifacts.
- Keep trusted paths in `config.toml` minimal; review changes with security in mind before broadening the trust list.

## Modes & MCP Servers
- Modes live in `MODE_*.md` and are included via `CODEX.md`; adjust behavior there and keep includes in `CODEX.md` intact.
- Active MCP servers in `settings.json`: `sequential-thinking`, `context7`, `playwright`; declare them per command in `mcp-servers` arrays when needed.
- Disabled servers (enable by moving to `mcpServers`): `magic`, `serena`, `morphllm-fast-apply`; ensure required env vars are set before enabling.
- Flags in `FLAGS.md` map to modes/MCPs (e.g., `--brainstorm`, `--play`, `--seq`, `--context7`, `--all-mcp`, `--no-mcp`); use them when invoking `sg` flows to force or prevent activation.

## Slash → sg Command Map
- analyze → slash-analyze (`sg slash-analyze`)
- build → slash-build (`sg slash-build`)
- cleanup → slash-cleanup (`sg slash-cleanup`)
- design → slash-design (`sg slash-design`)
- document → slash-document (`sg slash-document`)
- estimate → slash-estimate (`sg slash-estimate`)
- explain → slash-explain (`sg slash-explain`)
- git → slash-git (`sg slash-git`)
- implement → slash-implement (`sg slash-implement`)
- improve → slash-improve (`sg slash-improve`)
- index → slash-index (`sg slash-index`)
- load → slash-load (`sg slash-load`)
- reflect → slash-reflect (`sg slash-reflect`)
- save → slash-save (`sg slash-save`)
- select-tool → slash-select-tool (`sg slash-select-tool`)
- test → slash-test (`sg slash-test`)
- troubleshoot → slash-troubleshoot (`sg slash-troubleshoot`)
