# Stack Research

**Domain:** Node.js CLI toolkit — selection UX refinements, secure dispatch, headless integration, Unicode padding (v1.1.0)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Context: Zero-Dependency Architecture

The existing codebase (~6,600 LOC) has **no package.json and no external npm dependencies**. Every module uses only `node:*` built-ins. This is a deliberate constraint that eliminates the install step, lockfile drift, and supply chain surface area. All v1.1.0 stack decisions must respect this constraint.

The runtime is **Node.js 25.6.1**, which provides:
- `Intl.Segmenter` (stable since Node 16) — handles grapheme clusters including ZWJ emoji sequences
- `require(esm)` stable since Node 22.12.0/25.4.0 — relevant only if ESM packages are adopted later
- `node:readline`, `node:child_process`, `node:path`, `node:fs` — already in use throughout

**Conclusion: All four v1.1.0 feature areas are achievable with zero new external dependencies.**

---

## Recommended Stack

### Core Technologies (no changes to existing stack)

| Technology | Version | Purpose | Why Keep |
|------------|---------|---------|----------|
| Node.js | 25.6.1 (runtime) | Execution environment | Already established; all v1.1.0 features fit existing built-ins |
| CJS modules (`require` / `module.exports`) | — | Module system | Entire codebase is CJS; ESM migration would be a rewrite outside v1.1.0 scope |
| `node:readline` | built-in | Interactive prompts | Powers `selectOption` and `dispatchSelection`; already in use |
| `node:child_process` | built-in | Command execution | Powers `dispatchSelection` runner; already in use |
| `node:test` + `node:assert` | built-in (Node 20+ stable) | Test framework | All existing tests use this; zero overhead, no install required |

### New Built-in Capability: `Intl.Segmenter` for Unicode Width

| Capability | Mechanism | Why |
|------------|-----------|-----|
| Correct ZWJ emoji width | `new Intl.Segmenter('en', { granularity: 'grapheme' })` | Node built-in; handles ZWJ sequences (e.g. `👨‍👩‍👧`) the existing char-loop gets wrong |
| CJK double-width detection | Inline code-point range check per grapheme segment | Existing ranges are correct; bug is only in multi-codepoint graphemes |
| ANSI stripping before width measurement | Existing ANSI regex in `format.js` `stripAnsi()` | Already correct; keep as-is |

**Verified failure in existing code:** `stringWidth('👨‍👩‍👧')` returns `8`; correct value is `2`. An `Intl.Segmenter`-based replacement returns `2` (tested on Node 25.6.1, 2026-02-24).

**Implementation pattern for `format.js`:**
```js
// Module-level — create once, reuse (avoid per-call construction overhead)
const _segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function stringWidth(str) {
  const stripped = stripAnsi(str);
  let width = 0;
  for (const { segment } of _segmenter.segment(stripped)) {
    width += _isWideGrapheme(segment) ? 2 : 1;
  }
  return width;
}
```

The `_isWideGrapheme` helper retains the existing code-point range checks, applied to the first code point of each grapheme cluster.

---

## Secret Redaction Pattern Expansion (no new library)

The existing `redactSecrets` in `sanitize.js` covers only uppercase env var assignment patterns:
```
/\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET))=([^\s]+)/g
```

**What it misses:** bearer tokens in headers, database URIs with embedded credentials, JWT tokens, private key PEM blocks, lowercase variable names.

**Recommended approach:** Expand to a pattern array in `sanitize.js`. No library needed. All patterns below are linear-complexity (no catastrophic backtracking).

```js
const SECRET_PATTERNS = [
  // Env var assignments — uppercase and lowercase
  /\b([A-Za-z0-9_]*(api_key|token|secret|password|passwd|pwd|credential)s?)=([^\s'"]+)/gi,
  // Bearer / Authorization header values
  /\b(Bearer|Authorization:)\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // Database URIs with embedded user:pass
  /(mongodb|postgres|postgresql|mysql|redis):\/\/[^:]+:[^@\s]+@/gi,
  // JWT tokens (eyJ... structure)
  /\beyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+(\.[A-Za-z0-9\-_.+/=]*)?\b/g,
  // PEM private key blocks
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
];
```

