const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');
const { dispatchSelection } = require('../index');
const { readRecords } = require('../../session/store');

function makeOutput() {
  let buffer = '';
  const output = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString();
      cb();
    },
  });
  return { output, get: () => buffer };
}

function makeAsk(answers = []) {
  let calls = 0;
  return {
    ask: async () => {
      const res = answers[calls];
      calls += 1;
      return res;
    },
    getCalls: () => calls,
  };
}

function makeRunner(results = []) {
  return async (action) => {
    const res = results.shift();
    // attach stderr/stdout defaults to avoid undefined
    return { stdout: '', stderr: '', ...res };
  };
}

function tempSessionPath(name = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-recovery-'));
  return { sessionPath: name || path.join(dir, 'session.json'), dir };
}

test('retry succeeds after failure, logs attempts, and prints success line', async () => {
  const runner = makeRunner([
    { code: 1, stderr: 'boom' },
    { code: 0, stderr: '' },
  ]);
  const { output, get } = makeOutput();
  const askStub = makeAsk(['1']); // choose retry
  const { sessionPath, dir } = tempSessionPath();

  const res = await dispatchSelection(
    { actionable: true, payload: { command: 'npm test', mutating: false } },
    { runner, ask: askStub.ask, output, sessionPath },
  );

  assert.strictEqual(res.ran, true);
  assert.strictEqual(res.result.code, 0);
  assert.match(get(), /Command succeeded/);
  const records = readRecords(sessionPath);
  assert.strictEqual(records.length, 2, 'records both attempts');
  assert.deepStrictEqual(records.map((r) => r.exitCode), [1, 0]);
  fs.rmSync(path.dirname(sessionPath), { recursive: true, force: true });
});

test('edit with different command resets strikes and succeeds', async () => {
  const runner = makeRunner([
    { code: 1, stderr: 'fail first' },
    { code: 0, stderr: 'ok' },
  ]);
  const { output, get } = makeOutput();
  const askStub = makeAsk(['2', 'cmd-two']); // pick edit, then provide new command
  const { sessionPath } = tempSessionPath();

  const res = await dispatchSelection(
    { actionable: true, payload: { command: 'cmd-one', mutating: false } },
    { runner, ask: askStub.ask, output, sessionPath },
  );

  assert.strictEqual(res.ran, true);
  assert.strictEqual(res.result.code, 0);
  assert.match(get(), /Command succeeded/);
  const records = readRecords(sessionPath);
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].command, 'cmd-one');
  assert.strictEqual(records[1].command, 'cmd-two');
  fs.rmSync(path.dirname(sessionPath), { recursive: true, force: true });
});

test('two same-cause failures abort on second strike without extra prompt', async () => {
  const runner = makeRunner([
    { code: 2, stderr: 'boom' },
    { code: 2, stderr: 'still boom' },
  ]);
  const askStub = makeAsk(['1']); // first prompt select retry
  const { output, get } = makeOutput();

  const res = await dispatchSelection(
    { actionable: true, payload: { command: 'repeat-cmd', mutating: false } },
    { runner, ask: askStub.ask, output },
  );

  assert.strictEqual(res.aborted, true);
  assert.match(get(), /Aborting after repeated failure/);
  assert.strictEqual(askStub.getCalls(), 1, 'no second prompt after abort');
});

test('session write errors are swallowed', async () => {
  const runner = makeRunner([{ code: 0, stderr: '' }]);
  const { output } = makeOutput();
  // sessionPath as directory to force renameSync error
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-recovery-dir-'));
  const sessionPath = dir;

  const res = await dispatchSelection(
    { actionable: true, payload: { command: 'echo ok', mutating: false } },
    { runner, output, sessionPath },
  );

  assert.strictEqual(res.ran, true);
  assert.strictEqual(res.result.code, 0);
  // ensure directory still exists, meaning no unhandled throw
  assert.ok(fs.existsSync(dir));
  fs.rmSync(dir, { recursive: true, force: true });
});
