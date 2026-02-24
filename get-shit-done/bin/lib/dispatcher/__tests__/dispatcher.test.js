const test = require('node:test');
const assert = require('node:assert');
const { Readable, Writable } = require('node:stream');
const { dispatchSelection } = require('../index');

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

test('blocks force-dispatch commands without flag', async () => {
  const selection = {
    actionable: true,
    payload: { command: 'git push origin main', mutating: true },
    metadata: {},
  };
  const res = await dispatchSelection(selection, { forceDispatchFlag: false, dryRun: true, output: { write() {} } });
  assert.strictEqual(res.cancelled, true);
});

test('runs read-only without confirmation', async () => {
  const selection = {
    actionable: true,
    payload: { command: 'ls', mutating: false },
  };
  let ran = false;
  const runner = async () => {
    ran = true;
    return { code: 0 };
  };
  await dispatchSelection(selection, { runner, output: { write() {} } });
  assert.ok(ran);
});

test('honors dry-run path', async () => {
  const io = makeIO();
  const selection = {
    actionable: true,
    payload: { command: 'rm -rf tmp', mutating: true },
  };
  const res = await dispatchSelection(selection, { dryRun: true, output: io.output });
  assert.strictEqual(res.dryRun, true);
  assert.match(io.getData(), /Skip execute:/);
});

test('prompts for mutating confirm', async () => {
  const prompts = ['y'];
  const selection = {
    actionable: true,
    payload: { command: 'echo test >> file', mutating: true },
  };
  let ran = false;
  const runner = async () => { ran = true; return { code: 0 }; };
  await dispatchSelection(selection, { ask: () => prompts.shift(), runner, output: { write() {} } });
  assert.ok(ran);
});

test('skips mutating confirm when gray gate passed with force', async () => {
  let confirmCalled = false;
  const selection = {
    actionable: true,
    payload: { command: 'git push origin main' },
    metadata: {},
  };
  const runner = async () => ({ code: 0 });
  const res = await dispatchSelection(selection, {
    forceDispatchFlag: true,
    runner,
    output: { write() {} },
    ask: () => { confirmCalled = true; return 'y'; },
  });
  assert.ok(res.ran, 'should have run');
  assert.ok(!confirmCalled, 'should NOT prompt for mutating confirm after gray gate');
});