---

## Destructive Command Detection Expansion (no new library)

The existing `DESTRUCTIVE_TERMS` in `preview.js` covers: `rm`, `truncate`, `drop`, `overwrite`, `--force`, `-rf`.

**Recommended additions for v1.1.0:**
```js
const DESTRUCTIVE_TERMS = [
  // Existing
  'rm', 'truncate', 'drop', 'overwrite', '--force', '-rf',
  // New
  'rmdir', 'unlink', 'shred', 'wipe', 'format', 'mkfs',
  'DELETE', 'DROP TABLE', 'TRUNCATE TABLE',
  '--no-preserve-root', '--delete',
];
```

No library needed. The existing `RegExp` word-boundary matching in `preview.js` handles the expansion without changes to the matching logic.

---

## Features Already Complete (verify, do not re-implement)

| Feature | Location | Status |
|---------|----------|--------|
| Auto-reindexing | `normalize.js` lines 118–126 | Done — sort-then-reindex already handles non-sequential AI output (1, 3, 5 → 1, 2, 3) |
| `--select` flag | `headless.js` lines 18–28 | Done — handles `--select N` and `--select=N` |
| `GS_DONE_SELECT` env var | `headless.js` line 28 | Done — flag takes precedence over env |
| `0-to-exit` in headless | `headless.js` lines 59–61 | Done |

---

## Supporting Libraries

**None required for v1.1.0.** All capabilities are satisfied by Node.js built-ins.

