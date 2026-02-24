# Project Research Summary

**Project:** Codex CLI Toolkit — v1.1.0 Selection Standardization & Security
**Domain:** Node.js CLI toolkit — selection UX refinements, secure dispatch, headless integration, Unicode padding
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

Codex v1.1.0 is an incremental hardening milestone for an existing, zero-dependency Node.js CLI toolkit (~6,600 LOC). The baseline (v1.0) ships a working numbered selection system, headless preselection via `--select`/`GS_DONE_SELECT`, and basic secret redaction. v1.1.0 fills four well-defined gaps: auto-reindexing of AI-generated numbered lists, expanded secret detection covering real-world credential patterns, consolidated and widened destructive-command detection, and Unicode-aware padding using `Intl.Segmenter`. The critical constraint is that the entire codebase has no `package.json` and zero external dependencies — this constraint holds for v1.1.0 and every new capability is satisfied using Node.js built-ins alone.

The recommended approach is surgical: two new files (`selector/normalizer.js` and `dispatcher/commands.js`) plus targeted modifications to four existing files. The architecture research has produced an exact build order — `commands.js` first (no deps), then dispatcher modules in parallel, then selector changes, then optional `headless.js` refinements. All four feature areas have confirmed implementation patterns derived from direct codebase inspection, including a verified `Intl.Segmenter` implementation tested on Node 25.6.1 that fixes the existing ZWJ emoji width bug (`👨‍👩‍👧` returns 8 with the current char-loop; correct value is 2). No architectural ambiguity remains.

The primary risks are in the security domain. Secret redaction false negatives (non-standard variable names like `GITHUB_PAT`, `DB_PASSWORD`) and false positives (overaggressive patterns redacting benign assignments like `TOKEN_COUNT=5`) are the highest-severity pitfalls because they either expose credentials or break command previews. Destructive detection must be scoped to command-position tokens to avoid warning fatigue. The 7-tier secret pattern regexes sourced from Semgrep and Gitleaks have MEDIUM confidence and must be validated against a real `.env` fixture corpus before Phase 2 ships.

---

## Key Findings

### Recommended Stack

The stack is unchanged: Node.js 25.6.1, CommonJS modules, `node:readline` for prompts, `node:child_process` for execution, and `node:test` + `node:assert` for tests. No new dependencies are introduced. The one new built-in capability is `Intl.Segmenter` for Unicode grapheme-cluster-aware width calculation — stable since Node 16, verified on the current runtime, and replacing the existing char-loop that miscounts ZWJ emoji sequences. All considered npm packages were rejected: `string-width` v5+ is ESM-only (incompatible with zero-dep CJS codebase), v4.2.3 is stale and the CJS re-export variant has documented supply chain concerns (Snyk 2024), and no other package adds value a built-in cannot provide.

**Core technologies:**
- Node.js 25.6.1 built-ins: Execution environment — all v1.1.0 features fit existing built-ins; no package.json introduced
- `Intl.Segmenter` (built-in, Node 16+): Unicode grapheme width — replaces broken char-loop with zero-dependency correctness, verified on Node 25.6.1
- `node:test` + `node:assert` (built-in): Test framework — already in use; `node --test --watch` available for TDD loop
- `node:readline` / `node:child_process` (built-in): Prompts and execution — no changes to existing usage

### Expected Features

The feature landscape for v1.1.0 is fully enumerated via direct codebase gap analysis. The headless integration (`--select` flag, `GS_DONE_SELECT` env) is already complete and requires no v1.1.0 work beyond optional input validation hardening.

**Must have (table stakes) — ship in v1.1.0:**
- Auto-reindex: normalize `id` fields to 1..N before any render call — required for correct behavior when AI output skips or duplicates numbers
- Expanded secret patterns (7 tiers): OpenAI keys, GitHub PATs, AWS access keys, Stripe keys, PEM blocks, connection string credentials, generic fallback — prevents real credential leakage in terminal output and CI logs
- Extended destructive verbs: `delete`, `destroy`, `-rf`, `--hard`, `purge`, `wipe`, `unlink` added to `DESTRUCTIVE_TERMS`, wired to confirmation gating in `dispatchSelection`
- Consolidated command policy constants: single `commands.js` source of truth replacing three divergent inline definitions across `sanitize.js`, `preview.js`, and `dispatcher/index.js`

**Should have (competitive) — ship in v1.1.0:**
- `Intl.Segmenter`-based `stringWidth` in `format.js`: fixes ZWJ emoji and flag emoji misalignment with zero added dependencies
- `padLabel()` helper in `format.js`: enables correct Unicode-aware right-padding for column alignment
- `columns ?? 80` fallback in width resolution: prevents NaN rendering in non-TTY contexts (CI, pipes, test runners)

