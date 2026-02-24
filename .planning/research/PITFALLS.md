# Pitfalls Research

**Domain:** Numbered CLI selection UX for AI-assisted workflows  
**Researched:** 2026-02-24  
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Conversational AI output breaks parsing

**What goes wrong:** Options return as prose/bullets; selector fails or misorders items.  
**Why it happens:** Prompt not strict; no post-validation.  
**How to avoid:** Enforce numbered schema in system prompt; reject/normalize unless lines match `^\d+\.`; fall back to retry.  
**Warning signs:** Lines without leading numbers; “Here are some options” filler.  
**Phase to address:** Prompt/schema setup.

---

### Pitfall 2: Off-by-one and 0-handling bugs

**What goes wrong:** `0` executes first item or exits incorrectly; ranges misaligned with displayed numbers.  
**Why it happens:** Using array indexes instead of displayed numbers; missing guard for `0`.  
**How to avoid:** Map displayed number to index explicitly; treat `0` as cancel; clamp and validate input.  
**Warning signs:** Negative or large inputs not rejected; 0 triggers action.  
**Phase to address:** Selector implementation.

---

### Pitfall 3: Unsafe auto-execution

**What goes wrong:** Selecting an option runs shell/diff without confirmation; accidental edits.  
**Why it happens:** Dispatcher wired directly to execution without safety interlocks.  
**How to avoid:** Require confirm/dry-run for mutating actions; show summary before apply; allow silent mode only for read-only actions.  
**Warning signs:** No preview of command/diff; no abort path after selection.  
**Phase to address:** Dispatcher/safety.

---

### Pitfall 4: Untrusted payloads in actions

**What goes wrong:** AI-provided command text contains harmful flags; diff applies to wrong files.  
**Why it happens:** Passing AI text straight to shell/patch.  
**How to avoid:** Sanitize payloads (strip ANSI/markdown), restrict command allowlist, show preview, optionally require user edit/confirm.  
**Warning signs:** Commands with redirections or background ops; diffs outside workspace.  
**Phase to address:** Dispatcher validation.

---

### Pitfall 5: Long option labels break layout

**What goes wrong:** Wrapped lines misalign numbers; selection text unreadable.  
**Why it happens:** No truncation or width handling.  
**How to avoid:** Truncate with ellipsis; allow detail-on-demand; ensure numbers are left-padded consistently.  
**Warning signs:** Options wrap onto multiple lines; users mis-pick.  
**Phase to address:** Selector rendering.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping confirmation | Faster path | Risky execution | Only for read-only actions with explicit flag |
| Parsing only numbered text (no JSON path) | Simpler code | Breaks when agents emit JSON arrays | Acceptable for first cut if schema enforced strictly |
| No telemetry/logging | Less code | Harder debugging when selections misfire | Acceptable if reproducible locally; add hook later |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Shell command execution | Passing raw AI command | Sanitize, display, confirm, allow dry-run |
| Patch application | Applying directly | Show diff summary; confirm path scope |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering huge lists (>100) | Slow redraw; unreadable | Add pagination/filter | Large suggestion sets (rare) |
| Excessive color in unsupported terminals | Gibberish output | Detect TTY; allow `--no-color` | Non-TTY/headless |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mixing numbering styles (0-based, 1-based) | Mis-selections | Always display 1–N and reserve 0 for exit |
| Hidden cancel path | Users forced to Ctrl+C | Always show “0: Cancel/Back” |
| No feedback on invalid input | Confusion | Show clear error and re-prompt |

## "Looks Done But Isn't" Checklist

- [ ] Schema enforced and validated (reject non-numbered output)  
- [ ] 0-to-exit behavior tested (unit + manual)  
- [ ] Confirmation shown for mutating actions (shell/diff)  
- [ ] Non-numeric and out-of-range inputs handled cleanly  
- [ ] Long labels truncated with full text available if needed  

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong option executed | MEDIUM | Show log of options/pick; rerun with correct selection; revert actions if possible |
| Parser fails on unexpected output | LOW | Fallback to retry AI with stricter prompt; log raw output |
| Accidental command run | HIGH | Stop process; revert changes; add allowlist/confirm in dispatcher |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Conversational output | Prompt/schema phase | Unit test regex + manual retry path |
| Off-by-one/0 handling | Selector implementation | Tests for 0, negative, >N, strings |
| Unsafe auto-exec | Dispatcher | Dry-run + confirm demonstrated |
| Untrusted payloads | Dispatcher | Allowlist/sanitize checks |
| Long label layout | Selector render | Visual check with long strings |

## Sources

- Copilot CLI/Aider mis-selection anecdotes; observed command previews
- Common readline parsing bugs in Node CLIs

---
*Pitfalls research for: Numbered CLI selection UX*  
*Researched: 2026-02-24*
