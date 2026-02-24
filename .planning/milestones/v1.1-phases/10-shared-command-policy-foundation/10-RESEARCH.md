# Phase 10: Shared Command Policy Foundation - Research

**Researched:** 2026-02-24
**Domain:** Node.js CommonJS module extraction / constant consolidation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Blocked command list**
- Current set confirmed: `sudo`, `chown`, `chmod`, `mkfs`, `dd`
- Edit-to-proceed flow preserved — blocked commands can be revised by the user, then re-sanitized
- Hardcoded only — not user-configurable via config files
- The ALLOWLIST (`git`, `node`, `npm`, `cat`, `ls`, etc.) also moves into the shared module alongside blocked/gray

**Gray command list**
- Current set confirmed: `git push`, `npm publish`, `pnpm publish`, `yarn publish`
- Matching changes from exact-string to **prefix-based** — `git push` catches `git push origin main`, `git push --force`, etc.
- `--force` flag is **consumed** by GSD (removed before passing command to shell) — avoids conflicts with commands that have their own `--force`
- Each gray command gets a **short reason string** explaining why it's gated (e.g., "Pushes to remote", "Publishes to registry") — displayed alongside the force prompt

**Destructive highlight terms**
- Current set confirmed: `rm`, `truncate`, `drop`, `overwrite`, `--force`, `-rf`
- Highlights are a **separate concern** from mutating — visual warning vs confirmation gating
- Word-boundary matching only (`\bterm\b`) — prevents false positives like `transform` matching `rm`
- Applied to **all command previews** regardless of command tier (allowed, gray, blocked edit flow)

**Mutating pattern scope**
- Current set confirmed: `rm`, `mv`, `cp`, `push`, `write`, `append`, `truncate`, `npm publish`, `git push`
- Two-tier approach preserved: explicit `mutating` flag from payload takes priority, regex pattern is the fallback
- Pattern matching switches to **word-boundary** (`\b`) — prevents false positives like `copyright` matching `cp` or `pushd` matching `push`
- **Gray gate takes precedence** when both gray and mutating apply to the same command — no double-gating (if `--force` was required and provided, skip the mutating confirm)

### Claude's Discretion
- Internal module structure (named exports, object grouping, etc.)
- How prefix-matching is implemented for gray commands
- How the short reason strings are associated with gray entries (map, object, etc.)
- Exact word-boundary regex construction for mutating pattern

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-03 | Shared `commands.js` constants module eliminates independent destructive/mutating term definitions across sanitize, preview, and dispatcher | Pure extraction pattern: move BLOCKED, ALLOWLIST, GRAY from sanitize.js; DESTRUCTIVE_TERMS from preview.js; and inline regex from index.js into a single commands.js — all three files import from it |
</phase_requirements>

## Summary

Phase 10 is a pure refactor with no new logic: extract all command-policy constants from three files into one `dispatcher/commands.js` module and update import sites. The codebase uses Node.js CommonJS (`require`/`module.exports`) throughout the dispatcher layer — no external packages are involved and no build tooling exists, so the change is entirely file-edit + require wiring.

The current state of the three files is well-understood. `sanitize.js` owns `BLOCKED`, `ALLOWLIST`, and `GRAY` (as Sets). `preview.js` owns `DESTRUCTIVE_TERMS` (an array). `index.js` holds an inline regex literal for mutating detection (`/rm|mv|cp|push|write|append|truncate|npm publish|git push/`). All three will import from the new shared module instead of defining their own constants. The CONTEXT.md introduces two behaviour changes alongside the extraction: gray matching moves from exact Set lookup to prefix matching, and both destructive-highlight and mutating-pattern matching adopt word-boundary regex. These behaviour changes are small but must be reflected in tests.

Eleven existing tests pass green and cover the constants in question. The success criterion "adding a new destructive term to `commands.js` is reflected without further edits" verifies the single-source-of-truth goal — the planner should include a spot-check task that adds a synthetic term, runs the tests, and then removes it.

