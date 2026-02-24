# Phase 7 Research — Schema & Selector

**Gathered:** 2026-02-24  
**Confidence:** HIGH

## User Constraints
- Accept lines only if they match `^\d+\.\s+.+$`; strip filler/non-numbered lines when ≥1 valid line remains; hard-fail only when zero valid lines.
- Sequential gaps (1,2,4) silently re-index to 1..N when ≥2 options remain; if exactly 1 option remains, show it and prompt Y/n instead of selection UI.
- Retry budget: one automatic retry on hard fail; if retry still lacks valid numbered lines, stop and error (no loops).
- Duplicates: any duplicate leading number triggers hard fail + single retry with “ensure unique numbering”; never guess.
- Selector result fields (required): `id` (0-N), `label` (sanitized display), `value` (raw line), `actionable` (boolean). Optional: `payload` (object), `metadata` (object).
- Execution source of truth: `payload.command` (or equivalent) drives execution when present; `label` is display-only.
- `actionable=false` → dispatcher prints label/no-op and returns; no dry-run/exec.
- `0` input → `{ id: 0, label: 'User Cancelled', actionable: false }` and dispatcher exits current branch.
- Deferred to later phases: long/wide label truncation, colorized numbering, headless logging.

## Standard Stack
- Runtime: Node 20 (CJS). Use `readline` for input; no heavy TUI libs.  
- Parsing helpers: `strip-ansi@7` (optional) to clean AI output; light markdown strip (remove `*`, `-`, backticks) before regex.  
- Validation: `zod@3` optional if consuming JSON payloads; otherwise keep plain regex/guards.  
- Testing: `node --test` for parser/selector unit checks.

## Architecture Patterns
- Schema-first: enforce + validate prompt output before selector logic.  
- Dual-path normalization: attempt JSON parse (array of strings/objects) → fallback to numbered text parsing.  
- Explicit mapping: displayed number → internal index → SelectionResult; never rely on array index without mapping.  
- Single-option fast path: when only one valid option, present Y/n confirm instead of list.  
- Cancel path: `0` is always exit; ensure displayed list includes “0: Cancel/Back”.

## Don't Hand-Roll
- Do not build custom TUI frameworks; stay with readline + minimal formatting.  
- Do not implement rich markdown/HTML rendering; enforce plain text numbered schema.

## Common Pitfalls
- Conversational filler causing empty parse → ensure regex filter + retry once.  
- Duplicate numbers slipping through → detect duplicates early and retry with hint.  
- Off-by-one / zero mishandling → map displayed numbers explicitly; treat `0` as cancel.  
- Malformed JSON payloads → guard with try/catch, optional zod schema; fall back to text mode gracefully.  
- ANSI/markdown noise breaking regex → strip ANSI and simple markdown before matching.

## Code Examples

**Regex parse (numbered lines):**
```js
const lines = output.split(/\r?\n/);
const entries = lines
  .map(l => l.trim())
  .filter(l => /^\d+\.\s+.+$/.test(l))
  .map(l => {
    const [num, ...rest] = l.split('.');
    return { num: Number(num), text: rest.join('.').trim() };
  });
```

**SelectionResult shape:**
```ts
type SelectionResult = {
  id: number;           // 0 = exit, 1-N selection
  label: string;        // sanitized display
  value: string;        // raw line text
  actionable: boolean;  // false => dispatcher no-op
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
```

**Single-option fast path:**
```js
if (entries.length === 1) {
  const only = entries[0];
  // prompt "Run: {only.text}? (Y/n)" → map to SelectionResult {id:1,...}
}
```

**Retry guard:**
```js
if (!entries.length) {
  if (attempt === 1) return retryWithHint("Return a numbered list only.");
  throw new Error("Could not parse numbered options after retry.");
}
```

## Notes for Planner
- Ensure tasks cover schema enforcement, normalization (JSON + text), retry strategy, duplicate detection, re-indexing, and selection result contract.  
- Wide-label truncation and color are out of scope for this phase; note as follow-up to Phase 9.
