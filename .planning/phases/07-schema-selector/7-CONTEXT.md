# Phase 7: Schema & Selector - Context

**Gathered:** 2026-02-24  
**Status:** Ready for planning

## Phase Boundary

Enforce numbered option schema and provide a selector that validates input and returns structured selections. Includes prompt schema enforcement, normalization (JSON → numbered text), 0-to-exit behavior, and the selector’s return contract. Does not cover dispatch safety or UX polish (later phases).

## Implementation Decisions

### Prompt schema & validation (SCH-01)
- Accept lines only if they match `^\d+\.\s+.+$`; response must contain at least one valid line. Strip filler/non-numbered lines and continue when ≥1 valid line remains; hard-fail only when zero valid lines.
- Sequential integrity: if numbers skip (1,2,4), silently re-index to 1..N when ≥2 options remain. If exactly 1 option after filtering/re-indexing, show it and ask a simple Y/n confirmation instead of a selection prompt.
- Retry budget: exactly one automatic retry on hard fail; if retry still lacks valid numbered lines, stop and surface an error (no infinite loops).
- Duplicates: any duplicate leading number triggers a hard fail and single retry with “ensure unique numbering” hint; do not guess which to keep.

### Selection payload contract (SEL-01)
- Selector result fields: required `id` (0-N), `label` (sanitized display), `value` (raw line), `actionable` (boolean). Optional `payload` (object) and `metadata` (object passthrough).
- Execution source of truth: if `payload.command` (or equivalent action payload) exists, dispatcher executes that; `label` is for display only.
- Actionability: if `actionable` is false, dispatcher prints label/no-op message and returns to main menu; no dry-run/exec attempted.
- 0-to-exit: entering 0 returns `{ id: 0, label: 'User Cancelled', actionable: false }` and dispatcher immediately exits the current branch.

### Claude's Discretion
- None called out; follow above contracts strictly.

## Specific Ideas

- If only one valid option remains after filtering, bypass selection UI and prompt Y/n to run it.

## Deferred Ideas

- Long/wide label truncation strategy (e.g., slice to terminal width with ellipsis) belongs to Phase 9 UX polish (SEL-02).
- Colorized numbering and headless logging behaviors are handled in later phases (Phase 9).

---

*Phase: 07-schema-selector*  
*Context gathered: 2026-02-24*