**Primary recommendation:** Create `dispatcher/commands.js` as a pure CommonJS exports file with no dependencies, refactor three files to require from it, update sanitize.js gray lookup to use prefix matching, rebuild both regex patterns with word boundaries, and run the full 11-test suite after each wave.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Node.js built-in (v18+) | Test runner | Already in use across dispatcher `__tests__/` |
| `node:assert` | Node.js built-in | Assertions | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CommonJS `module.exports` | N/A | Export constants | All existing dispatcher files use CJS — stay consistent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Named exports via `module.exports = {}` | ES Module `export const` | ESM would require file extension changes and `"type":"module"` in package.json — breaks every existing `require()` call in the dispatcher layer; CJS is correct here |

**Installation:**
No new packages needed — zero external dependencies for this phase.

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/bin/lib/dispatcher/
├── commands.js        # NEW: single source of truth for all policy constants
├── sanitize.js        # imports from commands.js
├── preview.js         # imports from commands.js
├── index.js           # imports from commands.js
├── edit.js            # no constants — unchanged
└── __tests__/
    ├── sanitize.test.js    # existing — unchanged (tests behaviour, not internals)
    └── dispatcher.test.js  # existing — unchanged
```

### Pattern 1: Flat Named-Export Constants Module (CJS)

**What:** A single file that exports all policy constants as named properties of `module.exports`. No logic, no side effects — just data.

**When to use:** Whenever 2+ files share identical or logically related constant values.

**Example:**
```js
// dispatcher/commands.js
'use strict';

const BLOCKED_COMMANDS = new Set(['sudo', 'chown', 'chmod', 'mkfs', 'dd']);

const ALLOWLIST = new Set([
  'git', 'npm', 'yarn', 'pnpm', 'node',
  'mkdir', 'cp', 'mv', 'ls', 'cat', 'touch', 'echo', 'grep', 'rg',
]);

// Each gray entry: prefix string → reason string
const GRAY_COMMANDS = [
  { prefix: 'git push',      reason: 'Pushes to remote' },
  { prefix: 'npm publish',   reason: 'Publishes to registry' },
  { prefix: 'pnpm publish',  reason: 'Publishes to registry' },
  { prefix: 'yarn publish',  reason: 'Publishes to registry' },
];

const DESTRUCTIVE_HIGHLIGHT_TERMS = ['rm', 'truncate', 'drop', 'overwrite', '--force', '-rf'];

// Built once from the canonical term list; word-boundary prevents false positives
const MUTATING_TERMS = ['rm', 'mv', 'cp', 'push', 'write', 'append', 'truncate', 'npm publish', 'git push'];
const MUTATING_PATTERN = new RegExp(
  MUTATING_TERMS.map(t => `\\b${t.replace(/\s+/g, '\\s+')}\\b`).join('|'),
  'i',
);

module.exports = {
  BLOCKED_COMMANDS,
  ALLOWLIST,
  GRAY_COMMANDS,
  DESTRUCTIVE_HIGHLIGHT_TERMS,
  MUTATING_PATTERN,
};
```

### Pattern 2: Prefix-Based Gray Matching (replaces exact Set lookup)

**What:** Instead of `GRAY.has(cmd)` (requires exact 2-token match), check whether the command string starts with any gray prefix.

**When to use:** Commands like `git push origin main` have arguments beyond the base 2 tokens; the old Set lookup would miss them.

**Example:**
```js
// In sanitize.js — replaces the GRAY.has(cmd) check
const { GRAY_COMMANDS } = require('./commands');

function matchGray(command) {
  const lower = command.trim().toLowerCase();
  return GRAY_COMMANDS.find(g => lower === g.prefix || lower.startsWith(g.prefix + ' '));
}