**Defer to v1.2+:**
- Configurable destructive-verb injection API (callers extending `DESTRUCTIVE_TERMS` at runtime) — wait for real consumer need
- `string-width` as explicit npm dependency — inline implementation is sufficient; evaluate only if alignment bugs surface with real content
- East Asian Ambiguous character width coverage — narrow-only treatment is correct default; defer until user complaint
- Entropy-based secret detection — high false-positive risk; pattern-based approach is correct for in-process CLI preview redaction

### Architecture Approach

The architecture is a two-layer pipeline: a `selector/` layer (normalizer → entry formatting → headless or interactive prompt) and a `dispatcher/` layer (sanitize → preview → confirm → run). The layers communicate only via a typed entry struct (`{id, label, value, actionable, payload?, metadata?}`). v1.1.0 adds one new module per layer (`normalizer.js` in selector, `commands.js` in dispatcher) and modifies four existing files. No existing public contracts change — all modifications are additive (new constants, expanded pattern arrays, new helper functions) or consolidating (replacing inline definitions with imports from `commands.js`).

**Major components:**
1. `selector/normalizer.js` (NEW) — validates and reindexes raw AI numbered-list output into clean `entries[]` before `selectOption` is called; selector itself unchanged
2. `dispatcher/commands.js` (NEW) — single source of truth for `BLOCKED_COMMANDS`, `GRAY_COMMANDS`, `DESTRUCTIVE_HIGHLIGHT_TERMS`, `MUTATING_PATTERN`; no logic, no imports
3. `dispatcher/sanitize.js` (MODIFIED) — imports shared constants from `commands.js`; expands `redactSecrets()` with 7-tier ordered patterns; interface `{redacted, replacements}` unchanged
4. `dispatcher/preview.js` (MODIFIED) — imports `DESTRUCTIVE_HIGHLIGHT_TERMS` from `commands.js`; no logic change
5. `dispatcher/index.js` (MODIFIED) — imports `MUTATING_PATTERN` from `commands.js`; replaces inline regex; redact-for-display/execute-original pattern preserved
6. `selector/format.js` (MODIFIED) — adds `padLabel()` helper; replaces char-loop `stringWidth` with `Intl.Segmenter` implementation using module-level singleton

### Critical Pitfalls

1. **Secret redaction false negatives on non-standard variable names** — `DB_PASSWORD`, `GITHUB_PAT`, `OPENAI_KEY`, `STRIPE_SK_LIVE` sail through the existing regex. Avoid by implementing 7-tier ordered patterns (specific providers first, generic fallback last) and validating against a real `.env` fixture corpus before shipping.

2. **Secret redaction false positives break legitimate command previews** — Broadening patterns risks redacting `TOKEN_COUNT=5` or file paths containing keywords. Avoid by requiring RHS to match credential heuristics (min length, no path separators) and maintaining negative-case test fixtures asserting specific strings are NOT redacted.

3. **Destructive detection fires on benign argument substrings** — `echo "drop table users"` lights up red; `npm run truncate-logs` triggers on `truncate` in argument position. Avoid by restricting highlighting to command-position tokens (first token, or after `&&`, `||`, `;`, `|`), not arbitrary substrings.

4. **Auto-reindex breaks stale headless `--select` references** — If the entry set changes between invocations, `--select=3` silently points to a different item. Avoid by reindexing only for fresh same-session menu renders; never mutate IDs on a live entry set with potential headless consumers.

5. **`--select` flag parsing silently accepts malformed values** — `parseInt('10abc', 10)` returns `10`. Avoid by validating with `/^\d+$/` before `parseInt`; reject `--select=1abc`, `--select=`, `--select=-1`, `--select=1.5` with exit code 1 and a clear message.

---

## Implications for Roadmap

The build order is dictated by module dependencies. `commands.js` has no dependencies and unblocks three dispatcher modules simultaneously. Dispatcher changes are independent of selector changes after `commands.js` is in place. This maps to four sequential-then-parallel phases with an optional hardening phase.

### Phase 1: Shared Command Policy Foundation
**Rationale:** `dispatcher/commands.js` is a pure constants module with no imports. It is the dependency anchor for all three dispatcher modifications and must be built first to enable parallel downstream work.
**Delivers:** Single source of truth for `BLOCKED_COMMANDS`, `GRAY_COMMANDS`, `DESTRUCTIVE_HIGHLIGHT_TERMS`, `MUTATING_PATTERN`. No behavioral change yet — existing inline definitions replaced with imports.
**Addresses:** Anti-pattern of duplicating command lists across sanitize, preview, and dispatcher index (the current state where adding a term to `preview.js` does not update confirmation gating in `index.js`).
**Avoids:** Pitfall 4 (destructive detection substring false positives caused by drift between the three separate term lists).

