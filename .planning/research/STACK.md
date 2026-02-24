# Stack Research

**Domain:** Numbered CLI selection UX for AI-assisted workflows  
**Researched:** 2026-02-24  
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20.x | Runtime for CLI helpers and prompt orchestration | Matches existing Codex scripts; stable LTS; no extra toolchain needed |
| Built-in `readline` | N/A | Console input handling for numbered prompts | Zero-dependency; works in sandboxed/headless shells |
| `fs` / `JSON` | N/A | Persist selection defaults or history if needed | Already available; keeps footprint minimal |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `colorette` | 2.x | Colorize numbers vs text for quick scanning | Optional; when terminals support ANSI and UX needs emphasis |
| `strip-ansi` | 7.x | Clean AI output before numeric parsing | Use if upstream adds styling/markdown |
| `zod` (or `valibot`) | 3.x | Validate structured AI responses (arrays/objects) | When consuming JSON-formatted options, not plain text |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | Quick unit tests for parser/selector helpers | Ships with Node 20; no extra deps |
| `eslint` (optional) | Catch unhandled input/async pitfalls | Only if linting already present; otherwise skip to stay lean |

## Installation

```bash
# Optional UX deps
npm install colorette@2 strip-ansi@7

# Optional validation
npm install zod@3
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `readline` | `inquirer` | Only if you need multi-select/search; heavier and adds prompts we don’t need |
| `colorette` | `chalk` | Chalk is fine but larger; colorette is tiny and CJS-friendly |
| Plain strings | `table`/`cliui` | Use tables only when options need columns; numbered lines are clearer |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Free-form AI HTML/markdown rendering | Hard to parse consistently; brittle across terminals | Enforce plain numbered text schema |
| Heavy TUI frameworks (blessed/ink) | Overkill for simple selection; flaky in headless CI | Stick to readline + optional color |

## Stack Patterns by Variant

**If running non-interactive:** accept preselected number via env/flag; log numbered options for audit; skip readline.  
**If AI returns JSON arrays:** parse JSON first, validate (zod), then render numbered list; fall back to regex extraction when JSON absent.  
**If outputs may contain ANSI/markdown:** normalize with strip-ansi and simple markdown strip (e.g., remove `*`/`-` bullets) before parsing numbers.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| colorette@2 | Node 20 | Works in CJS; zero config |
| strip-ansi@7 | Node 14+ | Safe for cleaning AI outputs |

## Sources

- Observed patterns from Copilot CLI/Aider numeric selection flows
- Node.js readline, colorette, strip-ansi docs (compatibility verified)

---
*Stack research for: Numbered CLI selection UX*  
*Researched: 2026-02-24*
