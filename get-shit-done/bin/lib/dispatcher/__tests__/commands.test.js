const test = require('node:test');
const assert = require('node:assert');
const {
  BLOCKED_COMMANDS,
  ALLOWLIST,
  GRAY_COMMANDS,
  DESTRUCTIVE_HIGHLIGHT_TERMS,
  MUTATING_PATTERN,
  matchGray,
} = require('../commands');

// --- Constants shape ---

test('BLOCKED_COMMANDS contains sudo and dd', () => {
  assert.ok(BLOCKED_COMMANDS.has('sudo'));
  assert.ok(BLOCKED_COMMANDS.has('dd'));
});

test('ALLOWLIST contains git and node', () => {
  assert.ok(ALLOWLIST.has('git'));
  assert.ok(ALLOWLIST.has('node'));
});

test('GRAY_COMMANDS has 4 entries with prefix and reason', () => {
  assert.strictEqual(GRAY_COMMANDS.length, 4);
  for (const entry of GRAY_COMMANDS) {
    assert.strictEqual(typeof entry.prefix, 'string');
    assert.strictEqual(typeof entry.reason, 'string');
  }
});

test('DESTRUCTIVE_HIGHLIGHT_TERMS has 6 entries', () => {
  assert.strictEqual(DESTRUCTIVE_HIGHLIGHT_TERMS.length, 6);
});

test('MUTATING_PATTERN is a RegExp', () => {
  assert.ok(MUTATING_PATTERN instanceof RegExp);
});

// --- matchGray prefix matching ---

test('matchGray exact match returns entry', () => {
  const result = matchGray('git push');
  assert.ok(result);
  assert.strictEqual(result.prefix, 'git push');
});

test('matchGray prefix with args returns entry', () => {
  const result = matchGray('git push origin main');
  assert.ok(result);
  assert.strictEqual(result.prefix, 'git push');
});

test('matchGray prefix with --force returns entry', () => {
  const result = matchGray('git push --force');
  assert.ok(result);
  assert.strictEqual(result.prefix, 'git push');
});

test('matchGray npm publish with tag returns entry', () => {
  const result = matchGray('npm publish --tag next');
  assert.ok(result);
  assert.strictEqual(result.prefix, 'npm publish');
});

test('matchGray git pull returns null', () => {
  assert.strictEqual(matchGray('git pull'), null);
});

test('matchGray git push-mirror returns null (no prefix collision)', () => {
  assert.strictEqual(matchGray('git push-mirror'), null);
});

test('matchGray git pushall returns null (no prefix collision without space)', () => {
  assert.strictEqual(matchGray('git pushall'), null);
});

test('matchGray empty string returns null', () => {
  assert.strictEqual(matchGray(''), null);
});

test('matchGray is case-insensitive', () => {
  const result = matchGray('GIT PUSH');
  assert.ok(result);
  assert.strictEqual(result.prefix, 'git push');
});

// --- matchGray reason strings ---

test('matchGray git push has correct reason', () => {
  const result = matchGray('git push');
  assert.strictEqual(result.reason, 'Pushes to remote');
});

test('matchGray npm publish has correct reason', () => {
  const result = matchGray('npm publish');
  assert.strictEqual(result.reason, 'Publishes to registry');
});

// --- MUTATING_PATTERN word-boundary ---

test('MUTATING_PATTERN matches rm -rf /tmp', () => {
  assert.ok(MUTATING_PATTERN.test('rm -rf /tmp'));
});

test('MUTATING_PATTERN matches mv a b', () => {
  assert.ok(MUTATING_PATTERN.test('mv a b'));
});

test('MUTATING_PATTERN matches cp src dst', () => {
  assert.ok(MUTATING_PATTERN.test('cp src dst'));
});

test('MUTATING_PATTERN matches npm publish', () => {
  assert.ok(MUTATING_PATTERN.test('npm publish'));
});

test('MUTATING_PATTERN matches git push origin main', () => {
  assert.ok(MUTATING_PATTERN.test('git push origin main'));
});

test('MUTATING_PATTERN does NOT match transform data (false positive for rm)', () => {
  // Reset lastIndex since the regex has no 'g' flag but test defensively
  assert.ok(!MUTATING_PATTERN.test('transform data'));
});

test('MUTATING_PATTERN does NOT match copyright notice (false positive for cp)', () => {
  assert.ok(!MUTATING_PATTERN.test('copyright notice'));
});

test('MUTATING_PATTERN does NOT match pushd /tmp (false positive for push)', () => {
  assert.ok(!MUTATING_PATTERN.test('pushd /tmp'));
});

test('MUTATING_PATTERN does NOT match rewrite config (false positive for write)', () => {
  assert.ok(!MUTATING_PATTERN.test('rewrite config'));
});