### Phase 2: Secure Dispatcher
**Rationale:** With `commands.js` in place, `sanitize.js`, `preview.js`, and `dispatcher/index.js` can each be updated independently. Secret pattern expansion also lands here. This is the highest security-value phase.
**Delivers:** Expanded 7-tier secret redaction (OpenAI, GitHub PAT, AWS, Stripe, PEM, connection strings, generic fallback). Consolidated and extended destructive-verb detection with confirmation gating. `ps`-exposure limitation documented as known gap in code comments and phase summary.
**Implements:** Architecture Pattern 1 (Shared Constants Module) and Pattern 3 (Redact-for-Display, Execute-Original).
**Must avoid:** Pitfall 2 (false negatives — validate against real `.env` fixture corpus before merging), Pitfall 3 (false positives — add negative tests for `TOKEN_COUNT=5` and path strings), Pitfall 11 (never swap `sanitizedCommand` and original `action.command` — preview gets redacted, runner gets original).

### Phase 3: Selection Normalization
**Rationale:** `selector/normalizer.js` sits above `selectOption` and depends only on `format.js` being stable. It is independent of all dispatcher work and can proceed concurrently with Phase 2.
**Delivers:** `normalizer.js` that validates `/^\d+\.\s+.+$/` lines from AI output, silently reindexes skipped numbers to 1..N, and hard-fails with retry hint on duplicate leading numbers. `selectOption` itself is unchanged — normalizer is a pre-processing step, not an internal selector change.
**Implements:** Architecture Pattern 2 (Above-the-selector Normalization) — selector remains independently testable; its tests never need to model bad AI output.
**Must avoid:** Pitfall 1 (reindex breaking stale `--select` references — only reindex in fresh same-session renders), Anti-pattern 3 (normalization logic inside `selectOption`).

### Phase 4: Unicode-Aware Padding and Truncation
**Rationale:** `format.js` changes are isolated to the selector rendering path with no dispatcher dependencies. Unicode fixes are correctness improvements; landing them after security work reflects priority ordering (security over cosmetics).
**Delivers:** `Intl.Segmenter`-based `stringWidth` (module-level singleton, verified implementation from STACK.md). `padLabel(str, targetWidth)` helper using `stringWidth` for correct visual-width padding. `columns ?? 80` fallback preventing NaN in non-TTY contexts. Updated `format.test.js` with flag emoji (`🇬🇧`), ZWJ sequences (`👨‍💻`), and `columns = undefined` test cases.
**Addresses:** Pitfall 8 (ZWJ/flag emoji width divergence from terminal rendering), Pitfall 9 (surrogate split at truncation boundary), Pitfall 10 (`process.stdout.columns` undefined produces NaN widths in CI).
**Must avoid:** Anti-pattern 4 (using `.length` for visual padding), iterating by code unit index (`charCodeAt`) instead of grapheme cluster.

### Phase 5: Headless Hardening (Optional)
**Rationale:** The core `handleHeadless` implementation is already complete and tested. This phase addresses edge cases that are unlikely to affect normal usage but matter for CI robustness. Can be deferred if Phases 1–4 complete without surfacing headless issues.
**Delivers:** `/^\d+$/` full-string validation on `--select` values (rejects `10abc`, empty, negative, float with exit code 1). Stderr notice when `GS_DONE_SELECT` activates headless mode. Optional standalone `parseSelectFlag(args, env)` export from `headless.js`.
**Addresses:** Pitfall 6 (`parseInt` accepting malformed `--select` values), Pitfall 7 (`GS_DONE_SELECT` sticky env variable leaking across shell sessions).

### Phase Ordering Rationale

- Phase 1 (`commands.js`) has zero risk and maximum unblocking value — always build it first.
- Phases 2 and 3 are independent of each other and can run in parallel; both depend only on Phase 1 being complete.
- Phase 4 (Unicode `format.js`) is independent of both dispatcher and normalizer but benefits from being stable before Phase 3's normalizer depends on it — practically, Phase 4 can run concurrently with Phase 3 since they touch different files.
- Phase 5 is optional hardening; defer unless headless edge cases surface during Phase 1–4 testing.

### Research Flags

Phases with well-documented patterns (no additional research needed before planning):
- **Phase 1 (commands.js):** Pure constants extraction — trivial refactor, implementation is specified completely in ARCHITECTURE.md.
- **Phase 3 (normalizer):** Implementation pattern fully specified in ARCHITECTURE.md; build directly from the design.
- **Phase 4 (Unicode):** `Intl.Segmenter` implementation is code-complete in STACK.md and verified; apply directly.
- **Phase 5 (headless hardening):** All changes documented in PITFALLS.md; implement directly from pitfall prevention guidance.

