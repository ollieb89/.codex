const test = require('node:test');
const assert = require('node:assert');
const { normalizeOptions, NormalizationError } = require('../normalize.js');

// === Existing tests (Phase 7) ===

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

// === Phase 12: Selection Normalization ===

// --- Gap normalization (SEL-01) ---

test('normalizes large-gap list (5, 10, 15) to sequential 1, 2, 3', () => {
  const raw = '5. First\n10. Second\n15. Third';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2, 3]);
  assert.strictEqual(entries[0].label, 'First');
  assert.strictEqual(entries[2].label, 'Third');
});

// --- 0-indexed lists ---

test('normalizes 0-indexed list (0, 1, 2) to 1, 2, 3', () => {
  const raw = '0. Zero\n1. One\n2. Two';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2, 3]);
  assert.strictEqual(entries[0].label, 'Zero');
  assert.strictEqual(entries[1].label, 'One');
  assert.strictEqual(entries[2].label, 'Two');
});

// --- Leading zeros ---

test('parses leading zeros (01., 02., 03.) and normalizes', () => {
  const raw = '01. First\n02. Second\n03. Third';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2, 3]);
  assert.strictEqual(entries[0].label, 'First');
});

test('handles mixed leading zeros (01, 2, 003)', () => {
  const raw = '01. Alpha\n2. Beta\n003. Gamma';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2, 3]);
});

// --- Markdown-wrapped numbers ---

test('parses bold markdown-wrapped numbers (**1.** text)', () => {
  const raw = '**1.** Bold option\n**2.** Another bold';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2]);
  assert.strictEqual(entries[0].label, 'Bold option');
  assert.strictEqual(entries[1].label, 'Another bold');
});

test('parses backtick-wrapped numbers (`1.` text)', () => {
  const raw = '`1.` Code option\n`2.` Another code';
  const { entries } = normalizeOptions(raw);
  assert.deepStrictEqual(entries.map(e => e.id), [1, 2]);
  assert.strictEqual(entries[0].label, 'Code option');
  assert.strictEqual(entries[1].label, 'Another code');
});

// --- Label and metadata preservation (SEL-02) ---

test('preserves label text with special characters (parens, colons, dashes)', () => {
  const raw = '1. Install dependencies (npm)\n2. Run tests: unit + integration\n3. Deploy - production';
  const { entries } = normalizeOptions(raw);
  assert.strictEqual(entries[0].label, 'Install dependencies (npm)');
  assert.strictEqual(entries[1].label, 'Run tests: unit + integration');
  assert.strictEqual(entries[2].label, 'Deploy - production');
});

test('preserves payload and metadata from JSON input', () => {
  const raw = JSON.stringify([
    { label: 'Option A', payload: { command: 'cmd-a' }, metadata: { priority: 1 } },
    { label: 'Option B', payload: { command: 'cmd-b' }, metadata: { priority: 2 } }
  ]);
  const { entries } = normalizeOptions(raw);
  assert.strictEqual(entries[0].label, 'Option A');
  assert.deepStrictEqual(entries[0].payload, { command: 'cmd-a' });
  assert.deepStrictEqual(entries[0].metadata, { priority: 1 });
  assert.strictEqual(entries[1].label, 'Option B');
  assert.deepStrictEqual(entries[1].payload, { command: 'cmd-b' });
  assert.deepStrictEqual(entries[1].metadata, { priority: 2 });
});

// --- Duplicate detection with CONTEXT-spec hint ---

test('duplicate error hint matches CONTEXT spec', () => {
  const raw = '1. First\n1. Duplicate\n2. Third';
  assert.throws(
    () => normalizeOptions(raw),
    (err) => {
      assert.ok(err instanceof NormalizationError);
      assert.ok(err.retry === true);
      assert.ok(err.hint.includes('Duplicate numbered options detected'));
      assert.ok(err.hint.includes('Re-generate'));
      assert.ok(err.hint.includes('1, 2, 3'));
      return true;
    }
  );
});

test('duplicate error has retry=false when attempt >= RETRY_BUDGET', () => {
  const raw = '1. First\n1. Duplicate';
  assert.throws(
    () => normalizeOptions(raw, { attempt: 2 }),
    (err) => {
      assert.ok(err instanceof NormalizationError);
      assert.strictEqual(err.retry, false);
      return true;
    }
  );
});

// --- Retry budget ---

test('RETRY_BUDGET is 2 (3 total attempts)', () => {
  const { RETRY_BUDGET } = require('../schema');
  assert.strictEqual(RETRY_BUDGET, 2);
});

test('retry=true at attempt 0 and 1, false at attempt 2', () => {
  assert.throws(
    () => normalizeOptions('no list', { attempt: 0 }),
    (err) => { assert.strictEqual(err.retry, true); return true; }
  );
  assert.throws(
    () => normalizeOptions('no list', { attempt: 1 }),
    (err) => { assert.strictEqual(err.retry, true); return true; }
  );
  assert.throws(
    () => normalizeOptions('no list', { attempt: 2 }),
    (err) => { assert.strictEqual(err.retry, false); return true; }
  );
});

// --- Exhaustion message ---

test('exhaustion error includes raw output preview and attempt count', () => {
  const longRaw = 'No numbered content here at all, just random text that goes on and on and is definitely more than one hundred characters long so we can verify truncation works properly';
  assert.throws(
    () => normalizeOptions(longRaw, { attempt: 2 }),
    (err) => {
      assert.ok(err instanceof NormalizationError);
      assert.ok(err.message.includes('Selection failed'));
      assert.ok(err.message.includes('3 attempts'));
      assert.ok(err.message.includes('AI formatting issue'));
      // Should include some of the raw output
      assert.ok(err.message.includes('No numbered content'));
      return true;
    }
  );
});
