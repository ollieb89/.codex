const fs = require('node:fs');
const path = require('node:path');
const { BLOCKED_COMMANDS, ALLOWLIST, matchGray } = require('./commands');

function resolveReal(p, cwd) {
  const absolute = path.resolve(cwd, p);
  try {
    return fs.realpathSync(absolute);
  } catch (_err) {
    return absolute;
  }
}

function isInsideWorkspace(resolved, cwd) {
  const normalizedCwd = path.resolve(cwd);
  const normalized = path.resolve(resolved);
  return normalized === normalizedCwd || normalized.startsWith(`${normalizedCwd}${path.sep}`);
}

function detectPaths(action = {}) {
  const paths = new Set();
  const list = action.paths || action.files || [];
  for (const p of list) {
    if (typeof p === 'string') paths.add(p);
  }
  if (action.command && typeof action.command === 'string') {
    const tokens = action.command.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (t.startsWith('./') || t.startsWith('../') || t.startsWith('/')) {
        paths.add(t);
      }
    }
  }
  return Array.from(paths);
}

function redactSecrets(str) {
  const replacements = [];
  const redacted = str.replace(
    /\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET))=([^\s]+)/g,
    (_m, key, _suffix, value) => {
      replacements.push({ key, original: value });
      return `${key}=[REDACTED]`;
    },
  );
  return { redacted, replacements };
}

function primaryCommand(action = {}) {
  if (!action.command || typeof action.command !== 'string') return '';
  const trimmed = action.command.trim();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/).slice(0, 2).join(' ');
  return first;
}

function sanitizeAction(action = {}, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const cmd = primaryCommand(action);
  const paths = detectPaths(action);
  const outOfBounds = [];
  for (const p of paths) {
    const real = resolveReal(p, cwd);
    if (!isInsideWorkspace(real, cwd)) {
      outOfBounds.push({ path: p, resolved: real });
    }
  }

  const redaction = redactSecrets(action.command || '');
  const result = {
    status: 'allow',
    reason: '',
    sanitizedCommand: redaction.redacted || '',
    redactions: redaction.replacements,
    action,
  };

  if (outOfBounds.length) {
    result.status = 'block';
    result.reason = 'Path outside workspace';
    result.outOfBounds = outOfBounds;
    return result;
  }

  if (cmd && BLOCKED_COMMANDS.has(cmd.split(' ')[0])) {
    result.status = 'block';
    result.reason = 'Blocked command';
    return result;
  }

  const grayMatch = matchGray(action.command || '');
  if (grayMatch) {
    if (opts.force) {
      // Strip GSD's --force flag to avoid conflicts with the underlying command's own --force
      result.sanitizedCommand = (redaction.redacted || '').replace(/\s+--force\b/g, '').trim();
      result.status = 'allow';
      result.grayMatched = true;
    } else {
      result.status = 'force';
      result.reason = grayMatch.reason;
    }
    return result;
  }

  if (cmd) {
    const base = cmd.split(' ')[0];
    if (!ALLOWLIST.has(base) && !BLOCKED_COMMANDS.has(base)) {
      result.reason = 'Unlisted command';
    }
  }

  return result;
}

module.exports = {
  sanitizeAction,
  redactSecrets,
  isInsideWorkspace,
  detectPaths,
};
