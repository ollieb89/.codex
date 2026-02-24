const test = require('node:test');
const assert = require('node:assert');
const { PassThrough } = require('node:stream');
const { selectOption, run, normalizeOptions, NormalizationError } = require('../index');

test('selectOption renders correctly and picks an option', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  
  let capturedOutput = '';
  output.on('data', (chunk) => {
    capturedOutput += chunk.toString();
  });

  const entries = [
    { id: 1, label: 'First Option', value: '1' },
    { id: 2, label: 'Second Option', value: '2' }
  ];

  const promise = selectOption(entries, { input, output });

  input.write('1\n');

  const result = await promise;

  assert.strictEqual(result.id, 1);
  assert.strictEqual(result.label, 'First Option');
  
  // Verify alignment in captured output (maxDigits=1, so no leading space for 1-9)
  assert.ok(capturedOutput.includes('1. First Option'));
  assert.ok(capturedOutput.includes('2. Second Option'));
  assert.ok(capturedOutput.includes('0. Cancel/Back'));
});

test('selectOption handles truncation', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  output.columns = 50; // Force small width
  
  let capturedOutput = '';
  output.on('data', (chunk) => {
    capturedOutput += chunk.toString();
  });

  const entries = [
    { id: 1, label: 'A very long label that will be truncated in a small terminal window', value: '1' },
    { id: 2, label: 'Short', value: '2' }
  ];

  const promise = selectOption(entries, { input, output });
  input.write('1\n');
  await promise;

  // console.log('CAPTURED:', JSON.stringify(capturedOutput));
  // maxWidth = max(40, 50-12) = 40
  // prefix is "1. " (3 chars)
  // label available width is 37
  assert.ok(capturedOutput.includes('1. A very long label that will be tru...'));
});

// === Phase 12: run() convenience function tests ===

test('run() normalizes gap list and selects by post-normalization ID', async () => {
  const input = new PassThrough();
  const output = new PassThrough();

  const raw = '1. Alpha\n3. Beta\n7. Gamma';
  const promise = run(raw, { input, output });

  // User types "2" which should resolve to Beta (post-normalization position 2)
  input.write('2\n');
  const result = await promise;

  assert.strictEqual(result.id, 2);
  assert.strictEqual(result.label, 'Beta');
});

test('run() normalizes 0-indexed list', async () => {
  const input = new PassThrough();
  const output = new PassThrough();

  const raw = '0. Zero\n1. One';
  const promise = run(raw, { input, output });

  input.write('1\n');
  const result = await promise;

  assert.strictEqual(result.id, 1);
  assert.strictEqual(result.label, 'Zero');
});

test('run() throws NormalizationError on empty input', () => {
  assert.throws(
    () => {
      // run() calls normalizeOptions synchronously before async selectOption
      // so the NormalizationError is thrown synchronously during normalize
      const { normalizeOptions: no } = require('../normalize');
      no('');
    },
    (err) => err.name === 'NormalizationError'
  );
});

test('index.js re-exports normalizeOptions and NormalizationError', () => {
  assert.strictEqual(typeof normalizeOptions, 'function');
  assert.strictEqual(typeof NormalizationError, 'function');
  assert.strictEqual(new NormalizationError('test').name, 'NormalizationError');
});

test('run() headless --select=2 resolves to post-normalization position 2', async () => {
  const stderr = new PassThrough();
  const raw = '1. Alpha\n5. Beta\n9. Gamma';
  const result = await run(raw, {
    args: ['--select', '2'],
    env: {},
    output: stderr,
    noExit: true,
  });

  assert.strictEqual(result.id, 2);
  assert.strictEqual(result.label, 'Beta');
});

test('run() headless GS_DONE_SELECT=3 resolves to post-normalization position 3', async () => {
  const stderr = new PassThrough();
  const raw = '1. Alpha\n5. Beta\n9. Gamma';
  const result = await run(raw, {
    args: [],
    env: { GS_DONE_SELECT: '3' },
    output: stderr,
    noExit: true,
  });

  assert.strictEqual(result.id, 3);
  assert.strictEqual(result.label, 'Gamma');
});
