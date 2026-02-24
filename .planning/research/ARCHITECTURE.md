# Architecture Research

**Domain:** CLI selection and security enhancements for AI-assisted workflows (v1.1)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Standard Architecture

### System Overview — v1.0 Baseline (Shipped)

The following components are fully implemented and passing tests after v1.0:

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Prompts / Agents Layer                      │
│  Markdown/TOML prompts enforce numbered schema in AI output          │
│  (no dedicated normalizer module yet — gap identified for v1.1)      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ numbered entries [{id,label,value,payload}]
┌──────────────────────────▼───────────────────────────────────────────┐
│                    selector/index.js  (selectOption)                  │
│  • Renders numbered list via format.js helpers                        │
│  • Headless shortcut via headless.js                                 │
│  • readline loop with 0-to-exit and out-of-range retry               │
│  • Returns picked entry (or {id:0, actionable:false} for cancel)     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ selected entry
┌──────────────────────────▼───────────────────────────────────────────┐
│                   dispatcher/index.js  (dispatchSelection)            │
│  • Unpacks payload, builds action struct                             │
│  • sanitizeAction() — workspace boundary + allowlist/blocklist       │
│  • renderPreview() — highlights destructive terms, mini-diff, meta   │
│  • editCommand() — inline readline or $EDITOR on block               │
│  • confirm() gate for mutating actions                               │
│  • defaultRunner via child_process.exec                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Sub-module Breakdown

```
get-shit-done/bin/lib/
├── selector/
│   ├── index.js          # selectOption() — public entry point
│   ├── format.js         # stripAnsi, stringWidth, truncateLabel, formatMenuItem
│   ├── headless.js       # handleHeadless() — --select flag / GS_DONE_SELECT env
│   └── __tests__/
│       ├── selector.test.js
│       ├── format.test.js
│       └── headless.test.js
└── dispatcher/
    ├── index.js          # dispatchSelection() — public entry point
    ├── sanitize.js       # sanitizeAction(), redactSecrets(), workspace checks
    ├── preview.js        # renderPreview(), highlightDestructive(), confirm()
    ├── edit.js           # editCommand() — inline edit or $EDITOR on block
    └── __tests__/
        ├── dispatcher.test.js
        └── sanitize.test.js
```

### Component Responsibilities

| Component | Responsibility | v1.0 Status |
|-----------|---------------|-------------|
| `selector/format.js` | ANSI stripping, Unicode-aware width, truncation, menu item formatting | COMPLETE |
| `selector/headless.js` | `--select`/`GS_DONE_SELECT` preselection, audit logging to stderr | COMPLETE |
| `selector/index.js` | Entry point: headless shortcut, TTY render loop, 0-to-exit | COMPLETE |
| `dispatcher/sanitize.js` | Workspace boundary, allowlist/blocklist, gray-area gate, secret redaction | COMPLETE (gaps identified) |
| `dispatcher/preview.js` | Destructive term highlighting, mini-diff, metadata toast | COMPLETE (gaps identified) |
| `dispatcher/edit.js` | Inline readline edit or `$EDITOR` on blocked command | COMPLETE |
| `dispatcher/index.js` | Orchestrates sanitize → preview → confirm → run pipeline | COMPLETE |
| Normalizer (standalone) | Re-index skipped/duplicate AI-numbered output to 1..N | **MISSING — v1.1 gap** |

---

## v1.1 Integration Analysis

### What v1.1 Changes

v1.1 adds four feature areas. Each maps to modifications or new components in the existing structure.

#### 1. Auto-Reindexing (Normalizer Gap)

**Current state:** `selectOption` accepts pre-built `entries[]` and uses `entries.find(e => e.id === num)` for lookup. The contract assumes caller-supplied IDs are already sequential. No module normalizes raw AI output into sequentially indexed entries.

**Gap:** When AI output skips numbers (e.g., 1, 2, 4) or has duplicates, callers must handle re-indexing themselves. Phase 7 context decision mandates silent re-index when numbers skip and ≥2 options remain, and hard-fail + single retry on duplicate leading numbers.

**Where this lives:** A new `selector/normalizer.js` module. It sits between the Prompts layer and `selectOption`, transforming raw AI text lines into a validated, sequentially indexed `entries[]` array.

**Integration point with index.js:** `selectOption` does NOT need to change. The normalizer produces clean `entries[]` before calling `selectOption`. Callers who previously passed raw AI lines must route through the normalizer first.

