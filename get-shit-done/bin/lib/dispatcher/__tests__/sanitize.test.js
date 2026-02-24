const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { sanitizeAction, redactSecrets, isInsideWorkspace } = require('../sanitize');

test('blocks paths outside workspace', () => {
  const cwd = path.join(process.cwd(), 'tmp-cwd');
  const action = { command: 'cat ../etc/passwd', paths: ['../etc/passwd'] };
  const res = sanitizeAction(action, { cwd });
  assert.strictEqual(res.status, 'block');
  assert.strictEqual(res.reason, 'Path outside workspace');
});

test('allows standard dev tool', () => {
  const res = sanitizeAction({ command: 'git status' }, { cwd: process.cwd() });
  assert.strictEqual(res.status, 'allow');
});

test('blocks high-risk command', () => {
  const res = sanitizeAction({ command: 'sudo rm -rf /' }, { cwd: process.cwd() });
  assert.strictEqual(res.status, 'block');
});

test('flags gray-area command without force', () => {
  const res = sanitizeAction({ command: 'git push origin main' }, { cwd: process.cwd() });
  assert.strictEqual(res.status, 'force');
  assert.strictEqual(res.reason, 'Pushes to remote');
});

test('allows gray-area when force flag set', () => {
  const res = sanitizeAction({ command: 'git push origin main' }, { cwd: process.cwd(), force: true });
  assert.strictEqual(res.status, 'allow');
});

test('redacts secrets in preview', () => {
  const { redacted } = redactSecrets('export SERVICE_API_KEY=supersecret');
  assert.match(redacted, /\[REDACTED\]/);
});

test('strips --force from sanitizedCommand when gray gate passes', () => {
  const res = sanitizeAction({ command: 'git push --force origin main' }, { cwd: process.cwd(), force: true });
  assert.strictEqual(res.status, 'allow');
  assert.ok(res.grayMatched);
  assert.ok(!res.sanitizedCommand.includes('--force'), 'should strip --force');
  assert.match(res.sanitizedCommand, /git push\s+origin main/);
});

test('gray gate catches npm publish with extra arguments', () => {
  const res = sanitizeAction({ command: 'npm publish --tag beta' }, { cwd: process.cwd() });
  assert.strictEqual(res.status, 'force');
  assert.strictEqual(res.reason, 'Publishes to registry');
});

test('workspace detection', () => {
  const cwd = process.cwd();
  assert.ok(isInsideWorkspace(cwd, cwd));
  assert.ok(!isInsideWorkspace('/tmp', cwd));
});

// --- Provider-specific redaction tests (SEC-01) ---

test('redacts OpenAI API key (sk-...)', () => {
  const { redacted } = redactSecrets('export OPENAI_API_KEY=sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('sk-aBcDeFg'));
});

test('redacts GitHub token (ghp_...)', () => {
  const { redacted } = redactSecrets('GH_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('ghp_aBcD'));
});

test('redacts AWS access key (AKIA...)', () => {
  const { redacted } = redactSecrets('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('AKIAIOSF'));
});

test('redacts Stripe secret key (sk_live_...)', () => {
  const fakeStripeKey = `sk_live_${'a'.repeat(24)}`;
  const { redacted } = redactSecrets(`STRIPE_KEY=${fakeStripeKey}`);
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('sk_live_'));
});

test('redacts Anthropic key (sk-ant-...)', () => {
  const { redacted } = redactSecrets('ANTHROPIC_API_KEY=sk-ant-api03-aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('sk-ant-'));
});

test('redacts PEM private key block', () => {
  const pem = 'cert=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
  const { redacted } = redactSecrets(pem);
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('BEGIN RSA'));
  assert.ok(!redacted.includes('MIIEpAIB'));
});

test('redacts JWT token (eyJhbG...)', () => {
  const { redacted } = redactSecrets('token=eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.abc123def456');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('eyJhbG'));
});

test('redacts Bearer token', () => {
  const { redacted } = redactSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.abc123');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('eyJhbG'));
});

test('redacts connection string (postgresql://user:pass@host)', () => {
  const { redacted } = redactSecrets('DATABASE_URL=postgresql://admin:s3cret@db.example.com:5432/mydb');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('s3cret'));
});

