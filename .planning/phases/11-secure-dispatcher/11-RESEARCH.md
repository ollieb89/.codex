# Phase 11: Secure Dispatcher - Research

**Researched:** 2026-02-24
**Domain:** Regex-based secret redaction in Node.js CommonJS CLI dispatcher
**Confidence:** HIGH

## Summary

Phase 11 expands the existing `redactSecrets()` function in `sanitize.js` from a single generic `KEY=value` regex to an ordered array of provider-specific credential patterns, exported from the shared `commands.js` module established in Phase 10. The domain is well-scoped: pure regex pattern matching on command strings, no external dependencies, no new libraries.

The key technical challenge is false-positive prevention -- ensuring benign values like `TOKEN_COUNT=5` and file paths are not redacted while provider-prefixed values (`ghp_*`, `sk-*`, `AKIA*`) are always caught regardless of length. The ordered array with first-match-wins semantics plus a minimum-length threshold on the generic fallback pattern handles this cleanly.

**Primary recommendation:** Define `SECRET_PATTERNS` as an ordered array in `commands.js` with provider-specific patterns first and generic fallback last. Refactor `redactSecrets()` in `sanitize.js` to iterate this array with first-match-wins logic. Keep PEM block detection as a separate standalone regex (multi-line, not key=value shaped).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Generic `[REDACTED]` replacement text for all secret types -- no provider tags, no partial reveals
- Redact the value only, not the key name: `OPENAI_API_KEY=[REDACTED]` not `[REDACTED]`
- Silent replacement -- no count footer or messaging about how many secrets were found
- PEM blocks: replace the entire multi-line block (delimiters included) with a single `[REDACTED]`
- Required patterns: OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Stripe `sk_live_*`, PEM blocks, connection string credentials
- Additional patterns: Anthropic `sk-ant-*`, generic JWTs (`eyJ...`), Bearer tokens (`Authorization: Bearer <token>`)
- Connection strings: URI format with credentials (`postgresql://user:pass@host`) required; other formats at Claude's discretion
- Patterns hardcoded and curated in `commands.js` alongside other constants -- not user-configurable
- Strict allow-list of known safe patterns (e.g. `TOKEN_COUNT`, `SECRET_LENGTH`, numeric-only values) that are never redacted
- Skip values under a minimum length threshold -- short values like `TOKEN=5` or `KEY=abc` are not real secrets
- Never redact file paths -- values starting with `/`, `./`, or containing path separators are left alone
- Exception: provider-prefixed values (ghp_, sk-, AKIA, etc.) are always redacted regardless of length -- trust the prefix
- Patterns stored as an ordered array in `commands.js` -- position equals priority, manually curated
- Specific provider patterns first, generic `KEY=value` fallback pattern last
- First match wins -- if a specific pattern matches a value, the generic pattern does not also fire on it
- Multi-pass replacement -- each pattern runs as a separate regex pass in priority order
- Generic fallback retained as last resort to catch unknown credential types

### Claude's Discretion
- Exact minimum length threshold for generic pattern false-positive skipping
- Which additional connection string formats beyond URI to cover
- Internal structure of the ordered pattern array (object shape, metadata per pattern)
- Test case selection beyond the explicit success criteria examples

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Dispatcher redacts provider-specific secrets (OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Stripe `sk_live_*`, PEM blocks, connection strings) in command previews | Ordered pattern array in commands.js, refactored redactSecrets() in sanitize.js |
| SEC-02 | Secret patterns are ordered specific-to-generic so prefix-based detection fires before generic fallback | Array position = priority, first-match-wins iteration in redactSecrets() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in RegExp | N/A | Pattern matching for secret detection | Zero dependencies per project constraint; RegExp is sufficient for all pattern types including PEM blocks |
| node:test + node:assert | N/A | Test runner | Already used by all existing dispatcher tests (commands.test.js, sanitize.test.js, dispatcher.test.js) |

