# Pitfalls Research

**Domain:** CLI selection and security enhancements to existing CJS toolkit (v1.1.0)
**Researched:** 2026-02-24
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Auto-Reindexing Breaks Saved or In-Flight References

**What goes wrong:**
When entries are reindexed (e.g., after filtering or regeneration), any in-flight selection
number — whether hardcoded in a script, stored in `GS_DONE_SELECT`, or passed via `--select`
— now points to a different item. The user or script selected "3: Delete auth module" but
after reindex that slot is now "3: Run tests". The action silently executes the wrong thing.

**Why it happens:**
Reindexing re-assigns `.id` values based on array position. External callers (headless scripts,
CI pipelines, shell aliases) hold stale numeric references. The selector has no mechanism to
detect that the index set has changed between when the number was captured and when it is
consumed.

**How to avoid:**
- Never mutate IDs on a live entry set that may have headless consumers. Reindex only when
  producing a fresh menu render that will be immediately consumed in the same session.
- If reindexing is needed across sessions, tie the numeric ID to a stable content hash or
  label fingerprint so stale numbers fail loudly rather than silently misfire.
- In headless mode, validate not just the range but optionally the label at that position;
  emit a warning when `--select=N` is given but the label at N does not match any expected
  pattern (useful for debugging CI failures).

**Warning signs:**
- `--select` or `GS_DONE_SELECT` values are used in scripts that run across multiple
  invocations without regenerating the menu each time.
- Entry arrays are filtered or sorted after construction but before the headless check runs.
- Tests pass `--select=1` without asserting *which* entry was actually returned.

**Phase to address:** Numbered Selection Logic (InputSelector refinements, auto-reindexing)

---

### Pitfall 2: Secret Redaction False Negatives on Non-Standard Variable Names

**What goes wrong:**
The existing `redactSecrets` regex matches `*_API_KEY`, `*_TOKEN`, `*_SECRET`. Real credentials
frequently use names like `GITHUB_PAT`, `DB_PASSWORD`, `AUTH_PASS`, `STRIPE_SK_LIVE`, or
`OPENAI_KEY`. These sail through the preview unredacted and appear in terminal output, logs, or
screen recordings.

**Why it happens:**
The regex anchors on known suffixes (`API_KEY`, `TOKEN`, `SECRET`). Security-sensitive names
that do not end in those suffixes are invisible to the pattern. Developers extend the suffix
list reactively rather than proactively, so coverage always lags real usage.

**How to avoid:**
- Expand the suffix list: add `PASSWORD`, `PASSWD`, `PASS`, `PAT`, `CREDENTIAL`, `CREDENTIALS`,
  `KEY`, `CERT`, `PEM`, `PRIVATE_KEY`, `SK`, `PW`.
- Add a prefix allowlist for high-value services: `GITHUB_`, `STRIPE_`, `OPENAI_`, `AWS_`,
  `ANTHROPIC_`, `DATABASE_`, `DB_`, `REDIS_`.
- Consider a secondary heuristic: any `=` assignment where the RHS is longer than 20 characters
  and contains mixed case or alphanumeric with no spaces is a candidate for redaction (with a
  `LOW CONFIDENCE REDACTED` annotation rather than silent masking).
- Test redaction against a fixture corpus of real-world `.env` naming conventions.

**Warning signs:**
- Redaction tests only cover the happy-path patterns already in the regex.
- No test for `DB_PASSWORD`, `GITHUB_PAT`, `OPENAI_KEY`, `STRIPE_SK_LIVE`.
- Preview output in tests never asserts that specific non-standard names are masked.

**Phase to address:** Secure Dispatcher safety layer (secret redaction)

---

### Pitfall 3: Secret Redaction False Positives Break Legitimate Commands

**What goes wrong:**
An overly aggressive redaction pattern replaces parts of benign commands. For example,
`TOKEN_COUNT=5` becomes `TOKEN_COUNT=[REDACTED]`, or a file path like
`./scripts/api_key_rotation.sh` gets mutilated. The sanitized command shown in preview differs
so much from the real command that the user cannot tell what will execute.

**Why it happens:**
Broadening redaction patterns (see Pitfall 2) increases false positive risk. The current regex
matches `\b[A-Z0-9_]*(API_KEY|TOKEN|SECRET)=([^\s]+)` which is reasonably targeted, but
extending to `KEY` or `PASS` as suffixes catches too many env-like assignments that are not
credentials.

