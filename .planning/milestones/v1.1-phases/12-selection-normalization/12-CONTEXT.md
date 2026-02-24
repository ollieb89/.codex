# Phase 12: Selection Normalization - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-reindex AI-generated numbered lists to a clean 1..N sequence before any render or headless resolution, regardless of gaps, 0-indexing, or non-standard source numbering. Duplicate numbers are a hard error. The normalizer is internal plumbing — users see only clean output.

</domain>

<decisions>
## Implementation Decisions

### Normalization chokepoint
- Single chokepoint: one `normalizeOptions()` call produces clean 1..N entries consumed by both `selectOption()` (interactive) and `handleHeadless()`
- Caller normalizes first — `selectOption()` trusts its input is already 1..N, does not re-normalize internally
- Add a convenience `run(rawOutput, opts)` function in `index.js` that combines normalize + select for callers who want the full pipeline
- `run()` lives in `index.js` alongside `selectOption`, keeping the public API in one place

### Error messaging on bad input
- Duplicate number hint is technical and directive: "Duplicate numbered options detected. Re-generate the list with unique sequential numbers (1, 2, 3, ...)."
- Retry budget: 2 retries (3 total attempts) — fast failure, AI usually gets it on first retry
- Errors surface as thrown `NormalizationError` exceptions — callers catch and decide how to handle (retry, stderr, propagate). Consistent with existing pattern.
- Final exhaustion message is descriptive with context: "Selection failed: could not parse valid options after 3 attempts. Raw output was: [first 100 chars...]. This is usually an AI formatting issue — try running again."

### Edge case behavior
- 0-indexed lists (0, 1, 2): silently reindex to 1..N — treat like any gap. Common AI output, user never sees the difference.
- No hard limit on list size — normalizer handles any count. Terminal scrolling is the user's concern.
- Leading zeros accepted: '01.' treated the same as '1.' — strip leading zeros during parse, reindex. Permissive on input, strict on output.
- Markdown-wrapped numbers (e.g., '**1.** Option'): strip markdown before parsing. Extend existing `stripSimpleMarkdown()` to handle bold numbers and nested formatting.

### Claude's Discretion
- Exact regex patterns for leading zero and markdown stripping
- Internal structure of the retry loop (in `run()` vs caller)
- Test organization and fixture design
- Whether `stripSimpleMarkdown` needs a rewrite or just extension

</decisions>

<specifics>
## Specific Ideas

- Be permissive on input, strict on output — accept any reasonable AI formatting but always produce clean 1..N
- The `run()` convenience function should be the recommended import for most callers, with `normalizeOptions` and `selectOption` available for advanced use

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-selection-normalization*
*Context gathered: 2026-02-24*
