# Feature Research

**Domain:** CLI selection standardization and secure dispatch — v1.1 additions to Codex toolkit
**Researched:** 2026-02-24
**Confidence:** HIGH

---

## Scope Note

This file covers **only the v1.1 additions**. The v1.0 baseline (numbered list rendering, InputSelector, basic secret redaction, headless preselection, width-aware truncation) is already shipped and not reassessed here. Each feature below is assessed against what the existing modules already do.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of any mature CLI selection system assume are present. Missing these makes the tool feel brittle or unfinished when the list changes dynamically or when credentials appear in commands.

| Feature | Why Expected | Complexity | v1.0 Gap | Notes |
|---------|--------------|------------|----------|-------|
| Auto-reindex on list mutation | Any tool that lets items be removed must keep numbers contiguous — gaps like "1, 3, 5" cause user confusion and parse errors | LOW | v1.0 uses caller-supplied `id` fields; no reindex on removal | Normalize at entry point: reassign `id` sequentially (1…N) before render, ignoring whatever the source assigned. Pure mapping step. |
| Expanded secret detection (provider-specific patterns) | The current `*_API_KEY`, `*_TOKEN`, `*_SECRET` regex misses bearer tokens, GitHub PATs (`ghp_`), AWS keys (`AKIA`), Stripe keys (`sk_live_`), connection strings with embedded credentials | MEDIUM | `redactSecrets()` only covers the generic `NAME=VALUE` assignment form | Add patterns ordered specific → generic. Specific patterns (e.g. `ghp_[a-zA-Z0-9]{36}`) before the generic fallback so prefix-based detection fires first. |
| Destructive command highlighting in preview | Users expect visual differentiation between safe reads and destructive writes. Red/bold on `rm`, `drop`, `--force` is the industry standard (git, docker, npm all warn before destructive ops) | LOW | Already in `preview.js` via `highlightDestructive()` and `DESTRUCTIVE_TERMS`; terms list is minimal | Extend `DESTRUCTIVE_TERMS` to cover `delete`, `destroy`, `wipe`, `nuke`, `-rf`, `--hard` (git reset), `purge`, `unlink` — all verbs common in AI-generated shell commands |
| Confirmation for destructive commands | Standard pattern across all mature CLIs (docker container prune, git rebase, npm unpublish): show `Proceed? (y/N)` with default No before any mutating action | LOW | `dispatchSelection()` gates on `mutating` flag; detection regex is narrow | Widen the `mutating` regex to include the additional destructive verbs above so confirmation triggers reliably |
| `--select` flag and `GS_DONE_SELECT` env for CI/scripting | CI pipelines need to preselect without TTY. The POSIX convention of flag > env var is universally followed (npm, git, docker all support env overrides with flag taking precedence) | LOW | Already in `headless.js`; both flag forms (`--select N` and `--select=N`) supported | No gap; table stake is met. Document this clearly for downstream users. |
| Unicode-aware column alignment | Any tool that outputs tabular data must measure display width in cells, not bytes. CJK characters are 2 cells; emoji may be 2; plain ASCII is 1. Misalignment on CJK content breaks the visual contract | LOW | `format.js` has an inline implementation covering common CJK ranges | The inline ranges miss some Emoji modifiers and newer Unicode blocks. Using `string-width` v4.x (last CJS-compatible major) is the standard ecosystem answer. **However**: `string-width` v5+ is ESM-only; the project is CJS. Use v4.2.3 (last CJS release) or inline a verified equivalent. |

### Differentiators (Competitive Advantage)