// Usage in sanitizeAction:
const grayMatch = matchGray(action.command || '');
if (grayMatch) {
  result.status = opts.force ? 'allow' : 'force';
  result.reason = opts.force ? '' : grayMatch.reason;
  return result;
}
```

### Pattern 3: Word-Boundary Regex for Destructive Highlighting

**What:** Escape each term and wrap in `\b` anchors before building the regex, then replace in `highlightDestructive`.

**When to use:** Any time a term list is used for substring matching inside a shell command preview — word boundaries prevent `transform` matching `rm`, `copyright` matching `cp`, etc.

**Example:**
```js
// In preview.js — replaces the current bare regex
const { DESTRUCTIVE_HIGHLIGHT_TERMS } = require('./commands');

function buildHighlightPattern(terms) {
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

const HIGHLIGHT_RE = buildHighlightPattern(DESTRUCTIVE_HIGHLIGHT_TERMS);

function highlightDestructive(command) {
  if (!command) return '';
  return colors.dim(command.replace(HIGHLIGHT_RE, m => colors.redBold(m)));
}
```

### Pattern 4: `--force` Stripping Before Shell Execution (locked decision)

**What:** When the gray gate passes (`opts.force === true`), remove any `--force` flag from the sanitized command before handing it to the runner.

**When to use:** Prevents double-`--force` conflicts when the underlying tool (e.g., `git push --force`) has its own semantics.

**Example:**
```js
// In sanitize.js — strip GSD's --force flag after gray gate passes
if (grayMatch && opts.force) {
  result.sanitizedCommand = (redaction.redacted || '')
    .replace(/\s+--force\b/g, '')
    .trim();
  result.status = 'allow';
  return result;
}
```

### Anti-Patterns to Avoid

- **Importing commands.js inside a Set or RegExp literal at module load time without memoisation:** If the import is cheap and side-effect-free (it is), this is fine — but do not `require('./commands')` inside a hot function that rebuilds the pattern on every call.
- **Using `new RegExp(term)` without escaping special characters:** `--force` contains `-` which is benign in most regex contexts, but `\b` + `.` or `+` in terms will silently misbehave. Always escape before inserting into a regex.
- **Switching from `Set` to array for BLOCKED/ALLOWLIST:** Both are O(1) average for lookup with Set; converting to array for "simplicity" degrades to O(n) lookup in sanitize.js's hot path. Keep Sets.
- **Changing GRAY from Set to array and forgetting to update the old `GRAY.has()` call in sanitize.js:** The exact-string Set lookup must be removed and replaced with `matchGray()`. Leaving the old call behind will cause gray commands to fall through to `allow`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Regex special-char escaping | Custom escape function | `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` | This is the MDN-canonical pattern; custom escaping misses edge cases |
| Multi-token regex for phrases like `npm publish` | Space literal in pattern | `\\s+` between tokens | Handles tabs and multiple spaces in pasted commands |

**Key insight:** The entire phase is pure extraction — the only "new" logic is prefix matching for gray commands and word-boundary wrapping for regex patterns, both of which are 1–3 line changes per site.

## Common Pitfalls

### Pitfall 1: Stale Local Binding After Extraction

**What goes wrong:** A file keeps a local `const GRAY = new Set(...)` after the `require('./commands')` line is added, shadowing the imported constant. Tests may still pass because the shadow has the same values, but the shared module is never actually used.

**Why it happens:** Editor auto-complete or inattention leaves the old declaration in place.

**How to avoid:** Search-and-remove all old local constant declarations (`BLOCKED`, `ALLOWLIST`, `GRAY`, `DESTRUCTIVE_TERMS`) from each file after adding the import.

**Warning signs:** File has both `const GRAY_COMMANDS = require('./commands').GRAY_COMMANDS` and `const GRAY = new Set([...])` — grep for duplicates before closing a task.

### Pitfall 2: Breaking the Old GRAY Set Lookup Without Updating the Call Site

**What goes wrong:** `GRAY` is removed from sanitize.js but the `if (cmd && GRAY.has(cmd))` check is not replaced with `matchGray()`. This throws `ReferenceError: GRAY is not defined` at runtime.

**Why it happens:** The extraction wave touches commands.js but forgets to update the logic in sanitize.js.

**How to avoid:** Treat "remove old constant" and "replace the usage" as a single atomic task, not two separate tasks.

**Warning signs:** Test `flags gray-area command without force` fails with ReferenceError.

### Pitfall 3: `\b` Doesn't Work as Expected at String Boundaries

**What goes wrong:** `\brm\b` fails to match `rm -rf` at the start of a command string if the command has a leading space, because `\b` is a zero-width boundary between word/non-word characters. Leading whitespace is non-word, so `\b` still fires correctly — but `\b--force\b` can behave unexpectedly because `-` is a non-word character. The leading `\b` before `--force` would match any position before a `-`.

**Why it happens:** Mixing word-char and non-word-char terms in the same word-boundary pattern.

**How to avoid:** For terms that start or end with `-` (like `--force`, `-rf`), test the regex explicitly. An alternative is to use `(?<![a-zA-Z0-9])` lookbehind instead of `\b` for such terms. The CONTEXT.md decision is word-boundary matching only — verify edge cases in the test suite.

**Warning signs:** `highlightDestructive('--force-push')` highlights unexpectedly, or `transform` no longer false-positives but `--force-with-lease` is partially highlighted.

### Pitfall 4: Gray Prefix Collision

**What goes wrong:** `git push` prefix matches `git push-mirror` (a hypothetical alias) because `startsWith('git push')` is true for both.

**Why it happens:** Prefix matching without a trailing-space or end-of-string guard.

**How to avoid:** The matchGray check in Pattern 2 uses `lower === g.prefix || lower.startsWith(g.prefix + ' ')` — the space suffix prevents false prefix collisions. This is the correct form.

**Warning signs:** A command like `git push-mirror` gets flagged as gray — add a test for it.

### Pitfall 5: Double-Gating (Gray + Mutating)

**What goes wrong:** A `git push` command triggers both the gray gate (force-dispatch required) and the mutating gate (y/N confirm), resulting in two confirmation prompts.

**Why it happens:** The mutating regex also matches `push` — and after the gray gate passes, index.js still evaluates the mutating pattern.

**How to avoid:** CONTEXT.md decision: "Gray gate takes precedence — if `--force` was required and provided, skip the mutating confirm." In index.js, track whether gray gate was satisfied and skip the mutating confirm in that case.

**Warning signs:** Test `prompts for mutating confirm` passes but a manual run of `git push` with `--force` flag prompts twice.

## Code Examples

Verified patterns from the actual codebase:

### Existing sanitize.js gray check (current — to be replaced)
```js
// Source: get-shit-done/bin/lib/dispatcher/sanitize.js line 109
if (cmd && GRAY.has(cmd)) {
  result.status = opts.force ? 'allow' : 'force';
  result.reason = opts.force ? '' : 'Force dispatch required';
  return result;
}
```

### Existing preview.js destructive highlight (current — to be updated)
```js
// Source: get-shit-done/bin/lib/dispatcher/preview.js lines 9-18
const DESTRUCTIVE_TERMS = ['rm', 'truncate', 'drop', 'overwrite', '--force', '-rf'];

function highlightDestructive(command) {
  if (!command) return '';
  let out = command;
  for (const term of DESTRUCTIVE_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, 'gi');
    out = out.replace(re, (m) => colors.redBold(m));
  }
  return colors.dim(out);
}
```

### Existing index.js mutating pattern (current — to be replaced)
```js
// Source: get-shit-done/bin/lib/dispatcher/index.js line 78
const mutating = action.mutating !== undefined
  ? action.mutating
  : /rm|mv|cp|push|write|append|truncate|npm publish|git push/.test(action.command);
