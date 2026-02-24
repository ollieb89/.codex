const test = require('node:test');
const assert = require('node:assert');
const { PassThrough } = require('node:stream');
const { handleHeadless } = require('../headless');
const { normalizeOptions } = require('../normalize');

test('handleHeadless picks from flag', () => {
  const entries = [{ id: 1, label: 'First', value: '1' }];
  const args = ['--select', '1'];
  const env = {};
  const stderr = new PassThrough();
  
  const result = handleHeadless(entries, args, env, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 1);
});

test('handleHeadless picks from env', () => {
  const entries = [{ id: 1, label: 'First', value: '1' }];
  const args = [];
  const env = { GS_DONE_SELECT: '1' };
  const stderr = new PassThrough();
  
  const result = handleHeadless(entries, args, env, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 1);
});

test('handleHeadless flag overrides env', () => {
  const entries = [
    { id: 1, label: 'First', value: '1' },
    { id: 2, label: 'Second', value: '2' }
  ];
  const args = ['--select', '2'];
  const env = { GS_DONE_SELECT: '1' };
  const stderr = new PassThrough();
  
  const result = handleHeadless(entries, args, env, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 2);
});

test('handleHeadless handles 0 (cancel)', () => {
  const entries = [{ id: 1, label: 'First', value: '1' }];
  const args = ['--select', '0'];
  const result = handleHeadless(entries, args, {});
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 0);
});

test('handleHeadless handles out of range', () => {
  const entries = [{ id: 1, label: 'First', value: '1' }];
  const args = ['--select', '5'];
  const stderr = new PassThrough();
  let capturedStderr = '';
  stderr.on('data', d => capturedStderr += d.toString());
  
  const result = handleHeadless(entries, args, {}, { stderr });
  assert.strictEqual(result.exitCode, 1);
  assert.ok(capturedStderr.includes('Out of range: 5'));
});

test('handleHeadless handles NO_COLOR', () => {
  const entries = [{ id: 1, label: '\u001b[31mColor\u001b[39m', value: '1' }];
  const args = ['--select', '1', '--no-color'];
  const stderr = new PassThrough();
  let capturedStderr = '';
  stderr.on('data', d => capturedStderr += d.toString());
  
  const result = handleHeadless(entries, args, {}, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.ok(!capturedStderr.includes('\u001b[31m'));
  assert.ok(capturedStderr.includes('Color'));
});

// === Phase 12: headless with post-normalization entries ===

test('handleHeadless --select=2 on normalized entries picks second item', () => {
  // Simulate normalize then headless: raw had gaps 1, 5, 9 -> normalized to 1, 2, 3
  const { entries } = normalizeOptions('1. A\n5. B\n9. C');
  const args = ['--select', '2'];
  const stderr = new PassThrough();

  const result = handleHeadless(entries, args, {}, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 2);
  assert.strictEqual(result.result.label, 'B');
});

test('handleHeadless GS_DONE_SELECT=3 on normalized entries picks third item', () => {
  const { entries } = normalizeOptions('1. A\n5. B\n9. C');
  const args = [];
  const env = { GS_DONE_SELECT: '3' };
  const stderr = new PassThrough();

  const result = handleHeadless(entries, args, env, { stderr });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.result.id, 3);
  assert.strictEqual(result.result.label, 'C');
});