```
AI text output
    │
    ▼
selector/normalizer.js  (NEW for v1.1)
    • Accept raw numbered lines (string[]) or parsed JSON
    • Filter: keep only lines matching /^\d+\.\s+.+$/
    • Re-index silently if numbers skip (≥2 valid lines)
    • Hard-fail + single retry hint if duplicates detected
    • Return: [{id:1, label, value, actionable, payload?, metadata?}]
    │
    ▼
selectOption(entries)   (unchanged)
```

**New file:** `get-shit-done/bin/lib/selector/normalizer.js`
**Modified files:** None in selector — callers update to invoke normalizer first.

---

#### 2. Enhanced Secret Patterns

**Current state:** `sanitize.js` `redactSecrets()` handles:
```javascript
/\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET))=([^\s]+)/g
```

This covers `SERVICE_API_KEY=...`, `AUTH_TOKEN=...`, `APP_SECRET=...` but misses:
- `PASSWORD=`, `PASSWD=`, `DB_PASS=`
- `PRIVATE_KEY=`, `RSA_KEY=`
- `CONNECTION_STRING=`, `DATABASE_URL=`, `REDIS_URL=`
- Lowercase variants: `api_key=`, `token=`
- Values after `Bearer ` or `-H "Authorization: `
- Values embedded in URLs: `postgres://user:password@host`

**Where this lives:** Modify `dispatcher/sanitize.js` `redactSecrets()` only. No structural change.

**Change type:** Expand regex patterns in the existing function. Extract patterns to a named constant `SECRET_PATTERNS` array for testability.

**Integration point:** `redactSecrets` is called in `sanitizeAction()` before preview. No callers change — the interface (`{redacted, replacements}`) stays the same.

**Suggested pattern expansion:**
```javascript
// In sanitize.js — expanded SECRET_PATTERNS constant
const SECRET_PATTERNS = [
  // KEY=value assignments (existing + expanded)
  /\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|PRIVATE_KEY|AUTH|CREDENTIAL|CERT|CONNECTION_STRING))=([^\s'"]+)/gi,
  // Bearer tokens in headers
  /(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/g,
  // Authorization header values
  /(Authorization:\s*(?:Basic|Bearer|Token)\s+)([^\s'"]+)/gi,
  // Credentials in URLs (postgres://user:pass@host)
  /((?:postgres|mysql|mongodb|redis|amqp):\/\/[^:]+:)([^@\s]+)(@)/g,
];
```

**Modified files:** `dispatcher/sanitize.js`, `dispatcher/__tests__/sanitize.test.js`

---

#### 3. Destructive Command Detection

**Current state:** Two separate concerns with inconsistent coverage:

- `preview.js` `DESTRUCTIVE_TERMS`: `['rm', 'truncate', 'drop', 'overwrite', '--force', '-rf']` — visual highlighting only
- `sanitize.js` `BLOCKED`: `Set(['sudo', 'chown', 'chmod', 'mkfs', 'dd'])` — execution blocking
- `sanitize.js` `GRAY`: `Set(['git push', 'npm publish', ...])` — force-dispatch gate

