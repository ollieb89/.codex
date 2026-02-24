const readline = require('node:readline');
const path = require('node:path');
const { exec } = require('node:child_process');
const { sanitizeAction } = require('./sanitize');
const { editCommand } = require('./edit');
const { renderPreview, confirm } = require('./preview');
const { MUTATING_PATTERN } = require('./commands');
const { buildRecoveryPayload } = require('./stderr-bridge');
const { renderRecoveryPrompt, RECOVERY_CHOICES, isSameRootCause } = require('./recovery');
const { appendRecord } = require('../session/store');

function defaultRunner(action) {
  return new Promise((resolve, reject) => {
    if (!action.command) return resolve({ code: 0, stdout: '', stderr: '' });
    exec(action.command, { cwd: action.cwd || process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        resolve({ code: err.code ?? 1, stdout, stderr });
        return;
      }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

async function dispatchSelection(selection, opts = {}) {
  const output = opts.output || process.stdout;
  const input = opts.input || process.stdin;
  const ask = opts.ask || ((prompt) => {
    const rl = readline.createInterface({ input, output });
    return new Promise((resolve) => rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    }));
  });
  const runner = opts.runner || defaultRunner;
  const forceFlag = opts.forceDispatchFlag || false;
  const dryRun = opts.dryRun || false;
  const cwd = opts.cwd || process.cwd();
  const sessionPath = opts.sessionPath || path.join(cwd, '.planning', 'session.json');
  const recoveryState = opts._recoveryState || null;

  if (!selection || selection.actionable === false) {
    return { ran: false, cancelled: true, reason: 'Non-actionable' };
  }

  const payload = selection.payload || {};
  const action = {
    type: payload.type || 'shell',
    command: payload.command || '',
    diff: payload.diff,
    impact: payload.impact,
    sourceAgentId: selection.metadata?.sourceAgentId || payload.sourceAgentId,
    actionType: payload.type,
    mutating: payload.mutating,
    cwd,
    paths: payload.paths || payload.files || [],
  };

  let sanitized = sanitizeAction(action, { cwd, force: forceFlag });

  if (sanitized.status === 'force' && !forceFlag) {
    return { ran: false, cancelled: true, reason: 'force-dispatch required' };
  }

  if (sanitized.status === 'block') {
    const edited = await editCommand(action.command, { input, output, useEditor: opts.useEditor, ask });
    if (edited.cancelled || !edited.command) {
      return { ran: false, cancelled: true, reason: 'blocked' };
    }
    action.command = edited.command;
    sanitized = sanitizeAction(action, { cwd, force: forceFlag });
    if (sanitized.status !== 'allow') {
      return { ran: false, cancelled: true, reason: 'blocked after edit' };
    }
  }

  renderPreview(
    { ...payload, command: sanitized.sanitizedCommand },
    { sourceAgentId: action.sourceAgentId, actionType: action.type },
    { output },
  );

  const mutating = action.mutating !== undefined
    ? action.mutating
    : MUTATING_PATTERN.test(action.command);

  // Gray gate takes precedence — if --force was required and provided, skip mutating confirm
  const skipMutatingConfirm = sanitized.grayMatched === true;

  if (dryRun) {
    output.write(`Skip execute: ${sanitized.sanitizedCommand || action.command}\n`);
    return { ran: false, dryRun: true, cancelled: false };
  }

  let proceed = true;
  if (mutating && !skipMutatingConfirm) {
    const answer = await confirm('Proceed? (y/N) ', { ask, input, output });
    proceed = /^y/i.test(answer || '');
  }

  if (!proceed) {
    return { ran: false, cancelled: true, reason: 'user cancelled' };
  }

  const res = await runner({ ...action, command: action.command });
  try {
    appendRecord(sessionPath, {
      command: action.command,
      exitCode: res.code,
      stderrSnippet: getStderrSnippet(res.stderr),
    });
  } catch (_err) {
    // Session writes are best-effort; swallow per Phase 13 decision
  }
  if (res.code === 0) {
    if (recoveryState) {
      output.write('Command succeeded\n');
    }
    return { ran: true, dryRun: false, result: res };
  }

  const recoveryPayload = buildRecoveryPayload(res, action.command);
  if (!recoveryPayload) {
    return { ran: true, dryRun: false, result: res };
  }

  const currentFailure = { exitCode: recoveryPayload.exitCode, command: action.command };
  const strikes = isSameRootCause(currentFailure, recoveryState?.lastFailure)
    ? (recoveryState?.strikes ?? 0) + 1
    : 1;
  const nextRecoveryState = {
    strikes,
    lastFailure: currentFailure,
  };

  if (strikes >= 2) {
    output.write('Aborting after repeated failure of the same command.\n');
    return { ran: true, dryRun: false, aborted: true, result: res };
  }

  renderRecoveryPrompt(recoveryPayload, { output });
  let choice = await ask('Select an option: ');
  while (!Object.values(RECOVERY_CHOICES).includes((choice || '').trim())) {
    choice = await ask('Select an option: ');
  }

  const trimmed = (choice || '').trim();
  if (trimmed === RECOVERY_CHOICES.abort) {
    output.write('Abort selected. Exiting recovery.\n');
    return { ran: true, dryRun: false, aborted: true, result: res };
  }

  if (trimmed === RECOVERY_CHOICES.retry) {
    const selectionForRetry = withCommand(selection, action.command);
    return dispatchSelection(selectionForRetry, {
      ...opts,
      _recoveryState: nextRecoveryState,
    });
  }

  if (trimmed === RECOVERY_CHOICES.edit) {
    const edited = await editCommand(action.command, { input, output, useEditor: opts.useEditor, ask });
    if (edited.cancelled || !edited.command) {
      output.write('Abort selected. Exiting recovery.\n');
      return { ran: true, dryRun: false, aborted: true, result: res };
    }

    const editedSelection = withCommand(selection, edited.command);
    const stateForEdit = edited.command === action.command
      ? nextRecoveryState
      : { strikes: 0, lastFailure: null };

    return dispatchSelection(editedSelection, {
      ...opts,
      _recoveryState: stateForEdit,
    });
  }

  return { ran: true, dryRun: false, result: res };
}

function getStderrSnippet(stderr = '') {
  if (!stderr) return '';
  const lines = String(stderr).split('\n');
  return lines.slice(-7).join('\n').trim();
}

function withCommand(selection, command) {
  const payload = selection.payload || {};
  return {
    ...selection,
    payload: {
      ...payload,
      command,
    },
  };
}

module.exports = {
  dispatchSelection,
};
