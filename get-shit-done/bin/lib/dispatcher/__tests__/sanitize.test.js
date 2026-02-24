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
