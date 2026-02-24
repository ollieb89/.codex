# Phase 10: Shared Command Policy Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract all command-policy constants (blocked, allowlist, gray, destructive-highlight, mutating-pattern) from `dispatcher/sanitize.js`, `dispatcher/preview.js`, and `dispatcher/index.js` into a single `dispatcher/commands.js` module. All three files import from it. No new policy logic or capabilities are added — this is a pure consolidation.

</domain>

<decisions>
## Implementation Decisions

### Blocked command list
- Current set confirmed: `sudo`, `chown`, `chmod`, `mkfs`, `dd`
- Edit-to-proceed flow preserved — blocked commands can be revised by the user, then re-sanitized
- Hardcoded only — not user-configurable via config files
- The ALLOWLIST (`git`, `node`, `npm`, `cat`, `ls`, etc.) also moves into the shared module alongside blocked/gray

### Gray command list
- Current set confirmed: `git push`, `npm publish`, `pnpm publish`, `yarn publish`
- Matching changes from exact-string to **prefix-based** — `git push` catches `git push origin main`, `git push --force`, etc.
- `--force` flag is **consumed** by GSD (removed before passing command to shell) — avoids conflicts with commands that have their own `--force`
- Each gray command gets a **short reason string** explaining why it's gated (e.g., "Pushes to remote", "Publishes to registry") — displayed alongside the force prompt

### Destructive highlight terms
- Current set confirmed: `rm`, `truncate`, `drop`, `overwrite`, `--force`, `-rf`
- Highlights are a **separate concern** from mutating — visual warning vs confirmation gating
- Word-boundary matching only (`\bterm\b`) — prevents false positives like `transform` matching `rm`
- Applied to **all command previews** regardless of command tier (allowed, gray, blocked edit flow)

### Mutating pattern scope
- Current set confirmed: `rm`, `mv`, `cp`, `push`, `write`, `append`, `truncate`, `npm publish`, `git push`
- Two-tier approach preserved: explicit `mutating` flag from payload takes priority, regex pattern is the fallback
- Pattern matching switches to **word-boundary** (`\b`) — prevents false positives like `copyright` matching `cp` or `pushd` matching `push`
- **Gray gate takes precedence** when both gray and mutating apply to the same command — no double-gating (if `--force` was required and provided, skip the mutating confirm)

### Claude's Discretion
- Internal module structure (named exports, object grouping, etc.)
- How prefix-matching is implemented for gray commands
- How the short reason strings are associated with gray entries (map, object, etc.)
- Exact word-boundary regex construction for mutating pattern

</decisions>

<specifics>
## Specific Ideas

- Gray commands should feel like a "hey, this affects others" moment — short reason messages make that clear without being preachy
- The consolidated module should make it obvious where to add a new term (success criterion #3 from roadmap)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-shared-command-policy-foundation*
*Context gathered: 2026-02-24*
