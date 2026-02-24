const {
  VALID_NUMBERED_LINE,
  RETRY_BUDGET,
  DUPLICATE_HINT,
  EMPTY_HINT,
} = require('./schema.js');

function stripAnsi(input) {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    ''
  );
}

/**
 * Strip markdown formatting from numbered line prefixes only.
 * Preserves label text intact (SEL-02).
 * Handles: **1.** text, `1.` text, *1.* text
 * Does NOT strip markdown from the label portion.
 * @param {string} input raw text
 * @returns {string} text with number prefixes cleaned
 */
function stripSimpleMarkdown(input) {
  return input
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      // Strip bold/italic/backtick wrapping around number prefix only
      // e.g., "**1.** Bold option" -> "1. Bold option"
      // e.g., "`1.` Code option" -> "1. Code option"
      // e.g., "*1.* Italic option" -> "1. Italic option"
      return trimmed.replace(/^(?:\*{1,2}|`)?(0*\d+\.)(?:\*{1,2}|`)?\s/, '$1 ');
    })
    .join('\n');
}

function parseJsonOptions(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item, idx) => {
        if (typeof item === 'string') {
          return {
            num: idx + 1,
            text: item.trim(),
            payload: undefined,
            metadata: undefined,
          };
        }
        if (item && typeof item === 'object') {
          const label = String(item.label || item.title || item.text || '').trim();
          const payload = item.payload || item.command ? { command: item.command, ...item.payload } : item.payload || null;
          return {
            num: idx + 1,
            text: label || (item.command ? String(item.command) : ''),
            payload: payload || null,
            metadata: item.metadata || null,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

function parseNumberedLines(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim());
  const filtered = lines.filter(l => VALID_NUMBERED_LINE.test(l));
  return filtered.map(line => {
    const match = line.match(VALID_NUMBERED_LINE);
    const num = Number(match[1]);
    const text = match[2].trim();
    return { num, text };
  });
}

function hasDuplicates(entries) {
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.num)) return true;
    seen.add(e.num);
  }
  return false;
}

class NormalizationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'NormalizationError';
    this.retry = options.retry ?? false;
    this.hint = options.hint;
  }
}

/**
 * Normalize AI output into selection entries.
 * @param {string} output raw AI response
 * @param {{attempt?: number}} opts options
 * @returns {{entries: Array<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null}>, singleOption: boolean}}
 */
function normalizeOptions(output, opts = {}) {
  const attempt = opts.attempt ?? 0;
  const canRetry = attempt < RETRY_BUDGET;

  // Strip ANSI first, then clean markdown from number prefixes only
  const ansiCleaned = stripAnsi(output || '');

  // Try JSON path first (no markdown stripping needed for JSON)
  let entries = parseJsonOptions(ansiCleaned);

  if (!entries || entries.length === 0) {
    // Strip markdown prefixes before parsing numbered lines
    const cleaned = stripSimpleMarkdown(ansiCleaned);
    entries = parseNumberedLines(cleaned);
  }

  if (!entries || entries.length === 0) {
    if (!canRetry) {
      throw new NormalizationError(
        `Selection failed: could not parse valid options after ${RETRY_BUDGET + 1} attempts. Raw output was: ${(output || '').slice(0, 100)}. This is usually an AI formatting issue -- try running again.`,
        { retry: false, hint: EMPTY_HINT }
      );
    }
    throw new NormalizationError(
      'No valid numbered options found.',
      { retry: true, hint: EMPTY_HINT }
    );
  }

  if (hasDuplicates(entries)) {
    if (!canRetry) {
      throw new NormalizationError(
        `Selection failed: could not parse valid options after ${RETRY_BUDGET + 1} attempts. Raw output was: ${(output || '').slice(0, 100)}. This is usually an AI formatting issue -- try running again.`,
        { retry: false, hint: DUPLICATE_HINT }
      );
    }
    throw new NormalizationError(
      'Duplicate numbered options detected.',
      { retry: true, hint: DUPLICATE_HINT }
    );
  }

  // Sort and re-index sequentially
  entries.sort((a, b) => a.num - b.num);
  const reindexed = entries.map((entry, idx) => ({
    id: idx + 1,
    label: entry.text,
    value: `${idx + 1}. ${entry.text}`,
    actionable: true,
    payload: entry.payload ?? null,
    metadata: entry.metadata ?? null,
  }));

  const singleOption = reindexed.length === 1;

  return { entries: reindexed, singleOption };
}

module.exports = {
  normalizeOptions,
  NormalizationError,
};
