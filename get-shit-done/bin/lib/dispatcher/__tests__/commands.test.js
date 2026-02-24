const test = require('node:test');
const assert = require('node:assert');
const {
  BLOCKED_COMMANDS,
  ALLOWLIST,
  GRAY_COMMANDS,
  DESTRUCTIVE_HIGHLIGHT_TERMS,
  MUTATING_PATTERN,
  matchGray,
  SECRET_PATTERNS,
  isSafeValue,
  MIN_SECRET_LENGTH,
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

// --- SECRET_PATTERNS shape ---

test('SECRET_PATTERNS has 10 entries', () => {
  assert.strictEqual(SECRET_PATTERNS.length, 10);
});

test('SECRET_PATTERNS entries have name, regex, alwaysRedact', () => {
  for (const entry of SECRET_PATTERNS) {
    assert.strictEqual(typeof entry.name, 'string');
    assert.ok(entry.regex instanceof RegExp);
    assert.strictEqual(typeof entry.alwaysRedact, 'boolean');
  }
});

test('SECRET_PATTERNS first 9 entries have alwaysRedact true', () => {
  for (let i = 0; i < 9; i++) {
    assert.strictEqual(SECRET_PATTERNS[i].alwaysRedact, true, `index ${i} (${SECRET_PATTERNS[i].name}) should be alwaysRedact: true`);
  }
});

test('SECRET_PATTERNS last entry (generic_env) has alwaysRedact false', () => {
  const last = SECRET_PATTERNS[SECRET_PATTERNS.length - 1];
  assert.strictEqual(last.name, 'generic_env');
  assert.strictEqual(last.alwaysRedact, false);
});

// --- SECRET_PATTERNS ordering (SEC-02) ---

test('anthropic pattern comes before openai pattern', () => {
  const anthropicIdx = SECRET_PATTERNS.findIndex((p) => p.name === 'anthropic');
  const openaiIdx = SECRET_PATTERNS.findIndex((p) => p.name === 'openai');
  assert.ok(anthropicIdx < openaiIdx, `anthropic (${anthropicIdx}) must come before openai (${openaiIdx})`);
});

test('all provider patterns come before generic_env', () => {
  const genericIdx = SECRET_PATTERNS.findIndex((p) => p.name === 'generic_env');
  assert.strictEqual(genericIdx, SECRET_PATTERNS.length - 1, 'generic_env must be last');
});

test('stripe pattern comes before generic fallback', () => {
  const stripeIdx = SECRET_PATTERNS.findIndex((p) => p.name === 'stripe');
  const genericIdx = SECRET_PATTERNS.findIndex((p) => p.name === 'generic_env');
  assert.ok(stripeIdx < genericIdx);
});

// --- SECRET_PATTERNS regex match tests ---

test('anthropic pattern matches sk-ant-api03-xxxx key', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'anthropic');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('sk-ant-api03-aBcDeFgHiJkLmNoPqRsTuVwXyZ'));
});

test('openai pattern matches sk-xxxxxxxx key', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'openai');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456'));
});

test('openai pattern does NOT match sk-ant- prefixed key', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'openai');
  const re = new RegExp(p.regex.source, p.regex.flags);
  // sk-ant- has a hyphen after sk- which is not in [A-Za-z0-9]{20,}
  assert.ok(!re.test('sk-ant-api03-aBcDeFgHiJkLmNoPqRsT'));
});

test('github pattern matches ghp_ followed by 36+ chars', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'github');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890'));
});

test('aws pattern matches AKIA followed by 16 uppercase chars', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'aws');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('AKIAIOSFODNN7EXAMPLE'));
});

test('stripe pattern matches sk_live_ followed by 24+ chars', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'stripe');
  const re = new RegExp(p.regex.source, p.regex.flags);
  const fakeStripeKey = `sk_live_${'a'.repeat(24)}`;
  assert.ok(re.test(fakeStripeKey));
});

test('pem pattern matches BEGIN/END RSA PRIVATE KEY block', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'pem');
  const re = new RegExp(p.regex.source, p.regex.flags);
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...\n-----END RSA PRIVATE KEY-----';
  assert.ok(re.test(pem));
});

test('jwt pattern matches eyJhbG header token', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'jwt');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.abc123def456'));
});

test('bearer pattern matches Authorization: Bearer token_value', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'bearer');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('Bearer eyJhbGciOiJIUzI1NiJ9'));
});

test('connection_string pattern matches postgresql://user:pass@host', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'connection_string');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('postgresql://admin:s3cret@db.example.com:5432/mydb'));
});

test('connection_string pattern matches mongodb+srv://user:pass@cluster', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'connection_string');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('mongodb+srv://user:pass@cluster.example.com/db'));
});

test('generic_env pattern matches OPENAI_API_KEY=sk-xxxx', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'generic_env');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('OPENAI_API_KEY=sk-xxxx'));
});

test('generic_env pattern matches MY_SECRET=longvalue12345678', () => {
  const p = SECRET_PATTERNS.find((x) => x.name === 'generic_env');
  const re = new RegExp(p.regex.source, p.regex.flags);
  assert.ok(re.test('MY_SECRET=longvalue12345678'));
});

// --- isSafeValue tests ---

test('isSafeValue returns true for numeric-only "12345"', () => {
  assert.strictEqual(isSafeValue('12345'), true);
});

test('isSafeValue returns true for file path starting with /', () => {
  assert.strictEqual(isSafeValue('/path/to/key'), true);
});

test('isSafeValue returns true for file path starting with ./', () => {
  assert.strictEqual(isSafeValue('./relative/path'), true);
});

test('isSafeValue returns true for file path starting with ../', () => {
  assert.strictEqual(isSafeValue('../parent/path'), true);
});

test('isSafeValue returns true for file path starting with ~', () => {
  assert.strictEqual(isSafeValue('~/home/path'), true);
});

test('isSafeValue returns true for short value "abc" (below MIN_SECRET_LENGTH)', () => {
  assert.strictEqual(isSafeValue('abc'), true);
});

test('isSafeValue returns false for long non-numeric non-path value', () => {
  assert.strictEqual(isSafeValue('supersecretvalue123'), false);
});

// --- MIN_SECRET_LENGTH ---

test('MIN_SECRET_LENGTH is 8', () => {
  assert.strictEqual(MIN_SECRET_LENGTH, 8);
});