### Supporting
No additional libraries needed. All patterns use standard JavaScript RegExp.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled regex | detect-secrets (Python), gitleaks | External dependency violates zero-dep constraint; overkill for preview-only redaction |
| Ordered array | Single mega-regex with alternation | Loses priority ordering, harder to maintain, no first-match-wins semantics |

## Architecture Patterns

### Current File Structure (no changes to structure)
```
get-shit-done/bin/lib/dispatcher/
  commands.js        # Constants + SECRET_PATTERNS array (expanded)
  sanitize.js        # redactSecrets() refactored to use SECRET_PATTERNS
  preview.js         # No changes needed
  index.js           # No changes needed (already passes original command to exec)
  __tests__/
    commands.test.js  # Tests for SECRET_PATTERNS shape + ordering
    sanitize.test.js  # Tests for redactSecrets() behavior
```

### Pattern 1: Ordered Pattern Array
**What:** Each secret pattern is an object with `name`, `regex`, and optional `alwaysRedact` flag. Array position = priority.
**When to use:** When detection order matters and patterns may overlap.
**Example:**
```javascript
const SECRET_PATTERNS = [
  // Provider-specific (highest priority) -- always redact regardless of length
  { name: 'anthropic', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, alwaysRedact: true },
  { name: 'openai', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, alwaysRedact: true },
  { name: 'github', regex: /\bghp_[A-Za-z0-9]{36,}\b/g, alwaysRedact: true },
  { name: 'aws', regex: /\bAKIA[A-Z0-9]{16}\b/g, alwaysRedact: true },
  { name: 'stripe', regex: /\bsk_live_[A-Za-z0-9]{24,}\b/g, alwaysRedact: true },
  // Structured secrets
  { name: 'pem', regex: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, alwaysRedact: true },
  { name: 'jwt', regex: /\beyJhbG[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, alwaysRedact: true },
  { name: 'bearer', regex: /\bBearer\s+[A-Za-z0-9_\-.~+\/]+=*/g, alwaysRedact: true },
  { name: 'connection_string', regex: /\b[a-z+]+:\/\/[^:]+:[^@]+@[^\s]+/g, alwaysRedact: true },
  // Generic fallback (lowest priority)
  { name: 'generic_env', regex: /\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH))\s*=\s*(\S+)/g, alwaysRedact: false },
];
```

### Pattern 2: Safe Value Detection
**What:** Before applying generic fallback redaction, check if the value is actually benign.
**When to use:** For the generic fallback pattern only (provider patterns always redact).
**Example:**
```javascript
function isSafeValue(value) {
  // Numeric-only values (TOKEN_COUNT=5)
  if (/^\d+$/.test(value)) return true;
  // File paths
  if (/^[.\/~]/.test(value) || value.includes(path.sep)) return true;
  // Below minimum length threshold (e.g., 8 chars)
  if (value.length < MIN_SECRET_LENGTH) return true;
  return false;
}
```

### Anti-Patterns to Avoid
- **Single mega-regex:** Loses ordering, makes maintenance painful, can't do first-match-wins
- **Modifying the original command:** Redaction is display-only; `child_process.exec` must receive the original
- **Regex with catastrophic backtracking:** Keep patterns anchored and use possessive quantifiers where possible
- **Redacting key names:** `OPENAI_API_KEY=[REDACTED]` is correct; `[REDACTED]=[REDACTED]` is wrong

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PEM block detection | Custom line-by-line parser | Single multi-line regex with `[\s\S]*?` | RegExp handles PEM delimiters cleanly; line-by-line parsing is fragile |
| Connection string parsing | URL parser for credential extraction | Regex with `://user:pass@host` pattern | Only need to detect and redact, not parse into components |

## Common Pitfalls

### Pitfall 1: Anthropic vs OpenAI Key Collision
**What goes wrong:** Both Anthropic (`sk-ant-*`) and OpenAI (`sk-*`) keys start with `sk-`. If OpenAI pattern runs first, it catches Anthropic keys at wrong specificity.
**Why it happens:** Prefix overlap between providers.
**How to avoid:** Anthropic pattern MUST come before OpenAI in the array. The longer, more specific prefix (`sk-ant-`) matches first.
**Warning signs:** Test with `sk-ant-api03-...` and verify it matches anthropic, not openai.

