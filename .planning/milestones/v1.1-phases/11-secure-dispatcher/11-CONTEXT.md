# Phase 11: Secure Dispatcher - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the dispatcher's secret redaction from a single generic regex to provider-specific credential detection with specific-to-generic ordering. Redaction is display-only — the original unredacted command is what `child_process.exec` receives. No new dispatcher capabilities; this hardens the existing preview/sanitize path.

</domain>

<decisions>
## Implementation Decisions

### Redaction display format
- Generic `[REDACTED]` replacement text for all secret types — no provider tags, no partial reveals
- Redact the value only, not the key name: `OPENAI_API_KEY=[REDACTED]` not `[REDACTED]`
- Silent replacement — no count footer or messaging about how many secrets were found
- PEM blocks: replace the entire multi-line block (delimiters included) with a single `[REDACTED]`

### Pattern coverage scope
- Required patterns (from success criteria): OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Stripe `sk_live_*`, PEM blocks, connection string credentials
- Additional patterns to include: Anthropic `sk-ant-*`, generic JWTs (`eyJ...`), Bearer tokens (`Authorization: Bearer <token>`)
- Connection strings: URI format with credentials (`postgresql://user:pass@host`) required; other formats (Redis, Mongo, DSN) at Claude's discretion
- Patterns hardcoded and curated in `commands.js` alongside other constants — not user-configurable

### False-positive handling
- Strict allow-list of known safe patterns (e.g. `TOKEN_COUNT`, `SECRET_LENGTH`, numeric-only values) that are never redacted
- Skip values under a minimum length threshold — short values like `TOKEN=5` or `KEY=abc` are not real secrets
- Never redact file paths — values starting with `/`, `./`, or containing path separators are left alone
- Exception: provider-prefixed values (ghp_, sk-, AKIA, etc.) are always redacted regardless of length — trust the prefix

### Ordering & fallback behavior
- Patterns stored as an ordered array in `commands.js` — position equals priority, manually curated
- Specific provider patterns first, generic `KEY=value` fallback pattern last
- First match wins — if a specific pattern matches a value, the generic pattern does not also fire on it
- Multi-pass replacement — each pattern runs as a separate regex pass in priority order
- Generic fallback retained as last resort to catch unknown credential types

### Claude's Discretion
- Exact minimum length threshold for generic pattern false-positive skipping
- Which additional connection string formats beyond URI to cover
- Internal structure of the ordered pattern array (object shape, metadata per pattern)
- Test case selection beyond the explicit success criteria examples

</decisions>

<specifics>
## Specific Ideas

- The existing `redactSecrets()` in `sanitize.js` is the function being expanded — it currently only matches `KEY=value` where key contains API_KEY/TOKEN/SECRET
- New patterns should be exported from `commands.js` (the shared constants module from Phase 10) so they're co-located with BLOCKED_COMMANDS, GRAY_COMMANDS, etc.
- The unredacted command must still reach `child_process.exec` — redaction is strictly for terminal preview output

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-secure-dispatcher*
*Context gathered: 2026-02-24*
