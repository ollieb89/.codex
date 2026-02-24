const test = require('node:test');
const assert = require('node:assert');
const { normalizeOptions, NormalizationError } = require('../normalize.js');

test('parses numbered lines and reindexes gaps', () => {
  const output = `
Here are options:
1. First choice
3. Third choice
`;
  const { entries, singleOption } = normalizeOptions(output, { attempt: 0 });
  assert.strictEqual(singleOption, false);
  assert.deepStrictEqual(
    entries.map(e => e.id),
    [1, 2]
  );
  assert.strictEqual(entries[0].label, 'First choice');
  assert.strictEqual(entries[1].label, 'Third choice');
});

test('parses JSON array first', () => {
  const json = JSON.stringify([
    { label: 'Do thing', command: 'echo hi' },
    'Plain text option'
  ]);
  const { entries } = normalizeOptions(json, { attempt: 0 });
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].payload.command, 'echo hi');
  assert.strictEqual(entries[1].label, 'Plain text option');
});

test('duplicate numbers trigger retryable error', () => {
  const output = `
1. One
1. Again
`;
  assert.throws(
    () => normalizeOptions(output, { attempt: 0 }),
    (err) => err instanceof NormalizationError && err.retry === true
  );
});

test('empty after filtering triggers retryable error then hard fail', () => {
  const output = `No list here`;
  const first = () => normalizeOptions(output, { attempt: 0 });
  const second = () => normalizeOptions(output, { attempt: 1 });
  assert.throws(first, (err) => err instanceof NormalizationError && err.retry === true);
  assert.throws(second, (err) => err instanceof NormalizationError && err.retry === false);
});

test('single option sets singleOption true', () => {
  const output = `1. Only choice`;
  const { entries, singleOption } = normalizeOptions(output, { attempt: 0 });
  assert.strictEqual(singleOption, true);
  assert.strictEqual(entries[0].id, 1);
});