Features that set this dispatch layer apart from naive script-level execution or basic `inquirer` flows.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Provider-specific secret patterns (ordered specific → generic) | Catches real-world credentials that generic `*_KEY=value` misses: GitHub PATs, Stripe keys, AWS access keys, PEM private keys, connection-string passwords | MEDIUM | Seven pattern tiers recommended (see Pattern Tiers section below). This is the same approach used by Semgrep, Gitleaks, and the `detect-secrets` library. |
| Destructive-verb extensibility (configurable term list) | Allows callers to add domain-specific destructive verbs (e.g., `migrate`, `rollback`) without patching core | LOW | Export `DESTRUCTIVE_TERMS` as a set that `highlightDestructive()` reads at call-time; callers can extend or replace it |
| Audit trail for headless selections to stderr | CI-friendly: produces parseable `[Headless] Selected: N (Label)` on stderr while stdout stays clean for the action result. Follows the same stdout/stderr separation convention as git, docker, and make | LOW | Already implemented in `headless.js` |
| NO_COLOR / `--no-color` respected throughout | Matches the `NO_COLOR.org` standard. Strip ANSI before rendering menu, after measuring widths, not before. Prevents alignment corruption when running under logging systems that strip ANSI at output | LOW | Already in `headless.js`; needs verification it propagates to interactive path in `index.js` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fuzzy/substring match for preselection (e.g., `--select "auth"`) | "Type less in CI scripts" | Makes preselection non-deterministic when labels change; breaks automated pipelines silently | Keep numeric-only `--select`. Use a stable label → number mapping in calling scripts if needed. |
| Entropy-based secret detection | "Catch unknown credential formats" | High false-positive rate on base64 file content, hashes, and encoded values that look like secrets; would redact non-secret data in command previews | Stick to pattern-based detection ordered from specific to generic. Entropy is appropriate for offline scanning tools (gitleaks), not in-process preview redaction. |
| Per-provider secret type taxonomy in output | "Show which provider the secret belongs to" | Leaks information about what credentials are present — the opposite of the security goal | Replace uniformly with `[REDACTED]`; do not annotate with provider name |
| Storing redaction logs persistently | "Audit what was redacted" | Logs containing `key=ORIGINAL_VALUE` are themselves a secret leak vector | Redaction is display-only: redact for preview, pass original to executor. No log of original values. |
| Interactive TUI arrow-key navigation | "Feels more modern" | Fails in headless/SSH sessions; adds a dependency with no headless path | Numbered list is always headless-compatible; keep that contract |

---

## Feature Dependencies

```
InputSelector (v1.0)
    └──requires──> Auto-reindex normalizer (v1.1)
                       (ensures 1..N before render)

redactSecrets() (v1.0 generic)
    └──extended by──> Provider-specific patterns (v1.1)
                          (ordered specific → generic, same function signature)

DESTRUCTIVE_TERMS (v1.0 set)
    └──extended by──> Additional destructive verbs (v1.1)
                          └──improves──> mutating detection in dispatchSelection()
                                             └──gates──> Confirmation prompt

handleHeadless() (v1.0)
    ──already provides──> --select flag + GS_DONE_SELECT env (no v1.1 work needed)

format.js stringWidth() (v1.0 inline)
    └──verify or replace──> string-width v4.2.3 (CJS) (v1.1 decision)
```

### Dependency Notes

- **Auto-reindex requires InputSelector input contract:** The reindexer must run before `selectOption()` is called so `id` fields are 1..N. It is a pure pre-render step, not an internal selector change.
- **Provider-specific patterns extend, not replace, existing `redactSecrets()`:** The function signature stays the same (`str → {redacted, replacements}`); the pattern list grows. No caller changes needed.
- **Extended DESTRUCTIVE_TERMS improves mutating detection:** The `mutating` flag detection in `dispatchSelection()` currently uses a hardcoded regex. Extending `DESTRUCTIVE_TERMS` and wiring it to the `mutating` check unifies the two currently-separate term lists.
- **string-width v4.x is the CJS-safe choice:** v5+ is ESM-only. The project cannot `require()` v5+. Using v4.2.3 or keeping the inline implementation (which already covers common ranges) are the two options. The inline implementation is adequate for the project's use case; adding a dependency is optional.

---

## Pattern Tiers: Expanded Secret Detection

Secret detection patterns must be ordered specific → generic. If a generic `KEY=value` pattern fires first, provider-specific replacement text cannot be formatted correctly.

| Tier | Pattern Category | Example Regex | Replace With |
|------|-----------------|---------------|--------------|
| 1 | OpenAI keys | `sk-proj-[a-zA-Z0-9\-_]{20,}` or `sk-[a-zA-Z0-9]{20,}` | `[REDACTED-OPENAI]` |
| 2 | GitHub PATs | `ghp_[a-zA-Z0-9]{36}` or `github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}` | `[REDACTED-GH-TOKEN]` |
| 3 | AWS access keys | `AKIA[0-9A-Z]{16}` | `[REDACTED-AWS-KEY]` |
| 4 | Stripe secrets | `sk_live_[a-zA-Z0-9]{24,}` or `rk_live_[a-zA-Z0-9]{24,}` | `[REDACTED-STRIPE]` |
| 5 | PEM private keys | `-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----` | `[REDACTED-PRIVATE-KEY]` |
| 6 | Connection strings | `(postgres(?:ql)?|mongodb)://[^:]+:[^@]+@` (keep scheme, redact user:pass) | `$scheme://[REDACTED]@` |
| 7 | Generic fallback (existing) | `\b([A-Z0-9_]*(API_KEY\|TOKEN\|SECRET\|PASSWORD\|PASSWD\|PWD\|PASS\|AUTH\|CREDENTIAL)[A-Z0-9_]*)=([^\s]+)` | `$name=[REDACTED]` |

