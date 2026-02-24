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

function stripSimpleMarkdown(input) {
  return input
    .replace(/[*`_-]{1,2}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+$/gm, '')
    .trim();
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
    const match = line.match(/^(\d+)\.\s+(.+)$/);
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
  const cleaned = stripSimpleMarkdown(stripAnsi(output || ''));

  // Try JSON path first
  let entries = parseJsonOptions(cleaned);

  if (!entries || entries.length === 0) {
    // Fallback to numbered text
    entries = parseNumberedLines(cleaned);
  }

  if (!entries || entries.length === 0) {
    throw new NormalizationError(
      'No valid numbered options found.',
      { retry: attempt < RETRY_BUDGET, hint: EMPTY_HINT }
    );
  }

  if (hasDuplicates(entries)) {
    throw new NormalizationError(
      'Duplicate numbered options detected.',
      { retry: attempt < RETRY_BUDGET, hint: DUPLICATE_HINT }
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
