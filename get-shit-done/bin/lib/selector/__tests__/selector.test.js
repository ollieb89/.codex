const test = require('node:test');
const assert = require('node:assert');
const { Readable, Writable } = require('node:stream');
const { selectOption } = require('../index.js');

function makeIO(inputs = []) {
  const input = Readable.from(inputs);
  let data = '';
  const output = new Writable({
    write(chunk, _enc, cb) {
      data += chunk.toString();
      cb();
    },
  });
  return { input, output, getData: () => data };
}

test('selects a valid option', async () => {
  const io = makeIO(['2\n']);
  const entries = [
    { id: 1, label: 'One', value: '1. One', actionable: true },
    { id: 2, label: 'Two', value: '2. Two', actionable: true },
  ];
  const res = await selectOption(entries, { input: io.input, output: io.output });
  assert.strictEqual(res.id, 2);
  assert.strictEqual(res.label, 'Two');
});

test('rejects non-numeric then accepts valid', async () => {
  const prompts = ['abc', '1'];
  const messages = [];
  const ask = async (p) => {
    messages.push(p);
    return prompts.shift();
  };
  const entries = [
    { id: 1, label: 'One', value: '1. One', actionable: true },
    { id: 2, label: 'Two', value: '2. Two', actionable: true },
  ];
  const res = await selectOption(entries, { ask, output: { write: () => {} } });
  assert.strictEqual(res.id, 1);
  assert.ok(messages.some(m => m.includes('Select a number')));
});

test('handles cancel path', async () => {
  const io = makeIO(['0\n']);
  const entries = [
    { id: 1, label: 'One', value: '1. One', actionable: true },
    { id: 2, label: 'Two', value: '2. Two', actionable: true },
  ];
  const res = await selectOption(entries, { input: io.input, output: io.output });
  assert.strictEqual(res.id, 0);
  assert.strictEqual(res.actionable, false);
});

test('single-option fast path prompts Y/n', async () => {
  const io = makeIO(['y\n']);
  const entries = [
    { id: 1, label: 'Only', value: '1. Only', actionable: true },
  ];
  const res = await selectOption(entries, { input: io.input, output: io.output, singleOption: true });
  assert.strictEqual(res.id, 1);
});