Phases requiring validation before shipping (not additional research, but testing rigor):
- **Phase 2 (secret redaction):** The 7-tier regex patterns from Semgrep/Gitleaks are MEDIUM confidence. Before merging, run each pattern against a fixture corpus (20+ real `.env` variable names including `DB_PASSWORD`, `GITHUB_PAT`, `OPENAI_KEY`, `STRIPE_SK_LIVE`) and 20+ benign commands. Assert negative cases (`TOKEN_COUNT=5`, file paths) are not redacted.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `Intl.Segmenter` tested on Node 25.6.1; existing codebase directly inspected; ESM incompatibility confirmed via npm registry; Snyk supply-chain concern independently sourced |
| Features | HIGH | Feature list derived from direct codebase gap analysis; table stakes confirmed against Docker/Git/npm CLI conventions; headless completeness verified by reading `headless.js` directly |
| Architecture | HIGH | All claims from direct code inspection of current implementation; build order verified against module dependency graph; all anti-patterns identified from existing code |
| Pitfalls | HIGH | Critical pitfalls from direct code analysis of `sanitize.js`, `preview.js`, `headless.js`, `format.js`; regex pitfalls from `parseInt` MDN; Unicode pitfalls from Node.js UTF-16 documentation and `Intl.Segmenter` verification |

**Overall confidence:** HIGH

### Gaps to Address

- **Secret pattern regex accuracy (MEDIUM):** The 7 pattern tiers are sourced from Semgrep blog and Gitleaks documentation — credible but not independently verified against Node.js regex engine behavior. Mitigate by running fixture corpus tests during Phase 2 before merging.

- **`ps` secret exposure (KNOWN LIMITATION):** Commands containing secrets passed as CLI arguments are visible in `ps aux` for the process lifetime via `child_process.exec`. Accepted limitation for v1.1.0. Add an explicit code comment near the runner and surface it in the Phase 2 summary.

- **East Asian Ambiguous characters (DEFERRED):** `Intl.Segmenter` handles ZWJ sequences and regional indicators correctly but East Asian Ambiguous-width characters (Unicode UAX #11 category "A") remain terminal-dependent. Narrow-width treatment is the correct conservative default. Add a code comment in `format.js` noting the limitation; no action needed for v1.1.0.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (2026-02-24): `selector/format.js`, `selector/headless.js`, `selector/index.js`, `dispatcher/sanitize.js`, `dispatcher/preview.js`, `dispatcher/index.js`, `dispatcher/edit.js`
- Node.js `Intl.Segmenter` — locally tested on Node 25.6.1; ZWJ family emoji returns correct width 2; existing char-loop returns 8
- Phase context documents: `08-CONTEXT.md`, `09-CONTEXT.md`, `7-CONTEXT.md`, phase summaries 08-01, 08-02, 09-01, 09-02
- `.planning/PROJECT.md` v1.1 requirements
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`
- Node.js `process.stdout.columns` documentation — undefined in non-TTY confirmed
- JavaScript `parseInt` MDN reference — partial parse behaviour confirmed

### Secondary (MEDIUM confidence)
- [Node.js 25.4.0 stable require(esm)](https://socket.dev/blog/node-js-25-4-0-ships-with-stable-require-esm) — confirmed require(esm) stable in Node 25+
- [Snyk: supply chain concern of string-width-cjs](https://snyk.io/blog/supply-chain-string-width-cjs-npm/) — documented concerns with `string-width-cjs` fork
- [secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db) — largest open-source regex database for secret detection
- [Semgrep: Secrets Story — prefixed secrets detection ordering](https://semgrep.dev/blog/2025/secrets-story-and-prefixed-secrets/)
- [Gitleaks — 160+ secret type patterns](https://gitleaks.io/)
- [GitHub Secret Scanning Updates — November 2025](https://github.blog/changelog/2025-12-02-secret-scanning-updates-november-2025/)
- [Trevor Stenson: Keeping Secrets Out of Your Agent's Context](https://trevo.rs/agent-redaction) — ordered pattern tiers for agent redaction
- [lirantal/nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — env var detection and destructive confirmation conventions
- [string-width npm](https://www.npmjs.com/package/string-width) — confirmed ESM-only from v5+; v4.2.3 last CJS release
- [micromatch GitHub](https://github.com/micromatch/micromatch) — confirmed CJS-compatible; not needed for v1.1.0

### Tertiary (LOW confidence)
- [100 Regex Patterns for Secrets](https://blogs.jsmon.sh/100-regex-patterns/) — credential pattern reference; needs fixture-corpus validation before use in production patterns

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