**How to avoid:**
- Require the RHS to look like a credential: min length 8, no path separators (`/`, `.`),
  no shell metacharacters that suggest it is a flag value rather than a secret.
- Only redact the value, never the key name or surrounding command structure. The preview must
  remain syntactically recognizable.
- Add a `--show-secrets` flag (or equivalent opt-in) for debugging contexts where full
  transparency is needed and the user has explicitly acknowledged the risk.
- Maintain a test fixture that asserts specific strings are NOT redacted (negative test cases).

**Warning signs:**
- Preview output contains `[REDACTED]` in unexpected positions (mid-path, inside flag values).
- The redacted command would be invalid if executed as shown.
- No negative-case tests in the redaction test suite.

**Phase to address:** Secure Dispatcher safety layer (secret redaction)

---

### Pitfall 4: Destructive Command Detection Fires on Benign Substrings

**What goes wrong:**
`highlightDestructive` uses word-boundary regex (`\b`) against terms like `rm`, `drop`,
`truncate`, `overwrite`. A command like `npm run format` does not match, but `drop-database`
highlights `drop`, `git remote` highlights nothing, yet `echo "This will truncate the file"`
highlights `truncate` even though `echo` itself is harmless. Users get warning fatigue and
stop reading highlights, defeating the purpose.

**Why it happens:**
The term list is checked with `\bterm\b` on the full command string without considering
command structure. The highlighter has no concept of "is this term a subcommand, a flag, a
string argument, or the actual executable?"

**How to avoid:**
- Apply destructive highlighting only to tokens that are in command-position (first token, or
  after `&&`, `||`, `;`, `|`), not to arbitrary substrings in arguments.
- Distinguish between destructive flag presence (`-rf`, `--force`, `--no-backup`) and
  destructive command names (`rm`, `dd`, `shred`). Flags in arguments to safe commands (e.g.,
  `git push --force`) are gray-area, not automatic blocks.
- Clamp the term list to high-signal items only; resist adding every possible dangerous word.
  More terms = more false positives = less user trust.

**Warning signs:**
- `echo "drop table users"` shows red highlights.
- `npm run truncate-old-logs` shows red highlights on `truncate`.
- Developers starting to ignore the red color because it triggers on non-destructive commands.

**Phase to address:** Secure Dispatcher safety layer (destructive command highlighting)

---

### Pitfall 5: Destructive Regex Misses Compound and Aliased Forms

**What goes wrong:**
The blocklist and gray-area detection uses simple prefix matching on the primary command token.
Commands like `npx rimraf dist`, `node -e "fs.rmSync(...)"`, `find . -exec rm {} \;`, or
`git clean -fd` are destructive but not caught because the primary token is not `rm`, `sudo`,
or a GRAY entry.

**Why it happens:**
`primaryCommand` takes only the first 1-2 tokens and checks those against static sets.
Compound commands, script runners, and inline node/bash expressions bypass the check entirely.

**How to avoid:**
- Scan all tokens for high-risk subcommands, not just the first. Flag commands where `rm`,
  `rmdir`, `shred`, `clean` appear anywhere in the token list.
- Detect `node -e` and `bash -c` as inherently unverifiable; route them through the edit/block
  path rather than allowing silently.
- Detect `find ... -exec` patterns as a signal to require explicit confirmation regardless of
  what follows `-exec`.
- Document the known gaps as explicit "not covered" notes in code comments so future
  maintainers do not assume full coverage.

**Warning signs:**
- `npx rimraf dist` passes `sanitizeAction` with status `allow`.
- `find . -exec rm {} \;` is not blocked despite deleting files.
- `node -e "require('fs').unlinkSync('important.json')"` goes straight to execution.

**Phase to address:** Secure Dispatcher safety layer (destructive command detection)

---

### Pitfall 6: `--select` Flag Parsing Fails on `=` Syntax with Extra Characters

**What goes wrong:**
`--select=10` is parsed by splitting on the first `=`, giving `['--select', '10']`. But
`--select=10 ` (trailing space), `--select=10abc` (non-numeric suffix), or `--select=` (empty
RHS) all produce values that `parseInt` accepts partially or silently. `parseInt('10abc', 10)`
returns `10`; `parseInt('', 10)` returns `NaN`. The first case silently accepts a malformed
value; the second produces an error message that is confusing in context.

**Why it happens:**
`parseInt` is tolerant of leading-numeric strings by design. The current code does not validate
that the entire parsed token is a clean integer after parsing.

