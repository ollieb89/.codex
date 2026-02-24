# Phase 8: Safe Dispatch - Context

**Gathered:** 2026-02-24  
**Status:** Ready for planning

## Phase Boundary

Execute selected actions safely with previews, confirmation, dry-run, and sanitization; keep execution within the workspace and prevent unsafe AI-suggested payloads.

## Implementation Decisions

### Preview Scope
- Show the full raw command exactly as run (multi-line OK); no reformatting that could mask syntax/flags.
- Highlight destructive verbs/flags (e.g., rm, drop, truncate, overwrite, --force) in red/bold; keep base command text dim as a visual speedbump.
- For file modifications, show a unified mini-diff with ±3 lines of context.
- Include metadata in the preview: impact summary (files/paths affected), sourceAgentId, and action type.

### Sanitization & Allowlist
- Workspace boundary is strict: resolve paths and require they start with process.cwd(); anything outside is blocked.
- Command policy: allow standard dev tools; block high-risk commands (e.g., sudo, curl|bash, chown). Gray-area remote actions (git push, npm publish, similar) require an explicit `--force-dispatch` flag; otherwise blocked.
- When blocked, default to an inline readline prompt for quick edits; provide a Ctrl+E escape to open `$EDITOR` with the command prefilled for multi-line fixes.
- Redact secrets in previews (patterns like `*_API_KEY`, `*_TOKEN`, `*_SECRET`, etc.); execute with originals intact.

### Claude's Discretion
- Finalize confirmation wording/flow and dry-run output formatting, keeping defaults conservative (cancel-first) and consistent with the above preview/safety choices.
- Tune allowlist/blocklist granularity within the stated policy (e.g., which dev tools are in the allowlist) while honoring the strict workspace boundary.
- Choose exact metadata styling as long as the required items (impact, sourceAgentId, action type) remain visible.

## Specific Ideas

- High-signal preview: dim full command with red/bold risk terms; mini-diff (±3) for file changes; metadata toast showing impact and sourceAgentId/action type; secrets redacted in preview only.
- Dispatcher flow: receive payload → sanitize (allowlist/blocklist + path resolution) → preview (with redactions) → gatekeeper (blocked ⇒ edit path; gray-area ⇒ require `--force-dispatch`) → per-action confirmation (safe default = cancel) → dispatch or dry-run log.

## Deferred Ideas

- Future safe-directory list (e.g., `~/.logs`) once the v1 strict-boundary pattern is proven.

---

*Phase: 08-safe-dispatch*  
*Context gathered: 2026-02-24*