| Considered Library | Version | Verdict | Reason |
|-------------------|---------|---------|--------|
| `string-width` | 7.x (ESM-only) | Do not add | `Intl.Segmenter` achieves identical correctness with zero deps; no package.json exists |
| `string-width` | 4.2.3 (last CJS version) | Do not add | Stale (2021); does not correctly handle ZWJ sequences; requires package.json introduction |
| `string-width-cjs` | 5.1.1 | Do not add | Supply chain concerns documented by Snyk (2024); resolves to an aliased fork |
| `micromatch` | 4.0.8 (CJS-compatible) | Do not add | No glob matching required by any v1.1.0 feature; workspace boundary uses `path.resolve` + `startsWith` which is sufficient |
| `minimatch` | — | Do not add | Same reasoning as micromatch |
| `redact-pii` | — | Do not add | Overkill for CLI preview redaction; covers PII (names, SSNs) not relevant here; custom patterns are auditable |
| `chalk` / `kleur` | — | Do not add | ANSI sequences already inlined as string literals in `preview.js`; adding a color library is churn with no benefit |

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` (built-in) | Test runner for all new and existing tests | Run per-directory: `node --test get-shit-done/bin/lib/selector/__tests__/*.test.js` |
| `node --test --watch` | TDD loop with re-run on file change | Available Node 22+; no external watcher needed |
| `node:assert` (built-in) | Assertions | Use `strictEqual`, `match`, `ok`; avoid `deepEqual` for performance-sensitive tests |

---

## Installation

No installation step. Zero new dependencies.

```bash
# Confirm Intl.Segmenter works (it will on any Node 16+)
node -e "new Intl.Segmenter(); console.log('ok')"

# Run existing test suites
node --test get-shit-done/bin/lib/selector/__tests__/*.test.js
node --test get-shit-done/bin/lib/dispatcher/__tests__/*.test.js
```

If a `package.json` is introduced in a future milestone, pin the engine constraint:
```json
{
  "engines": { "node": ">=22.12.0" }
}
```
This ensures `require(esm)` works without flags if ESM packages are adopted later.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `Intl.Segmenter` for Unicode width | `string-width` npm package | Only if the project adds package.json and needs exact behavioral parity with `string-width` for cross-tool compatibility |
| Expanded inline regex for secrets | `redact-pii` library | Only if secret detection needs to cover PII (names, phone numbers, SSNs) — not in scope for CLI dispatch previews |
| Inline `DESTRUCTIVE_TERMS` expansion | AST-based shell grammar analysis | Only if the dispatcher needs to understand pipelines, subshells, or compound commands — not in scope for v1.1.0 |
| `node:test` built-in runner | `jest`, `vitest`, `mocha` | Only if snapshot testing, code coverage reports, or parallel test workers become necessary |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `string-width` v5+ (ESM-only) | Requires package.json introduction; `string-width-cjs` re-export has documented supply chain concerns (Snyk, 2024) | `Intl.Segmenter` built-in |
| `string-width` v4.2.3 (CJS) | Last release 2021; does not handle ZWJ sequences correctly; requires package.json | `Intl.Segmenter` built-in |
| `micromatch` / `minimatch` | Not needed for any v1.1.0 feature; would introduce first external dependency unnecessarily | `path.resolve` + `String.prototype.startsWith` for workspace boundary |
| Any ESM-only package via `import()` | Would require async wrappers throughout a synchronous CJS codebase | Node.js built-ins or CJS-native packages only |
| `chalk`, `kleur`, `ansi-colors` | ANSI codes already inlined in `preview.js`; adding a color library at this codebase size is overhead without benefit | Inline ANSI escape literals |

---

## Stack Patterns by Variant

**If Unicode padding only needs CJK + basic emoji (no ZWJ family sequences):**
- Keep existing char-loop `stringWidth` in `format.js`
- ZWJ sequences like `👨‍👩‍👧` are rare in CLI menu labels; the existing bug is low-impact in practice
- Avoids touching `format.js` entirely

**If Unicode padding must handle all modern emoji correctly (recommended for v1.1.0):**
- Replace char-loop with `Intl.Segmenter` approach in `format.js`
- ZWJ sequences render wrong width (8 vs 2) causing off-by-many truncation in menus with emoji
- Zero new dependencies; one targeted change to `format.js`

**If a future milestone needs file pattern matching (e.g., `.gitignore`-style rules):**
- Then introduce `micromatch@4.0.8` (CJS-compatible, CVE-2024-4067 patched)
- Because it handles negation patterns and edge cases that `path.startsWith` cannot
- Not needed for v1.1.0

---

## Version Compatibility

| Built-in | Available Since | Notes |
|----------|----------------|-------|
| `Intl.Segmenter` | Node.js 16.0.0 | Stable; no flag needed; handles grapheme clusters including ZWJ emoji |
| `node:test` | Node.js 18.0.0 (stable: 20.0.0) | Already in use in the test suite |
| `node --test --watch` | Node.js 22.0.0 | Available in current runtime (Node 25) |
| `require(esm)` | Node.js 22.12.0 (LTS backport), 20.19.0 | Relevant only if ESM packages are adopted in a future milestone |

---

## Sources

- [string-width npm](https://www.npmjs.com/package/string-width) — confirmed ESM-only from v5+; v4.2.3 is last CJS version (MEDIUM confidence — WebSearch verified)
- [Node.js 25.4.0 stable require(esm)](https://socket.dev/blog/node-js-25-4-0-ships-with-stable-require-esm) — confirmed require(esm) stable in Node 25+ (HIGH confidence — official release blog)
- [The mysterious supply chain concern of string-width-cjs](https://snyk.io/blog/supply-chain-string-width-cjs-npm/) — documented concerns with `string-width-cjs` package (HIGH confidence — Snyk research)
- [micromatch GitHub](https://github.com/micromatch/micromatch) — confirmed CJS-compatible (`require('micromatch')` documented), current version 4.0.8 (MEDIUM confidence — WebSearch + GitHub README)
- [100 Regex Patterns for Secrets](https://blogs.jsmon.sh/100-regex-patterns/) — credential pattern reference for expanded secret redaction (MEDIUM confidence — security research)
- Node.js `Intl.Segmenter` — locally tested on Node 25.6.1 (2026-02-24): ZWJ family emoji returns correct width 2; existing char-loop returns 8 (HIGH confidence — directly verified)
- Existing codebase inspection — `sanitize.js`, `preview.js`, `headless.js`, `normalize.js`, `format.js` all reviewed directly (HIGH confidence — direct code read)

---

*Stack research for: Codex CLI toolkit v1.1.0 — selection standardization & security*
*Researched: 2026-02-24*