**How to avoid:**
- After `parseInt`, verify that `String(parsed) === selectionRaw.trim()` (i.e., the full
  string round-trips cleanly). If not, treat it as invalid and exit non-zero with a message.
- Reject non-integer strings before passing to `parseInt`: test with `/^\d+$/` first.
- Cover `--select=`, `--select=0abc`, `--select=-1`, `--select=1.5` as explicit test cases.

**Warning signs:**
- Test suite only covers `--select=1` and `--select=5` (valid values).
- No test for `--select=1abc` or `--select=` (empty).
- `parseInt('1abc', 10) === 1` passes silently in CI.

**Phase to address:** Headless integration (--select flag support)

---

### Pitfall 7: `GS_DONE_SELECT` Env Variable Picked Up from Unrelated Parent Process

**What goes wrong:**
`GS_DONE_SELECT=2` is set in the shell environment from a prior invocation, a test harness, or
a CI variable that happens to have the same name. The next interactive invocation immediately
skips the menu and runs item 2 without prompting, confusing the developer who expects
an interactive session.

**Why it happens:**
Environment variables are inherited across all child processes. Once set in a shell session,
`GS_DONE_SELECT` persists until explicitly unset. Any invocation of the toolkit in that shell
will behave headlessly.

**How to avoid:**
- Print a clear stderr notice when headless mode is activated via the env variable:
  `[Headless] GS_DONE_SELECT=2 detected — skipping interactive menu`.
- In the README and any quickstart docs, show the env variable as a one-shot pattern:
  `GS_DONE_SELECT=2 gsd ...` rather than `export GS_DONE_SELECT=2`.
- Consider consuming and unsetting (or ignoring after one use) the env variable to prevent
  cross-invocation leakage, or at minimum document that it is sticky.

**Warning signs:**
- Developer reports interactive menu skipping unexpectedly.
- `GS_DONE_SELECT` appears in CI environment variable listings.
- Tests that `export` the env variable and do not `unset` it afterwards contaminate subsequent
  test cases.

**Phase to address:** Headless integration (--select flag and GS_DONE_SELECT env var)

---

### Pitfall 8: Unicode Width Calculation Diverges from Terminal Rendering

**What goes wrong:**
The custom `stringWidth` implementation uses code-point range checks. It correctly handles
CJK ideographs but misses wide emoji sequences (multi-codepoint with ZWJ), variation selectors,
flags (regional indicator pairs), and combining characters. A label with `🇬🇧` (flag emoji,
two regional indicators) is measured as 4 cells but renders as 2 on most modern terminals. The
menu alignment breaks: the right gutter is offset by 2 columns for that row.

**Why it happens:**
Unicode width is genuinely hard. Emoji sequences are defined by Unicode's EAW (East Asian Width)
data combined with ZWJ sequence tables. A manual range check cannot track the full spec without
embedding the Unicode data tables.

**How to avoid:**
- For the current CJS/Node 20 environment, use `string-width` (npm) which bundles current
  Unicode data tables. The package is lightweight (no build step, pure JS), well-maintained,
  and handles ZWJ sequences and regional indicators correctly.
- If `string-width` is not acceptable as a dependency, document the known gaps explicitly and
  test with the specific emoji in use. Do not claim full Unicode support.
- In tests, include at minimum: plain ASCII, CJK (Chinese), Korean syllable block, flag emoji
  (two regional indicators), ZWJ emoji (`👨‍💻`), variation selector-16 (`☎️`).

**Warning signs:**
- `stringWidth('🇬🇧') === 4` when it should be 2 on most terminals.
- `stringWidth('👨‍💻') === 8` (counts each codepoint separately) when it renders as 2.
- Menu rows with emoji labels are misaligned compared to rows with plain ASCII labels.

**Phase to address:** UI Polish (Unicode-aware padding and truncation)

---

### Pitfall 9: Truncation Splits Inside a Multi-Byte or Multi-Codepoint Sequence

**What goes wrong:**
`truncateLabel` iterates by `charCodeAt` index and calls `stringWidth` on each individual
character. For surrogate pairs (emoji above U+FFFF stored as two JS char codes), calling
`charCodeAt(i)` returns the high surrogate, which does not fall in the CJK range and is counted
as width 1. The corresponding low surrogate at `i+1` is also counted as width 1. The emoji is
counted as 2 × width-1 = 2, which may be correct, but the split can happen between the two
surrogates if the target width falls exactly there — producing a broken Unicode sequence in the
output string.

