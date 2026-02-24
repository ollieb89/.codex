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

// Minimum value length for generic fallback to consider a value a secret
const MIN_SECRET_LENGTH = 8;

/**
 * Ordered array of secret detection patterns.
 * Position = priority: specific provider patterns first, generic fallback last.
 * First match wins — if a specific pattern matches, generic does not also fire.
 */
const SECRET_PATTERNS = [
  // Provider-specific (highest priority) — always redact regardless of length
  { name: 'anthropic', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, alwaysRedact: true },
  { name: 'openai', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, alwaysRedact: true },
  { name: 'github', regex: /\bghp_[A-Za-z0-9]{36,}\b/g, alwaysRedact: true },
  { name: 'aws', regex: /\bAKIA[A-Z0-9]{16}\b/g, alwaysRedact: true },
  { name: 'stripe', regex: /\bsk_live_[A-Za-z0-9]{24,}\b/g, alwaysRedact: true },
  // Structured secrets
  { name: 'pem', regex: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, alwaysRedact: true },
  { name: 'jwt', regex: /\beyJhbG[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, alwaysRedact: true },
  { name: 'bearer', regex: /\bBearer\s+[A-Za-z0-9_\-.~+/]+=*/g, alwaysRedact: true },
  { name: 'connection_string', regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:]+:[^\s@]+@[^\s]+/g, alwaysRedact: true },
  // Generic fallback (lowest priority)
  { name: 'generic_env', regex: /\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH))\s*=\s*(\S+)/g, alwaysRedact: false },
];

/**
 * Check if a value is safe (should NOT be redacted by generic fallback).
 * Provider-prefixed values bypass this check via alwaysRedact: true.
 */
function isSafeValue(value) {
  // Numeric-only values (e.g. TOKEN_COUNT=5)
  if (/^\d+$/.test(value)) return true;
  // File paths
  if (/^[./~]/.test(value) || value.startsWith('../')) return true;
  // Below minimum length threshold
  if (value.length < MIN_SECRET_LENGTH) return true;
  return false;
}

module.exports = {
  BLOCKED_COMMANDS,
  ALLOWLIST,
  GRAY_COMMANDS,
  DESTRUCTIVE_HIGHLIGHT_TERMS,
  MUTATING_PATTERN,
  matchGray,
  SECRET_PATTERNS,
  isSafeValue,
  MIN_SECRET_LENGTH,
};