test('redacts mongodb+srv connection string', () => {
  const { redacted } = redactSecrets('MONGO_URI=mongodb+srv://user:pass@cluster.example.com/db');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(!redacted.includes('pass@'));
});

// --- Ordering tests (SEC-02) ---

test('anthropic key matched by anthropic pattern, not openai', () => {
  const { replacements } = redactSecrets('sk-ant-api03-aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  assert.ok(replacements.length > 0);
  assert.strictEqual(replacements[0].key, 'anthropic');
});

test('generic fallback catches unknown secret type', () => {
  const { redacted } = redactSecrets('MY_CUSTOM_SECRET=verylongsecretvalue12345678');
  assert.ok(redacted.includes('[REDACTED]'));
  assert.ok(redacted.includes('MY_CUSTOM_SECRET='));
});

test('generic fallback preserves key name', () => {
  const { redacted } = redactSecrets('MY_TOKEN=longvalue12345678901234');
  assert.ok(redacted.includes('MY_TOKEN=[REDACTED]'));
});

// --- False-positive prevention tests (Success Criteria 3) ---

test('does NOT redact TOKEN_COUNT=5 (numeric value)', () => {
  const { redacted } = redactSecrets('TOKEN_COUNT=5');
  assert.strictEqual(redacted, 'TOKEN_COUNT=5');
});

test('does NOT redact SECRET_LENGTH=32 (numeric value)', () => {
  const { redacted } = redactSecrets('SECRET_LENGTH=32');
  assert.strictEqual(redacted, 'SECRET_LENGTH=32');
});

test('does NOT redact API_KEY_FILE=/path/to/key (file path value)', () => {
  const { redacted } = redactSecrets('API_KEY_FILE=/path/to/key');
  assert.strictEqual(redacted, 'API_KEY_FILE=/path/to/key');
});

test('does NOT redact TOKEN=./relative/path (relative path value)', () => {
  const { redacted } = redactSecrets('TOKEN=./relative/path');
  assert.strictEqual(redacted, 'TOKEN=./relative/path');
});

test('does NOT redact short values like TOKEN=abc', () => {
  const { redacted } = redactSecrets('TOKEN=abc');
  assert.strictEqual(redacted, 'TOKEN=abc');
});

// --- Display-only redaction test (Success Criteria 4) ---

test('sanitizeAction returns redacted sanitizedCommand but preserves original in action', () => {
  const secret = 'echo sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456';
  const res = sanitizeAction({ command: secret }, { cwd: process.cwd() });
  assert.ok(res.sanitizedCommand.includes('[REDACTED]'), 'sanitizedCommand should be redacted');
  assert.strictEqual(res.action.command, secret, 'original command must be preserved in action');
});

// --- Multi-secret test ---

test('redacts multiple secrets in one command', () => {
  const input = 'export OPENAI_API_KEY=sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456 GH_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890';
  const { redacted, replacements } = redactSecrets(input);
  assert.ok(!redacted.includes('sk-aBcD'));
  assert.ok(!redacted.includes('ghp_aBcD'));
  assert.ok(replacements.length >= 2);
});

// --- PEM block specifics ---

test('PEM block replaced with single [REDACTED], not per-line', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK\nCAQEA\n-----END RSA PRIVATE KEY-----';
  const { redacted } = redactSecrets(pem);
  // Should be exactly one [REDACTED] replacing the whole block
  const matches = redacted.match(/\[REDACTED\]/g);
  assert.strictEqual(matches.length, 1, 'PEM should become exactly one [REDACTED]');
  assert.ok(!redacted.includes('BEGIN'));
});