**Confidence:** MEDIUM (patterns sourced from Semgrep blog, trevo.rs agent-redaction article, and Gitleaks documentation; exact regexes should be tested against real credential samples before shipping).

---

## MVP Definition for v1.1

### Launch With (this milestone)

- [x] Auto-reindex: normalize `id` fields to 1..N before any render call — preserves existing `selectOption()` contract
- [x] Expanded secret patterns: add tiers 1–6 above as prefix rules ahead of existing generic pattern
- [x] Extended destructive verbs: add `delete`, `destroy`, `-rf`, `--hard`, `purge`, `wipe`, `unlink` to `DESTRUCTIVE_TERMS`
- [x] Widen `mutating` detection in `dispatchSelection()` to use the same term set

### Already Shipped (no v1.1 work needed)

- [x] `--select` flag and `GS_DONE_SELECT` env preselection (headless.js is complete)
- [x] Unicode-aware column alignment (inline implementation covers common ranges; verify emoji modifier coverage is acceptable for project scope)

### Defer to v1.2+

- [ ] Configurable destructive-verb injection API (let callers extend DESTRUCTIVE_TERMS at runtime) — wait until a real consumer need arises
- [ ] `string-width` v4.x as explicit dependency — inline implementation is sufficient; evaluate only if alignment bugs surface with real content
- [ ] Coverage of ambiguous-width Unicode characters (East Asian Ambiguous category) — narrow-only treatment is correct default; defer until user complaint

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Expanded secret patterns (tiers 1–6) | HIGH — prevents real credential leakage in screen shares and CI logs | MEDIUM — 6 new regexes in `redactSecrets()` | P1 |
| Extended destructive verbs | HIGH — prevents silent destructive dispatch for AI-generated commands | LOW — extend constant, update mutating regex | P1 |
| Auto-reindex on list mutation | MEDIUM — required for any dynamic list but lists are currently static | LOW — pure mapping before render | P1 |
| Unicode column alignment (verification) | MEDIUM — correctness for non-ASCII labels | LOW — verify inline impl covers emoji range | P2 |
| `--select` / env preselection | HIGH — already shipped | ZERO | Done |

---

## Competitor Reference Patterns

| Behavior | Docker CLI | Git | npm CLI | Codex v1.0 | Codex v1.1 target |
|----------|------------|-----|---------|------------|-------------------|
| Destructive confirmation | `Are you sure? [y/N]` | none (exits non-zero with error) | `Are you sure?` for unpublish | `Proceed? (y/N)` | Same, but wider trigger |
| Secret masking in output | Not built-in | Not built-in | Not built-in | `NAME=[REDACTED]` for generic patterns | + provider-specific tiers |
| Numbered selection | Not present | Not present | Not present | 1–N numbered list | Auto-reindexed when items removed |
| Env var preselection | `DOCKER_HOST` etc. | `GIT_*` env vars | `NPM_CONFIG_*` | `GS_DONE_SELECT` | No change |
| Unicode alignment | Not a concern | Not a concern | Not a concern | Inline CJK width | Verify emoji modifier range |

---

## Sources

- [secrets-patterns-db — largest open-source regex database for secret detection](https://github.com/mazen160/secrets-patterns-db)
- [Semgrep: Secrets Story — prefixed secrets detection ordering](https://semgrep.dev/blog/2025/secrets-story-and-prefixed-secrets/)
- [Trevor Stenson: Keeping Secrets Out of Your Agent's Context](https://trevo.rs/agent-redaction) — ordered pattern tiers for agent redaction
- [Gitleaks — 160+ secret type patterns](https://gitleaks.io/)
- [GitHub Secret Scanning Updates — November 2025](https://github.blog/changelog/2025-12-02-secret-scanning-updates-november-2025/) — 24 new secret types added
- [string-width npm — ESM-only since v5](https://www.npmjs.com/package/string-width) — confirms v4.x is last CJS-compatible release
- [lirantal/nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — env var detection and destructive confirmation conventions
- [Docker CLI issue #2745 — y/N confirmation pattern](https://github.com/docker/cli/issues/2745) — confirmation UX reference

---

*Feature research for: Codex CLI selection standardization and security — v1.1 milestone*
*Researched: 2026-02-24*