**Why it happens:**
JavaScript strings are UTF-16. Iterating by code unit index (`charCodeAt`) rather than code
point (`codePointAt` or `for...of`) exposes surrogate pair internals to the width loop.

**How to avoid:**
- Iterate by code point using `for...of` or `Array.from(str)` so each logical character is
  processed as one unit.
- Never split a string at a position between surrogate pairs. If using an index-based loop,
  check for high surrogates and always advance by 2 when one is encountered.
- Add a test that truncates a string ending in a 4-byte emoji to confirm no broken surrogate
  in the output.

**Warning signs:**
- Labels containing emoji outside BMP (`🚀` U+1F680, `👍` U+1F44D, etc.) display garbled
  characters at truncation boundaries.
- `truncateLabel` output fails `Buffer.from(label, 'utf8')` without error but the visual
  rendering shows a replacement character.

**Phase to address:** UI Polish (Unicode-aware padding and truncation)

---

### Pitfall 10: `process.stdout.columns` Undefined Causes `maxWidth` Calculation to Fail

**What goes wrong:**
In non-TTY contexts (pipes, CI, test runners), `process.stdout.columns` is `undefined`.
`Math.max(40, undefined - 12)` evaluates to `Math.max(40, NaN)` which is `NaN`. All width
calculations that depend on `maxWidth` then produce `NaN`, causing truncation to never fire
or to always truncate to 0 characters.

**Why it happens:**
`process.stdout.columns` is only defined when stdout is a real TTY. Piping to `grep`, running
in a CI environment, or running under `node --test` all result in `undefined`.

**How to avoid:**
- Always default before use: `const columns = (output.columns || process.stdout.columns) ?? 80`.
- Assert that `maxWidth` is a finite positive number before passing to any width calculation.
  If it is not, fall back to 80.
- Add a test case where `output.columns` is explicitly `undefined` and assert the menu renders
  at width 80 fallback.

**Warning signs:**
- Tests pass when run interactively but fail or produce empty output in CI.
- `formatMenuItem` returns empty string or `NaN. Label` in non-TTY test environments.

**Phase to address:** UI Polish (Unicode-aware padding and truncation)

---

### Pitfall 11: Preview Shows Redacted Command but Executes Original With Secrets Visible in `ps` Output

**What goes wrong:**
`redactSecrets` returns the redacted string for display, but `dispatchSelection` passes the
original `action.command` (not `sanitized.sanitizedCommand`) to the runner. This is the correct
behaviour for execution — secrets must survive to the process. However, if the runner uses
`exec(command, ...)`, the full command with secrets is visible in `ps aux` output on Linux for
the duration of the child process.

**Why it happens:**
Shell execution via `child_process.exec` passes the command as a string argument to `/bin/sh -c`.
On Linux, the command appears in `/proc/<pid>/cmdline` and `ps` for the process lifetime. This
is a TOCTOU-style exposure: the secret is briefly visible system-wide.

**How to avoid:**
- For commands that require injecting secrets, prefer passing them via environment variables
  rather than command-line arguments. Document this as a best practice in the phase.
- Add a note in the sanitizer that `exec`-based execution exposes command args to `ps`. For
  the current v1.1.0 scope, this is an accepted limitation, but it should be documented in
  code comments near the runner.
- Do not suppress this finding — surface it to users in the phase summary as a known limitation.

**Warning signs:**
- Commands of the form `curl -H "Authorization: Bearer $TOKEN"` where the token is substituted
  into the command string rather than an env var.
- Secret patterns appear in the `command` field of the payload rather than in an `env` map.

**Phase to address:** Secure Dispatcher safety layer (secret redaction) — document as known limitation

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Manual Unicode range check instead of `string-width` | Zero new dependency | Misaligns on ZWJ/flag emoji; requires manual updates when Unicode spec advances | Only if labels are guaranteed to be ASCII + basic CJK; never for general-purpose use |
| Redaction regex suffix list only | Simple to read | Misses non-standard credential names (`PAT`, `PASSWORD`, `SK`) | Only if scope is narrowly controlled and tested against real env files |
| `parseInt` without full-string validation | Less code | Silently accepts `10abc` as `10`; confusing to debug in headless CI | Never — one-line validation with `/^\d+$/` costs nothing |
| Destructive detection on full command string | Simple implementation | Highlights benign substring matches; trains users to ignore warnings | Never for UX-facing output — misleads users and degrades safety signal |
| Static blocklist/allowlist without `npx`/`node -e` coverage | Covers 80% of cases | Misses script runner + inline eval; gives false confidence | Acceptable only if paired with explicit documentation of what is not covered |

