# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- None configured; no automated test runner or harness present

**Assertion Library:**
- Not applicable (no tests checked in)

**Run Commands:**
```bash
# No standard test command; manual validation only
python -m tomllib commands/sg/build.toml >/dev/null   # Example syntax check for TOML
```

## Test File Organization

**Location:**
- No `tests/` or `__tests__/` directories; repository primarily holds prompts/templates

**Naming:**
- No `.test.*` files present; future tests should use `<module>.test.js` near sources in `get-shit-done/bin/lib/`

**Structure:**
```
(get-shit-done/bin/lib/)   # Potential location for future unit tests alongside modules
```

## Test Structure

**Suite Organization:**
- Not defined; follow standard `describe`/`it` (Jest/Vitest) if added

**Patterns:**
- Prefer arrange/act/assert comments for clarity when introducing tests

## Mocking

**Framework:**
- None in repo; future tests should mock git and filesystem interactions around `execGit` and state loaders

**What to Mock:**
- External commands (`git`, `npx`), filesystem writes under `.planning/`, and environment variables for MCP/Brave integrations

**What NOT to Mock:**
- Pure data transforms (e.g., phase normalization helpers)

## Fixtures and Factories

**Test Data:**
- Not present; consider lightweight fixtures for STATE/ROADMAP files if tests are added

## Coverage & Quality Gates

- No coverage tools configured; quality relies on manual review and workflow templates

---

*Testing analysis: 2026-02-24*
*Add this file to a test plan if automated tests are introduced*
