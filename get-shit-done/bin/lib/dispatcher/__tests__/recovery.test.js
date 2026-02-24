const test = require('node:test');
const assert = require('node:assert');
const { Writable } = require('node:stream');
const {
  BOX_TOP,
  MENU_DIVIDER,
  RECOVERY_CHOICES,
  renderRecoveryPrompt,
  isSameRootCause,
} = require('../recovery');

function createCaptureStream() {
  let buffer = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      callback();
    },
  });
  return {
    stream,
    getContents: () => buffer,
  };
}

test('renderRecoveryPrompt prints boxed header, command, stderr hint, and numbered menu', () => {
  const { stream, getContents } = createCaptureStream();
  renderRecoveryPrompt(
    { exitCode: 42, command: 'npm test', stderrHint: 'TypeError: boom' },
    { output: stream }
  );
  stream.end();

  const output = getContents();
  assert.ok(output.includes(BOX_TOP), 'includes top border');
  assert.ok(output.includes('COMMAND FAILED (exit code 42)'), 'includes exit code header');
  assert.ok(output.includes('$ npm test'), 'echoes the command');
  assert.ok(output.includes('TypeError: boom'), 'includes stderr hint');

  const retryIndex = output.indexOf('1) Retry');
  const editIndex = output.indexOf('2) Edit');
  const abortIndex = output.indexOf('3) Abort');
  assert.ok(retryIndex !== -1, 'shows Retry option');
  assert.ok(editIndex > retryIndex, 'Edit follows Retry');
  assert.ok(abortIndex > editIndex, 'Abort follows Edit');
  assert.ok(output.trimEnd().endsWith(MENU_DIVIDER), 'ends with divider');
});

test('RECOVERY_CHOICES maps retry/edit/abort to 1/2/3', () => {
  assert.strictEqual(RECOVERY_CHOICES.retry, '1');
  assert.strictEqual(RECOVERY_CHOICES.edit, '2');
  assert.strictEqual(RECOVERY_CHOICES.abort, '3');
});

test('isSameRootCause returns true only when exitCode and command match', () => {
  const previous = { exitCode: 1, command: 'npm test' };
  assert.strictEqual(
    isSameRootCause({ exitCode: 1, command: 'npm test' }, previous),
    true
  );
  assert.strictEqual(
    isSameRootCause({ exitCode: 2, command: 'npm test' }, previous),
    false
  );
  assert.strictEqual(
    isSameRootCause({ exitCode: 1, command: 'npm run lint' }, previous),
    false
  );
});

test('isSameRootCause is false when previous context is missing', () => {
  assert.strictEqual(isSameRootCause({ exitCode: 1, command: 'cmd' }, null), false);
  assert.strictEqual(isSameRootCause({ exitCode: 1, command: 'cmd' }, undefined), false);
  assert.strictEqual(isSameRootCause(null, { exitCode: 1, command: 'cmd' }), false);
});