```

### After extraction: import pattern for each consumer
```js
// sanitize.js
const { BLOCKED_COMMANDS, ALLOWLIST, GRAY_COMMANDS } = require('./commands');

// preview.js
const { DESTRUCTIVE_HIGHLIGHT_TERMS } = require('./commands');

// index.js
const { MUTATING_PATTERN } = require('./commands');
```

### Spot-check test for single-source-of-truth (success criterion #3)
```js
// Planner can include this as a transient verification step (not a permanent test):
// 1. Add 'wipe' to DESTRUCTIVE_HIGHLIGHT_TERMS in commands.js
// 2. Run: node --test get-shit-done/bin/lib/dispatcher/__tests__/
// 3. Verify highlightDestructive('wipe /tmp') returns highlighted output
// 4. Revert 'wipe' addition
// This confirms all three consumers read from the shared module.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `const GRAY = new Set([...])` in sanitize.js | `GRAY_COMMANDS` array in commands.js with prefix + reason | Phase 10 | Gray commands now match with arguments; reason string displayed to user |
| Inline `const DESTRUCTIVE_TERMS = [...]` in preview.js | `DESTRUCTIVE_HIGHLIGHT_TERMS` in commands.js | Phase 10 | Adding a term in one place updates both highlight and (separately) mutating gate |
| Inline regex literal in index.js | `MUTATING_PATTERN` constant in commands.js | Phase 10 | Regex rebuilt once at module load; word-boundary prevents false positives |

