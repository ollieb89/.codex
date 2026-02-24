'use strict';

const { redactSecrets } = require('./sanitize');

const STDERR_TAIL_LINES = 7;

/**
 * Build a RecoveryPayload from a runner result, or null on success.
 * Pure function — no I/O, no side effects.
 * @param {{ code: number, stderr?: string, stdout?: string } | null | undefined} runnerResult
 * @param {string} [command]
 * @returns {{ exitCode: number, stderrHint: string, command: string } | null}
 */
function buildRecoveryPayload(runnerResult, command) {
  if (!runnerResult || runnerResult.code === 0) return null;

  const rawStderr = runnerResult.stderr || '';
  const lines = rawStderr.split('\n');
  const tail = lines.slice(-STDERR_TAIL_LINES).join('\n').trim();

  const { redacted: stderrHint } = redactSecrets(tail);
  const { redacted: redactedCommand } = redactSecrets(command || '');

  return {
    exitCode: runnerResult.code,
    stderrHint,
    command: redactedCommand,
  };
}

module.exports = { buildRecoveryPayload, STDERR_TAIL_LINES };
