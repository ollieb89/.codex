# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**External APIs:**
- Brave Search - Optional web search in `get-shit-done/bin/lib/commands.cjs`
  - Integration method: HTTP calls via Brave SDK invoked from Node helper
  - Auth: `BRAVE_API_KEY` env var or key file resolved by `get-shit-done/bin/lib/config.cjs`
  - Rate limits: dependent on Brave account; no local throttling

**Automation Services:**
- MCP servers (`settings.json`) launched via `npx` (`sequential-thinking`, `context7`, `playwright`)
  - Integration method: CLI invocation, no SDK pinned in repo
  - Auth: provider-specific env vars (`TWENTYFIRST_API_KEY`, `MORPH_API_KEY`) required when enabling optional servers

## Data Storage

**Databases:**
- None; all state is file-based in `.planning/`, `sessions/`, and `logs/`

**File Storage:**
- Local filesystem only; no cloud buckets configured

**Caching:**
- None implemented

## Authentication & Identity

**Auth Provider:**
- None; interactions are local CLI operations with no user identity layer

## Monitoring & Observability

**Error Tracking:**
- None; errors surface in CLI output and stored logs under `logs/`

**Analytics:**
- None

**Logs:**
- Local text logs in `logs/` and session transcripts in `sessions/YYYY/MM/DD/*.jsonl`

## CI/CD & Deployment

**Hosting:**
- Not applicable; repository is a local prompt/tooling bundle

**CI Pipeline:**
- None present; any validation is manual via CLI helpers (e.g., `python -m tomllib` for TOML)

## Environment Configuration

**Development:**
- Optional `BRAVE_API_KEY` to enable search
- MCP server binaries pulled on-demand via `npx`; network access required when starting them
- No `.env` files tracked; secrets expected via environment or local key files

**Production:**
- Not deployed; integrations are opt-in during local execution

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integrations analysis: 2026-02-24*
*Update when enabling new external services*