**Deprecated/outdated after this phase:**
- Local `BLOCKED`, `ALLOWLIST`, `GRAY` declarations in sanitize.js: removed
- Local `DESTRUCTIVE_TERMS` declaration in preview.js: removed
- Inline regex `/rm|mv|cp|.../` in index.js: removed

## Open Questions

1. **Should `--force` stripping live in sanitize.js or index.js?**
   - What we know: sanitize.js owns the gray gate and returns `sanitizedCommand`; index.js consumes `sanitizedCommand`
   - What's unclear: the CONTEXT.md says `--force` is "consumed by GSD (removed before passing command to shell)" — this most naturally belongs in sanitize.js where `sanitizedCommand` is built
   - Recommendation: Implement stripping in sanitize.js inside the gray-gate branch so `sanitizedCommand` is always shell-safe when returned

2. **Does `\b` work correctly for `--force` and `-rf`?**
   - What we know: `-` is a non-word character in JS regex, so `\b--force\b` matches the boundary between a word char and `-` at the start — this may produce unexpected matches at word-adjacent positions
   - What's unclear: whether current tests cover edge cases like `--force-with-lease` or `-rfc`
   - Recommendation: Add targeted tests for these terms during the phase; if `\b` is inadequate, use `(?:^|\s)--force(?=\s|$)` style guards instead — but decide before building the pattern

## Sources

### Primary (HIGH confidence)
- Direct source read: `get-shit-done/bin/lib/dispatcher/sanitize.js` — BLOCKED, ALLOWLIST, GRAY constants; exact Set lookup logic
- Direct source read: `get-shit-done/bin/lib/dispatcher/preview.js` — DESTRUCTIVE_TERMS array; per-term regex loop
- Direct source read: `get-shit-done/bin/lib/dispatcher/index.js` — inline mutating regex; gray/mutating interaction
- Direct source read: `get-shit-done/bin/lib/dispatcher/__tests__/sanitize.test.js` — 7 tests covering blocked/gray/allow behaviour
- Direct source read: `get-shit-done/bin/lib/dispatcher/__tests__/dispatcher.test.js` — 4 tests covering dispatch flow
- Test run: `node --test` — all 11 tests pass green (confirmed 2026-02-24)
- Direct source read: `.planning/phases/10-shared-command-policy-foundation/10-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- MDN `String.prototype.replace` with regex — word-boundary escaping pattern `[.*+?^${}()|[\]\\]` is canonical

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are Node.js built-ins already in use
- Architecture: HIGH — source files read directly, all constants located and catalogued
- Pitfalls: HIGH — derived from actual code inspection and the specific behaviour changes in CONTEXT.md
- Behaviour changes (prefix matching, word-boundary): MEDIUM — logic is straightforward but the `\b` + non-word-char edge case warrants test coverage before closing the phase

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable — no external dependencies)
