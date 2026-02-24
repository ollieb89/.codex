# Phase 8: Safe Dispatch - Research

**Goal (from roadmap):** Execute selected actions safely with previews, confirmation, and allowlists.
**Requirements to satisfy:** SAF-01, SAF-02
**Inputs reviewed:** ROADMAP.md, REQUIREMENTS.md, STATE.md, 08-CONTEXT.md

## Domain Notes
- Dispatcher receives structured selections (from Phase 7 selector) and must map to action types: shell command, diff apply, or workflow/flow step.
- Mutating vs read-only detection gates confirmation/dry-run. SAF-01 requires preview + confirmation for mutating actions; dry-run path needed.
- SAF-02 focuses on sanitizing payloads (commands/paths) and blocking outside-workspace actions.
- Context mandates strict workspace boundary (path resolution), high-signal previews (full raw commands, destructive highlighting), mini-diff ±3, metadata (impact, sourceAgentId, action type), and secret redaction in previews.

## Safety Controls to Implement
- Path safety: resolve paths, require they start with cwd; block otherwise. Treat symlinks carefully (resolve realpath before allow).
- Command policy: allow standard dev tools; block high-risk (sudo, curl|bash, chown); gray-area remote actions (git push/npm publish) require `--force-dispatch`.
- Secret hygiene: redact preview output for patterns like `*_API_KEY`, `*_TOKEN`, `*_SECRET`; keep execution values intact.
- Edit-on-block: default inline readline for quick fixes; offer `$EDITOR` (Ctrl+E) for multi-line edits; ensure edited command re-validates through allowlist/boundary.

## Preview & Interaction Patterns
- Show full raw command (no reformatting). Highlight destructive verbs/flags red/bold; base text dim.
- Diff previews: unified mini-diff with ±3 lines for file modifications.
- Metadata: impact summary (files/paths affected), sourceAgentId, and action type displayed alongside preview.
- Confirmation: per-action prompt with safe default cancel; dry-run path should mirror preview output but skip side effects.

## Edge Cases & Considerations
- Multi-line commands and scripts: ensure allowlist/blocklist scanning accounts for line breaks; handle heredocs safely (potentially block or require confirmation/override).
- Git/diff actions: ensure apply/patch respects workspace boundary and shows mini-diff; dry-run could be `--stat`/`--check` style where possible.
- Environment leakage: avoid echoing env expansions in preview; redact detected secrets before rendering.
- Workspace detection under symlinks/relative paths; enforce normalized absolute paths.
- Logging/Audit: maintain record of selections, previews, and user confirmation/dry-run choice without leaking secrets.

## Research-Guided Must-Haves (for planner)
- Cover SAF-01/SAF-02 explicitly in plan tasks and verification.
- Deliver preview pipeline matching context choices (full raw command, red/bold risk terms, mini-diff ±3, metadata).
- Implement strict boundary + allowlist/blocklist + force-dispatch gate for gray-area commands; include edit-on-block flow.
- Ensure dry-run behaves consistently across action types and pairs with confirmation defaults (cancel-first).

---
*Research complete: 2026-02-24*