### Pitfall 2: Generic Pattern False Positives
**What goes wrong:** `TOKEN_COUNT=5`, `SECRET_LENGTH=32`, `API_KEY_FILE=/path/to/key` get redacted.
**Why it happens:** Generic `KEY=value` pattern matches any env var whose name contains API_KEY/TOKEN/SECRET.
**How to avoid:** Safe value detection: skip numeric-only values, file paths, and values below minimum length.
**Warning signs:** Test with real `.env`-style fixtures containing both secrets and config values.

### Pitfall 3: Redacting Display While Preserving Original
**What goes wrong:** The redacted string gets passed to `child_process.exec` instead of the original.
**Why it happens:** Confusion between `sanitizedCommand` (for display) and `action.command` (for execution).
**How to avoid:** `index.js` already passes `action.command` to the runner (line 99). Verify this is not changed.
**Warning signs:** Commands fail because `[REDACTED]` appears in the actual execution.

### Pitfall 4: Regex State with /g Flag
**What goes wrong:** RegExp with `/g` flag maintains `lastIndex` state between calls, causing intermittent match failures.
**Why it happens:** JavaScript RegExp objects are stateful when using `/g`.
**How to avoid:** Either create fresh RegExp per call, or use `String.prototype.replace()` which resets automatically when passed a regex literal.
**Warning signs:** Tests pass individually but fail when run together; intermittent redaction misses.

## Code Examples

### Current redactSecrets (to be replaced)
```javascript
// sanitize.js lines 37-47 (current)
function redactSecrets(str) {
  const replacements = [];
  const redacted = str.replace(
    /\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET))=([^\s]+)/g,
    (_m, key, _suffix, value) => {
      replacements.push({ key, original: value });
      return `${key}=[REDACTED]`;
    },
  );
  return { redacted, replacements };
}
```

### Refactored redactSecrets (target)
```javascript
function redactSecrets(str) {
  const replacements = [];
  let redacted = str;
  const alreadyRedacted = new Set(); // Track positions to prevent double-redaction

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex lastIndex for safety
    pattern.regex.lastIndex = 0;

    if (pattern.name === 'generic_env') {
      // Generic fallback: extract key and value, check if safe
      redacted = redacted.replace(pattern.regex, (match, key, _suffix, value) => {
        if (!pattern.alwaysRedact && isSafeValue(value)) return match;
        replacements.push({ key, original: value });
        return `${key}=[REDACTED]`;
      });
    } else {
      // Provider/structured patterns: replace entire match
      redacted = redacted.replace(pattern.regex, (match) => {
        replacements.push({ key: pattern.name, original: match });
        return '[REDACTED]';
      });
    }
  }

  return { redacted, replacements };
}
```

## Open Questions

1. **Exact minimum length threshold**
   - What we know: Must skip `TOKEN=5` (1 char) and `KEY=abc` (3 chars) but catch real secrets (32+ chars typically)
   - Recommendation: 8 characters as minimum -- catches most real API keys while excluding short config values

2. **Additional connection string formats**
   - What we know: URI format (`scheme://user:pass@host`) is required
   - Recommendation: Also cover Redis (`redis://`) and MongoDB (`mongodb://`, `mongodb+srv://`) since they follow the same URI pattern and the regex already handles them

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `sanitize.js`, `commands.js`, `index.js`, `preview.js`
- Phase 10 summaries: Confirmed commands.js as shared constants module
- CONTEXT.md: User decisions locked

### Secondary (MEDIUM confidence)
- Common secret formats based on provider documentation patterns (OpenAI, GitHub, AWS, Stripe key formats are well-documented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero dependencies, pure RegExp, well-understood domain
- Architecture: HIGH - Expanding existing pattern (commands.js exports, sanitize.js consumes), established in Phase 10
- Pitfalls: HIGH - All pitfalls verified against actual codebase code

**Research date:** 2026-02-24
**Valid until:** Indefinite - internal codebase patterns, no external API dependencies
