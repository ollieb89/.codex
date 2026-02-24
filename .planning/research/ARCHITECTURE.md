# Architecture Research

**Domain:** Numbered CLI selection UX for AI-assisted workflows  
**Researched:** 2026-02-24  
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────┐
│                 Prompts Layer                │
│  • System prompt enforces numbered schema    │
│  • Agent wrappers validate/normalize output  │
└───────────────┬──────────────────────────────┘
                │ numbered options
┌───────────────▼──────────────────────────────┐
│              Selector Helper                 │
│  • Renders numbered list                     │
│  • Parses input (int, 0-to-exit)             │
│  • Returns {index, label, payload}           │
└───────────────┬──────────────────────────────┘
                │ selection event
┌───────────────▼──────────────────────────────┐
│             Action Dispatcher                │
│  • Maps selection → action (cmd/diff/flow)   │
│  • Applies safety interlocks (confirm/dry)   │
└───────────────┬──────────────────────────────┘
                │ result/feedback
┌───────────────▼──────────────────────────────┐
│              Logging/Telemetry               │
│  • Optional audit of options + pick          │
└──────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Prompt Schema | Force numbered output, no filler | System prompt snippet + post-check for `^\d+\.` lines |
| Normalizer | Convert AI output to array of {label,payload} | Try JSON parse; else regex numbered lines |
| Selector | Render list, accept numeric input with 0-exit | readline wrapper with validation + optional color |
| Dispatcher | Execute mapped action with safety | Switch on action type (shell/diff/flow); confirm for mutating ops |
| Logger | Record options/selection for debugging | Optional write to stdout/log file when enabled |

## Recommended Project Structure

```
get-shit-done/
└── bin/lib/
    ├── prompts/           # prompt snippets (numbered schema)
    ├── selector.js        # render/parse helper
    ├── dispatcher.js      # action routing + safety
    └── utils/parse.js     # normalization (JSON or numbered text)
```

### Structure Rationale

- Keep selector/dispatcher isolated so commands can import without duplication.
- Prompt snippets live alongside other shared prompt text for consistency.
- Parsing utilities separated to enable unit tests and reuse in agents or CLI.

## Architectural Patterns

### Pattern 1: Schema-first prompt + post-validate

**What:** Enforce numbered list via system prompt and reject if pattern missing.  
**When to use:** Any AI-generated option list.  
**Trade-offs:** Adds one validation branch but prevents downstream crashes.

### Pattern 2: Dual-path normalization (JSON → text)

**What:** Prefer JSON array if present; else parse numbered lines.  
**When to use:** Mixed agents/models that sometimes return JSON.  
**Trade-offs:** Slight overhead; improves robustness.

### Pattern 3: Safety-interlocked dispatcher

**What:** Wrap execution with confirm/dry-run for mutating actions.  
**When to use:** Shell commands, patch application.  
**Trade-offs:** Adds extra prompt; necessary to avoid accidental damage.

## Data Flow

```
[AI output] → Normalizer → Selector (render/input) → Dispatcher → [Action result]
                               │
                               └→ 0 → exit/return
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Few options | Simple render; no pagination needed |
| Many options (50+) | Add truncation/paging hooks; allow filter flag |
| Headless/CI | Support preselected number via flag/env; skip readline |

### Scaling Priorities

1. First bottleneck: long option text wrapping → add truncation + full-text on demand.  
2. Second bottleneck: accidental execution → keep confirmation for mutating actions.

## Anti-Patterns

### Anti-Pattern 1: Trusting conversational output

**Why it's wrong:** Non-deterministic; breaks parsing.  
**Do this instead:** Hard schema + validation + retry/fallback.

### Anti-Pattern 2: Coupling selector to a single command

**Why it's wrong:** Duplicated logic across workflows.  
**Do this instead:** Export reusable helper and dispatcher.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required | N/A | Keep offline; no external APIs needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Prompts ↔ Selector | Text/JSON options | Selector should not care about agent identity |
| Selector ↔ Dispatcher | Struct `{index,label,payload}` | Payload may hold command/diff identifiers |

## Sources

- Copilot CLI, Aider selection flows (behavioral reference)
- Existing Codex CLI patterns for prompts and CJS helpers

---
*Architecture research for: Numbered CLI selection UX*  
*Researched: 2026-02-24*
