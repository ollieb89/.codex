'use strict';

const BLOCKED_COMMANDS = new Set(['sudo', 'chown', 'chmod', 'mkfs', 'dd']);

const ALLOWLIST = new Set([
  'git',
  'npm',
  'yarn',
  'pnpm',
  'node',
  'mkdir',
  'cp',
  'mv',
  'ls',
  'cat',
  'touch',
  'echo',
  'grep',
  'rg',
]);

const GRAY_COMMANDS = [
  { prefix: 'git push', reason: 'Pushes to remote' },
  { prefix: 'npm publish', reason: 'Publishes to registry' },
  { prefix: 'pnpm publish', reason: 'Publishes to registry' },
  { prefix: 'yarn publish', reason: 'Publishes to registry' },
];

const DESTRUCTIVE_HIGHLIGHT_TERMS = ['rm', 'truncate', 'drop', 'overwrite', '--force', '-rf'];

// Built once from the canonical term list; word-boundary prevents false positives
const MUTATING_TERMS = ['rm', 'mv', 'cp', 'push', 'write', 'append', 'truncate', 'npm publish', 'git push'];
const MUTATING_PATTERN = new RegExp(
  MUTATING_TERMS.map((t) => `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`).join('|'),
  'i',
);

/**
 * Match a command string against the gray command list using prefix matching.
 * Returns the matching gray entry or null.
 */
function matchGray(command) {
  if (!command || typeof command !== 'string') return null;
  const lower = command.trim().toLowerCase();
  if (!lower) return null;
  return GRAY_COMMANDS.find((g) => lower === g.prefix || lower.startsWith(g.prefix + ' ')) || null;
}

module.exports = {
  BLOCKED_COMMANDS,
  ALLOWLIST,
  GRAY_COMMANDS,
  DESTRUCTIVE_HIGHLIGHT_TERMS,
  MUTATING_PATTERN,
  matchGray,
};