---

## Integration Gotchas

These are specific integration risks when wiring the new v1.1.0 components into the existing v1.0 CJS modules.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `sanitizeAction` → `dispatchSelection` | Using `sanitized.sanitizedCommand` for both preview AND execution | Use `sanitized.sanitizedCommand` for preview only; pass `action.command` (original) to runner |
| `handleHeadless` → `selectOption` | Calling `handleHeadless` after constructing entries from a reindexed set | Ensure entry IDs match the numeric positions displayed; construct once, do not reindex between headless check and menu render |
| `stringWidth` in `truncateLabel` | Passing ANSI-colored strings to `stringWidth` without stripping first | Strip ANSI before all width calculations; re-apply color after truncation if needed |
| `formatMenuItem` → headless menu dump | Headless renders menu at hardcoded width 80 while interactive uses `output.columns` | Share a single width-resolution helper used by both paths |
| `highlightDestructive` in `renderPreview` | Adding new terms to `DESTRUCTIVE_TERMS` without testing against `echo`, `npm run *` | Test new terms against a corpus of benign commands before adding |
| `--select` parsing in `handleHeadless` | Splitting on `=` then trusting `parseInt` without full-string validation | Validate full token is numeric before `parseInt` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `stringWidth` per-character in a loop for every menu render | Slow rendering of large menus | Cache width results per label; or compute once per entry on construction | Menus with >50 entries or labels with many Unicode characters |
| `redactSecrets` with many regex patterns applied per-command on every dispatch | Noticeable pause before preview renders | Compile patterns once at module load (already done); keep pattern count <20 | If pattern list grows beyond 30–40 replacements |
| `realpathSync` called for every path token in a command | File I/O on every sanitize call | Already present in current code; acceptable for typical commands; cap token scan at 20 tokens | Commands with many path-like tokens (unlikely in practice) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Redacting secrets in preview but logging unredacted command in error output | Credential exposure in error logs | Ensure all error paths (`'blocked'`, `'force-dispatch required'`, edit path) use `sanitizedCommand` for display, never raw `action.command` |
| Treating `status: 'allow'` from sanitizer as "safe to execute without confirmation" for mutating commands | Silent file deletion, git commits pushed without review | Mutating flag check is independent of sanitizer allowlist; both must pass before execution proceeds without confirmation |
| Workspace boundary check using `path.resolve` on symlinked paths | Symlink escape: `./safe-link` → `/etc/passwd` | Already uses `realpathSync` — ensure this is not removed in refactors; add test for symlink traversal |
| Using `exec` with string interpolation for paths from payload | Shell injection via crafted path tokens containing backticks or `$()` | Sanitize for shell metacharacters in path tokens; consider `execFile` or `spawn` with args array for any command derived from user/AI input |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Headless mode activates silently when `GS_DONE_SELECT` is set from prior session | User expects interactive menu; wrong item runs | Always emit `[Headless] GS_DONE_SELECT=N detected` to stderr on activation |
| Truncation hides the only distinguishing part of long labels | User cannot tell options apart | Ensure Phase 8 preview shows full label/command so selecting either way reveals the full text |
| Destructive highlight fires on harmless echo/log commands | Warning fatigue; real warnings ignored | Restrict highlighting to command-position tokens only |
| Preview shows `[REDACTED]` value but user cannot verify what will actually execute | Trust erosion; user cannot audit the command | Offer `--show-secrets` escape hatch for trusted local use; document that the original runs |
| `0: Cancel/Back` always shown at bottom even in headless mode | CI logs contain noise | Keep it — the consistent structure is what makes headless parsing reliable |

---

## "Looks Done But Isn't" Checklist

- [ ] **Auto-reindexing:** Verify that headless `--select=N` values reference the same entry
  after reindex — test with a filtered entry list, not just a static one.
- [ ] **Secret redaction:** Run the redaction function against a fixture of 10+ real-world
  `.env` variable names including `DB_PASSWORD`, `GITHUB_PAT`, `OPENAI_KEY`, `STRIPE_SK_LIVE`.
  Assert each is masked. Assert `TOKEN_COUNT=5` is NOT masked.
