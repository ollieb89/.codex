# Numbered Options Schema

- Return a **plain-text numbered list** only. Each line must start with `1. `, `2. `, ... (no bullets, no prose).
- **No filler** before or after the list. Do not add greetings, explanations, or summaries.
- **Start at 1 and increment by 1**. No gaps, no duplicate numbers.
- **One line per option.** Keep it concise; avoid multi-line wrapping.
- If you deviate from this format, you will be retried once with the reminder: "Ensure unique numbering and no filler text."

Example (valid):
```
1. Refactor login.js for dependency injection
2. Add selector helper tests for zero-input
3. Document retry behavior for numbered lists
```
