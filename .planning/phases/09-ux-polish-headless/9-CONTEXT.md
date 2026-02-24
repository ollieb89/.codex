# Phase 9: UX Polish & Headless - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve readability of the numbered selector and add non-interactive (headless) flow. Focus on long/wide label handling, aligned numbering, color fallback, and preselected-number behavior for scripts/CI. No new actions or dispatcher changes—Phase 8 covers previews/confirmation logic.

</domain>

<decisions>
## Implementation Decisions

### Long/Wide Labels
- Truncate labels at `max(40, columns - 12)` to preserve a safe margin for numbering and suffix.
- Use a right-aligned gutter sized to the largest index so multi-digit numbers stay vertically aligned (e.g., ` 9.` vs `10.`).
- Compute display width with a width-aware approach (e.g., `string-width` or equivalent) so wide Unicode/emoji do not break alignment.
- Append `...` only when the label exceeds the margin; no extra tags. Full text surfaces in the Phase 8 preview, not in the menu.

### Non-interactive (Headless) Selection
- Flag precedence: `--select <number>` overrides `GS_DONE_SELECT` env.
- Selection `0` exits cleanly with code 0; out-of-range selection exits non-zero (exit 1) and dumps the menu to stderr for debugging.
- Headless run logs the menu to stderr in the same multi-line format as interactive; stdout is reserved for the action result.
- Audit echo: log `[Headless] Selected: N (Label)` to stderr for valid selections (index plus label).

### Readability & Theming
- Compact list: no blank lines between options to maximize on-screen density.
- No type tags in labels; keep labels plain to preserve horizontal space (action type shown in Phase 8 preview).
- Honor `--no-color` / `NO_COLOR` by stripping ANSI while keeping structure and alignment intact.

### Claude's Discretion
- Color palette for numbered output when color is enabled.
- Exact width-aware utility choice and minor formatting tweaks within these constraints.

</decisions>

<specifics>
## Specific Ideas

- Headless audit example: `[Headless] Selected: 2 (Refactor auth logic)` written to stderr alongside the menu dump.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-ux-polish-headless*
*Context gathered: 2026-02-24*