- [ ] **Destructive detection:** Test `echo "rm -rf"`, `npm run truncate-logs`, and
  `git clean -fd` against `highlightDestructive`. Confirm `echo` case does not trigger red
  on `rm -rf` in argument position.
- [ ] **`--select` parsing:** Add tests for `--select=1abc`, `--select=`, `--select=-1`,
  `--select=1.5`, `--select 0`, `GS_DONE_SELECT=0`.
- [ ] **Unicode width:** Add tests for flag emoji (`🇬🇧`), ZWJ sequences (`👨‍💻`), and variation
  selector (`☎️`). Confirm alignment is preserved in `formatMenuItem` output.
- [ ] **`columns` undefined:** Run `formatMenuItem` and `selectOption` with
  `output.columns = undefined`. Confirm fallback to 80-column width, no `NaN` in output.
- [ ] **Symlink escape:** Add test where a payload path is a symlink pointing outside `cwd`.
  Confirm `sanitizeAction` blocks it.
- [ ] **Env leakage:** Confirm test suite unsets `GS_DONE_SELECT` between test cases.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale `--select` ran wrong item via reindex | MEDIUM | Restore from `git` if mutating; add label-validation assertion to headless consumer scripts |
| Secret leaked through non-standard variable name | HIGH | Rotate the credential immediately; extend redaction pattern list; audit logs for exposure window |
| Destructive highlight false positive causes user to miss real warning | LOW | Narrow term list to command-position only; re-educate via changelog note |
| `columns` undefined corrupts menu rendering in CI | LOW | Add `?? 80` guard; redeploy; CI output is cosmetic-only if selection still works |
| Unicode misalignment in production terminal | LOW | Pin `string-width` or add missing ranges; alignment is cosmetic, functionality unaffected |
| Surrogate split produces broken character at truncation boundary | LOW | Switch loop to `for...of` codepoint iteration; no functional regression expected |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auto-reindexing breaks saved references | Numbered Selection Logic (InputSelector refinements) | Test headless with filtered/reordered entry list; assert selected item identity |
| Secret redaction false negatives | Secure Dispatcher — secret redaction | Fixture test: 10+ non-standard env names, all masked |
| Secret redaction false positives | Secure Dispatcher — secret redaction | Negative fixture test: `TOKEN_COUNT=5`, path strings, not masked |
| Destructive detection substring false positive | Secure Dispatcher — destructive highlighting | Test `echo "rm -rf"`, `npm run truncate-*`; confirm no false red |
| Destructive detection misses compound forms | Secure Dispatcher — destructive highlighting | Test `npx rimraf`, `find -exec rm`, `node -e fs.unlinkSync`; confirm blocked or flagged |
| `--select` partial parse accepts `10abc` | Headless integration | Unit tests for malformed `--select` values; exit 1 with message |
| `GS_DONE_SELECT` env leaks across sessions | Headless integration | Stderr notice on activation; docs show one-shot pattern |
| Unicode width diverges from terminal (ZWJ/flags) | UI Polish — Unicode-aware padding | Tests with flag emoji, ZWJ sequences; visual alignment check |
| Surrogate split at truncation boundary | UI Polish — Unicode-aware truncation | Test truncating string ending in 4-byte emoji; assert no broken surrogate |
| `columns` undefined produces NaN widths | UI Polish — Unicode-aware padding | Test with `columns = undefined`; assert 80-column fallback |
| `ps` exposes secrets during exec | Secure Dispatcher — known limitation | Code comment + phase summary note; no test needed |

---

## Sources

- Node.js `child_process.exec` documentation — command-line argument visibility via `ps`
- Unicode Standard Annex #11 (East Asian Width) — basis for wide character detection
- `string-width` npm package source — reference implementation for correct Unicode width
- JavaScript `parseInt` MDN reference — partial parse behaviour confirmed
- Observed patterns from real `.env` files: `DB_PASSWORD`, `GITHUB_PAT`, `OPENAI_KEY`,
  `STRIPE_SK_LIVE` do not match standard suffix patterns
- Node.js `process.stdout.columns` — undefined in non-TTY confirmed in Node.js docs
- Existing v1.0 codebase analysis: `sanitize.js`, `preview.js`, `headless.js`, `format.js`,
  `index.js` (dispatcher and selector)

---
*Pitfalls research for: CLI selection and security enhancements (v1.1.0 milestone)*
*Researched: 2026-02-24*
