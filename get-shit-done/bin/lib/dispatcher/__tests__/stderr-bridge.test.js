const test = require('node:test');
const assert = require('node:assert');
const { buildRecoveryPayload, STDERR_TAIL_LINES } = require('../stderr-bridge');

// Null on success

test('returns null when exit code is 0', () => {
  const result = buildRecoveryPayload({ code: 0, stderr: '', stdout: '' }, 'git status');
  assert.strictEqual(result, null);
});

test('returns null when runner result is null (defensive)', () => {
  const result = buildRecoveryPayload(null, 'git status');
  assert.strictEqual(result, null);
});

test('returns null when runner result is undefined', () => {
  const result = buildRecoveryPayload(undefined, 'git status');
  assert.strictEqual(result, null);
});

// RecoveryPayload shape on failure

test('returns RecoveryPayload with correct shape on non-zero exit', () => {
  const result = buildRecoveryPayload({ code: 1, stderr: 'error msg', stdout: '' }, 'git push');
  assert.strictEqual(typeof result, 'object');
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.exitCode, 1);
  assert.strictEqual(typeof result.stderrHint, 'string');
  assert.ok(result.stderrHint.includes('error msg'));
  assert.strictEqual(typeof result.command, 'string');
  assert.ok(result.command.includes('git push'));
});

test('returns correct exitCode for code 127 (command not found)', () => {
  const result = buildRecoveryPayload({ code: 127, stderr: 'command not found', stdout: '' }, 'nonexistent-cmd');
  assert.strictEqual(result.exitCode, 127);
});

// Stderr tail truncation

test('STDERR_TAIL_LINES is within 5-10 range', () => {
  assert.ok(STDERR_TAIL_LINES >= 5, `STDERR_TAIL_LINES (${STDERR_TAIL_LINES}) must be >= 5`);
  assert.ok(STDERR_TAIL_LINES <= 10, `STDERR_TAIL_LINES (${STDERR_TAIL_LINES}) must be <= 10`);
});

test('stderrHint contains only last STDERR_TAIL_LINES lines, not all 20', () => {
  const lines = [];
  for (let i = 1; i <= 20; i++) {
    lines.push(`line ${i}`);
  }
  const stderr = lines.join('\n');
  const result = buildRecoveryPayload({ code: 1, stderr, stdout: '' }, 'cmd');
  // Should not contain early lines
  assert.ok(!result.stderrHint.includes('line 1\n'), 'should not contain line 1');
  assert.ok(!result.stderrHint.includes('line 5\n'), 'should not contain line 5');
  // Should contain the last line
  assert.ok(result.stderrHint.includes('line 20'), 'should contain line 20');
});

test('empty stderr produces empty stderrHint', () => {
  const result = buildRecoveryPayload({ code: 1, stderr: '', stdout: '' }, 'cmd');
  assert.strictEqual(result.stderrHint, '');
});

// Redaction

test('stderr containing secret is redacted in stderrHint', () => {
  const result = buildRecoveryPayload(
    { code: 1, stderr: 'error: STRIPE_SECRET_KEY=sk_live_abc123', stdout: '' },
    'git push'
  );
  assert.ok(!result.stderrHint.includes('sk_live_abc123'), 'raw secret must not appear');
  assert.ok(result.stderrHint.includes('[REDACTED]'), 'redacted placeholder must appear');
});

test('command containing secret is redacted in command field', () => {
  const result = buildRecoveryPayload(
    { code: 1, stderr: 'fail', stdout: '' },
    'export SERVICE_API_KEY=secret123'
  );
  assert.ok(!result.command.includes('secret123'), 'raw secret must not appear in command');
  assert.ok(result.command.includes('[REDACTED]'), 'redacted placeholder must appear in command');
});

// Edge cases

test('missing stderr field in runner result produces empty stderrHint', () => {
  const result = buildRecoveryPayload({ code: 1 }, 'cmd');
  assert.strictEqual(result.stderrHint, '');
});

test('undefined command argument produces empty command field', () => {
  const result = buildRecoveryPayload({ code: 1, stderr: 'err' }, undefined);
  assert.strictEqual(result.command, '');
});
