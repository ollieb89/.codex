# Requirements: Codex Base Optimization

**Defined:** 2026-02-24
**Core Value:** Codex runs lean and predictable: the right agent/prompt triggers the right behavior with minimal friction.

## v1.1 Requirements

Requirements for v1.1.0 Standardize Selection & Security. Each maps to roadmap phases.

### Security & Dispatch

- [ ] **SEC-01**: Dispatcher redacts provider-specific secrets (OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Stripe `sk_live_*`, PEM blocks, connection strings) in command previews
- [ ] **SEC-02**: Secret patterns are ordered specific-to-generic so prefix-based detection fires before generic fallback
- [ ] **SEC-03**: Shared `commands.js` constants module eliminates independent destructive/mutating term definitions across sanitize, preview, and dispatcher

### Selection Normalization

- [ ] **SEL-01**: AI-generated numbered lists are normalized to contiguous 1..N IDs before render, regardless of source numbering
- [ ] **SEL-02**: Normalizer preserves original label text and metadata while reassigning IDs
- [ ] **SEL-03**: `--select` flag and `GS_DONE_SELECT` reference post-normalization IDs consistently

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Dispatch Hardening

- **DSP-01**: Extended destructive verb list (delete, destroy, wipe, -rf, --hard, purge, unlink)
- **DSP-02**: Configurable destructive-verb injection API for caller extension

### UI Polish

- **UIP-01**: Intl.Segmenter-based Unicode padding for correct emoji/ZWJ width
- **UIP-02**: process.stdout.columns ?? 80 fallback for non-TTY contexts
- **UIP-03**: string-width v4.x evaluation if alignment bugs surface

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fuzzy/substring match for --select | Non-deterministic; breaks CI pipelines silently |
| Entropy-based secret detection | High false-positive rate on base64/hash content |
| Per-provider secret type annotation in output | Leaks info about which credentials are present |
| Persistent redaction logs | Logs containing originals are a secret leak vector |
| Interactive TUI arrow-key navigation | Fails in headless/SSH; numbered list is always compatible |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEL-01 | — | Pending |
| SEL-02 | — | Pending |
| SEL-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 6 total
- Mapped to phases: 0
- Unmapped: 6 ⚠️

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
