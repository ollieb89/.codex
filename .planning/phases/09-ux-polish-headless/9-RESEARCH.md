# Phase 9 Research — UX Polish & Headless

**Gathered:** 2026-02-24  
**Confidence:** HIGH

## User Constraints
- Phase goal: polish selector readability and add headless preselection. Requirements: SEL-02 (truncation/alignment + color/no-color) and UX-01 (headless flag/env, logging, clean `0` exit).
- Truncation rule: display width `max(40, columns - 12)`. Only add `...` when over margin. Right-aligned gutter sized to largest index; wide Unicode must not break alignment (use width-aware measurement, e.g., `string-width`).
- Full label is not shown in menu; Phase 8 preview shows complete label/command when truncated.
- Headless selection: `--select` overrides `GS_DONE_SELECT`. `0` exits 0; out-of-range exits 1 and dumps the menu to stderr. Stderr logs the same menu as interactive plus `[Headless] Selected: N (Label)`; stdout reserved for action result. Compact list, no blank lines, no type tags. Honor `--no-color`/`NO_COLOR` by stripping ANSI.

## Stack Guidance
- Runtime: Node 20 (CJS). Use `process.stdout.columns` for width; clamp safely when undefined. `string-width` (or minimal width util) for Unicode-aware alignment.
- ANSI handling: rely on existing strip helper (if present) or minimal removal before width calc. When NO_COLOR, disable color library output and skip ANSI codes entirely for alignment calculations.
- Headless flag/env parsing likely belongs near selector/CLI entry; keep pure functions easy to unit-test (accept args/env injection).

## Patterns to Apply
- Gutter computation: determine max index digits (`String(entries.length).length`), build padded prefix (e.g., `padStart(maxDigits) + '. '`) to align labels.
- Truncation function should accept a width-aware length and return `{label, truncated}` so rendering can decide about ellipsis and headless audit strings.
- Logging: mirror interactive menu but write to stderr; keep stdout clean for command results to stay CI-friendly.

## Risks & Pitfalls
- `process.stdout.columns` undefined/non-tty: default to safe width (e.g., 80) before clamp.
- Misaligned ellipsis when width calc counts bytes not cells; ensure width-aware measurement before slicing.
- Double ANSI handling: stripping color after measuring can shift alignment; avoid adding color when measuring, or measure post-strip.
- Headless paths bypassing zero/invalid handling; ensure exit codes and stderr logging are covered by tests.

## Validation Ideas
- Unit tests for width-aware truncation with emoji/CJK to confirm gutter alignment.
- Headless tests: valid selection, zero exit path (code 0), invalid selection emits menu to stderr and exits 1, `--select` overrides env, NO_COLOR disables ANSI.