The two modules have overlapping but inconsistent views of "destructive". `preview.js` highlights `rm` and `--force` but `sanitize.js` allows `rm` (it's not in BLOCKED). The confirmation heuristic in `dispatcher/index.js` also does its own regex:
```javascript
/rm|mv|cp|push|write|append|truncate|npm publish|git push/.test(action.command)
```

**Gap:** Three places define "destructive" independently. They must be consolidated into a single source of truth.

**Where this lives:** Extract a shared `dispatcher/commands.js` constants module that all three callers import. No structural change beyond adding the shared module.

**New file:** `get-shit-done/bin/lib/dispatcher/commands.js`

```javascript
// dispatcher/commands.js — single source of truth for command policies
const BLOCKED_COMMANDS = new Set(['sudo', 'chown', 'chmod', 'mkfs', 'dd', 'curl | bash', 'wget | sh']);
const GRAY_COMMANDS = new Set(['git push', 'npm publish', 'pnpm publish', 'yarn publish']);
const DESTRUCTIVE_HIGHLIGHT_TERMS = ['rm', 'truncate', 'drop', 'overwrite', '--force', '-rf', '-f', 'delete', 'purge', 'wipe'];
const MUTATING_PATTERN = /\b(rm|mv|cp|push|write|append|truncate|delete|purge|wipe)\b|npm publish|git push/i;

module.exports = { BLOCKED_COMMANDS, GRAY_COMMANDS, DESTRUCTIVE_HIGHLIGHT_TERMS, MUTATING_PATTERN };
```

**Modified files:**
- `dispatcher/sanitize.js` — replace inline sets with imports from `commands.js`
- `dispatcher/preview.js` — replace `DESTRUCTIVE_TERMS` array with import from `commands.js`
- `dispatcher/index.js` — replace inline `mutating` regex with `MUTATING_PATTERN` import

---

#### 4. --select Flag Standardization

**Current state:** `headless.js` already implements `--select <N>` and `--select=N` formats with `GS_DONE_SELECT` fallback. Implementation is complete and tested.

**Gap (if any):** The `--select` arg detection reads from `opts.args || process.argv` — callers that construct custom args arrays must pass them explicitly. Any callers that directly invoke `selectOption` without passing `opts.args` will use `process.argv` correctly only if they are top-level scripts. Nested or piped invocations may behave unexpectedly.

**Where this lives:** No new module needed. Document the calling contract clearly:
- Callers must pass `opts.args = process.argv` (or a test-controlled args array) to `selectOption`.
- The env fallback `GS_DONE_SELECT` should be sourced from `opts.env = process.env` (already wired).

**Possible refinement:** Add a `--select` parse utility to `selector/headless.js` that can be called standalone for callers who manage their own flag parsing, enabling composition without requiring `selectOption` to own arg parsing.

**Modified files:** Minimal — possibly `selector/headless.js` to export a `parseSelectFlag(args, env)` helper for standalone use. `selector/index.js` unchanged.

---

#### 5. Unicode-Aware Padding

**Current state:** `format.js` `formatMenuItem` right-aligns the ID number using `String(id).padStart(maxDigits, ' ')` — this is correct since IDs are always ASCII digits. The label truncation uses `stringWidth` correctly. However, padding after truncation for visual column alignment is not applied — the function returns `prefix + truncatedLabel` with no right-padding to a fixed column width.

**Gap:** When rendering a list where labels have varying visual widths (mix of ASCII and CJK), there is no right-padding to align suffixes (e.g., type tags or status icons if added in future). Current truncation ensures labels do NOT exceed maxWidth, but no padding fills the space to the right.

**Where this lives:** Modify `format.js` `formatMenuItem` only, or add an optional `padToWidth` parameter.

**Change type:** Add a `padLabel(str, targetWidth)` helper in `format.js` that pads using `stringWidth` to account for double-wide characters:

```javascript
// format.js addition
function padLabel(str, targetWidth) {
  const current = stringWidth(str);
  const needed = Math.max(0, targetWidth - current);
  return str + ' '.repeat(needed);
}
```

`formatMenuItem` gains an optional `padToWidth` flag. When false (default), behavior is unchanged. When true, the label is padded to fill `availableWidth` after truncation.

**Modified files:** `selector/format.js`, `selector/__tests__/format.test.js`

---

## Complete v1.1 Change Map

### New Files

| File | Purpose | Depends On |
|------|---------|------------|
| `selector/normalizer.js` | Re-index AI output → sequential entries[] | `selector/format.js` (stripAnsi for validation) |
| `dispatcher/commands.js` | Shared constants: BLOCKED, GRAY, DESTRUCTIVE_TERMS, MUTATING_PATTERN | None |

### Modified Files

| File | Changes | Touches |
|------|---------|---------|
| `dispatcher/sanitize.js` | Import BLOCKED/GRAY from commands.js; expand `redactSecrets` patterns | `commands.js` |
| `dispatcher/preview.js` | Import DESTRUCTIVE_TERMS from commands.js | `commands.js` |
| `dispatcher/index.js` | Import MUTATING_PATTERN from commands.js; replace inline regex | `commands.js` |
| `selector/format.js` | Add `padLabel()` helper; optional `padToWidth` to `formatMenuItem` | None |
| `selector/headless.js` | Optionally export standalone `parseSelectFlag(args, env)` | None |

### Unchanged Files

| File | Reason Stable |
|------|--------------|
| `selector/index.js` | `selectOption` contract unchanged; normalizer sits above it |
| `dispatcher/edit.js` | No changes in scope |

---

## Data Flow — v1.1 Updated

### Interactive Path

```
AI text output (numbered lines)
    │
    ▼
selector/normalizer.js          [NEW]
    • Validate /^\d+\.\s+.+$/ lines
    • Re-index skipped numbers → 1..N
    • Hard-fail + retry hint on duplicates
    │
    ▼
selectOption(entries, opts)     [unchanged]
    • Headless shortcut (headless.js)
    • format.js → formatMenuItem with Unicode-aware width
    │
    ▼
dispatchSelection(selection)    [modified — imports from commands.js]
    │
    ├──► sanitizeAction()       [modified — expanded secrets, shared constants]
    │       • Workspace boundary check
    │       • BLOCKED / GRAY from commands.js
    │       • redactSecrets() — expanded patterns
    │
    ├──► renderPreview()        [modified — DESTRUCTIVE_TERMS from commands.js]
    │       • highlightDestructive() uses shared terms
    │       • mini-diff if payload.diff exists
    │
    └──► runner(action)
```

### Headless Path

```
--select N  or  GS_DONE_SELECT=N
    │
    ▼
handleHeadless(entries, args, env)    [unchanged; optional parseSelectFlag export]
    • Menu dumped to stderr
    • Audit log: "[Headless] Selected: N (Label)"
    • Valid → {exitCode:0, result: entry}
    • Invalid → {exitCode:1}
    │
    ▼
dispatchSelection(selection)          [same flow as interactive above]
```

---

## Component Boundary Rules

These boundaries must not be violated during v1.1 implementation:

| Boundary | Rule |
|----------|------|
| `selector/` ↔ `dispatcher/` | Selector knows nothing about dispatch. The only data crossing is the entry struct: `{id, label, value, actionable, payload?, metadata?}`. |
| `normalizer.js` scope | Normalizer converts raw text → clean entries[]. It does NOT validate payload content or action safety — that is dispatcher's job. |
| `commands.js` scope | Constants only. No logic, no imports. Both dispatcher sub-modules import from it; nothing else does. |
| `sanitize.js` redaction | `redactSecrets()` returns `{redacted, replacements}`. The `replacements` array preserves originals for execution. The caller (`dispatchSelection`) passes `sanitized.sanitizedCommand` (redacted) to `renderPreview` and the original `action.command` to `runner`. This must not change. |
| `format.js` width logic | `stringWidth` is the single source of truth for visual width. Any padding/truncation must use it, never `.length`. |

---

## Architectural Patterns

### Pattern 1: Shared Constants Module (commands.js)

**What:** Extract co-located but inconsistently duplicated constants (command sets, regex patterns) into a single-purpose constants module imported by all consumers.

**When to use:** When the same conceptual list (e.g., "destructive verbs") appears in multiple modules and drift between them would cause inconsistent behavior.

**Trade-offs:** Adds one more require() per module. For a CJS codebase of this size, that is negligible. The benefit is that updating `DESTRUCTIVE_HIGHLIGHT_TERMS` in one place propagates to both preview highlighting and confirmation gating.

**Example:**
```javascript
// dispatcher/commands.js
const BLOCKED_COMMANDS = new Set(['sudo', 'chown', 'chmod', 'mkfs', 'dd']);
const DESTRUCTIVE_HIGHLIGHT_TERMS = ['rm', 'truncate', '--force', '-rf', 'drop', 'delete'];
module.exports = { BLOCKED_COMMANDS, DESTRUCTIVE_HIGHLIGHT_TERMS };

// dispatcher/sanitize.js
const { BLOCKED_COMMANDS } = require('./commands');

// dispatcher/preview.js
const { DESTRUCTIVE_HIGHLIGHT_TERMS } = require('./commands');
```

### Pattern 2: Above-the-selector Normalization

**What:** Keep the selector itself dumb about AI output format. All normalization (re-indexing, filtering, retry logic) happens in a module that sits between the AI output and `selectOption`.

**When to use:** Any time input quality is variable (AI-generated numbered lists).

**Trade-offs:** Adds an explicit caller step (`normalizer.normalize(rawLines)` before `selectOption`). Makes both modules independently testable. The selector's tests never need to model bad AI output.

**Example:**
```javascript
// Caller code
const { normalize } = require('./selector/normalizer');
const { selectOption } = require('./selector');

const entries = normalize(agentOutput); // may throw on unrecoverable input
const selection = await selectOption(entries, opts);
```

### Pattern 3: Redact-for-Display, Execute-Original

**What:** The sanitizer produces two versions of the command: `sanitizedCommand` (with secrets redacted) for display in preview, and the original `action.command` for actual execution. These must never be swapped.

**When to use:** Everywhere secrets may appear in shell commands (API keys, tokens, URLs with credentials).

**Trade-offs:** Requires callers to track which version is for display and which for execution. The current `dispatchSelection` gets this right: `renderPreview` receives `sanitized.sanitizedCommand`; `runner` receives `action.command`. This must be preserved when dispatcher/index.js is modified.

---

## Suggested Build Order

Dependencies between the v1.1 changes determine the correct sequence:

```
1. dispatcher/commands.js          [no deps — start here]
       │
       ├──► 2. dispatcher/sanitize.js   [imports commands.js; expand secret patterns]
       │         └──► dispatcher/__tests__/sanitize.test.js   [update tests]
       │
       ├──► 3. dispatcher/preview.js    [imports commands.js; no logic change]
       │
       └──► 4. dispatcher/index.js      [imports commands.js MUTATING_PATTERN]
                    └──► dispatcher/__tests__/dispatcher.test.js  [update if needed]

5. selector/format.js              [add padLabel; independent of dispatcher]
       └──► selector/__tests__/format.test.js   [update tests]

6. selector/normalizer.js          [depends on format.js for stripAnsi; independent of dispatcher]
       └──► selector/__tests__/normalizer.test.js   [new test file]

7. selector/headless.js (optional) [standalone parseSelectFlag export if needed]
```

**Rationale for this order:**
- `commands.js` first because it has no dependencies and unblocks 3 dispatcher modifications in parallel.
- Dispatcher changes (steps 2–4) can proceed independently of selector changes (steps 5–6) after step 1.
- `normalizer.js` (step 6) last among selector changes because it depends only on `format.js` being stable.
- `headless.js` (step 7) is optional and deferred; existing implementation is already correct.

---

## Anti-Patterns

### Anti-Pattern 1: Duplicating Command Lists

**What people do:** Add a new destructive term to `preview.js`'s `DESTRUCTIVE_TERMS` but forget to update the `mutating` regex in `dispatcher/index.js`.

**Why it's wrong:** The system highlights the command as dangerous but does not prompt for confirmation — false security.

**Do this instead:** All destructive/mutating term definitions live in `commands.js`. Every module that needs them imports from there.

### Anti-Pattern 2: Passing Redacted Command to Runner

**What people do:** Pass `sanitized.sanitizedCommand` (which has `[REDACTED]` placeholders) to `runner()` instead of the original `action.command`.

**Why it's wrong:** The command will fail because `[REDACTED]` is not a valid argument value.

**Do this instead:** `renderPreview` gets `sanitized.sanitizedCommand`; `runner` gets `action.command`. The test in `dispatcher/index.js` line 95 already does this correctly — preserve it.

### Anti-Pattern 3: Putting Normalization Logic in selectOption

**What people do:** Add retry / re-indexing logic inside `selectOption` to handle bad AI output directly.

**Why it's wrong:** `selectOption` becomes responsible for two things — rendering/input and input validation. Tests for the selector now require mocking AI output. The selector stops being reusable for non-AI callers.

**Do this instead:** `normalizer.js` handles all input quality concerns before entries reach `selectOption`.

### Anti-Pattern 4: Using `.length` for Visual Padding

**What people do:** `label.padEnd(targetWidth)` using string `.length` for padding after truncation.

**Why it's wrong:** A label containing `'你好'` (2 characters, 4 visual cells) padded with `.padEnd(10)` produces 8 trailing spaces instead of 6, misaligning all following columns.

**Do this instead:** Use `stringWidth(label)` to compute current visual width, then add `' '.repeat(targetWidth - stringWidth(label))` spaces.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Constraint |
|----------|---------------|------------|
| `normalizer.js` → `selector/index.js` | `entries[]` array struct | IDs must be sequential 1..N integers after normalization |
| `selector/index.js` → `dispatcher/index.js` | Single `entry` struct `{id, label, value, actionable, payload?, metadata?}` | `payload.command` is execution source of truth; `label` is display only |
| `dispatcher/commands.js` → `sanitize.js`, `preview.js`, `index.js` | Named exports (Sets, arrays, RegExp) | Constants only — no functions, no imports in commands.js |
| `sanitize.js` → `dispatcher/index.js` | `{status, sanitizedCommand, redactions, action, ...}` | `sanitizedCommand` for display; original `action.command` for execution |

### External Boundaries (Unchanged)

| Boundary | Notes |
|----------|-------|
| `child_process.exec` | Runs `action.command` (original, not redacted) with `cwd` constraint |
| `process.argv` / `process.env` | `handleHeadless` reads these; callers can inject via `opts.args` / `opts.env` |
| `process.stdout` / `process.stderr` | Selector menu and dispatcher preview go to stdout; headless audit log goes to stderr |

## Sources

- Codebase direct inspection: `get-shit-done/bin/lib/selector/` and `get-shit-done/bin/lib/dispatcher/` (2026-02-24)
- Phase context documents: `08-CONTEXT.md`, `09-CONTEXT.md`, phase summaries 08-01, 08-02, 09-01, 09-02
- Phase 7 context: schema/selector contract decisions (`7-CONTEXT.md`)
- `.planning/PROJECT.md` v1.1 requirements
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`
- Confidence: HIGH — all claims based on direct code inspection of the current implementation

---
*Architecture research for: v1.1 CLI selection and security enhancements*
*Researched: 2026-02-24*
