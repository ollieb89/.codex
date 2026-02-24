const BOX_WIDTH = 66;
const BOX_TOP = `\u2554${'\u2550'.repeat(BOX_WIDTH)}\u2557`;
const BOX_BOTTOM = `\u255a${'\u2550'.repeat(BOX_WIDTH)}\u255d`;
const MENU_DIVIDER = '\u2500'.repeat(BOX_WIDTH + 2);

const RECOVERY_CHOICES = {
  retry: '1',
  edit: '2',
  abort: '3',
};

function renderRecoveryPrompt(payload, opts = {}) {
  const output = opts.output || process.stdout;
  const exitCode = payload?.exitCode ?? '';
  const command = payload?.command ?? '';
  const stderrHint = payload?.stderrHint ?? '';

  const headerLabel = `  COMMAND FAILED (exit code ${exitCode})`;
  const padding = Math.max(0, BOX_WIDTH - headerLabel.length);
  const headerLine = `\u2551${headerLabel}${' '.repeat(padding)}\u2551`;

  output.write('\n');
  output.write(`${BOX_TOP}\n`);
  output.write(`${headerLine}\n`);
  output.write(`${BOX_BOTTOM}\n`);
  output.write(`\n$ ${command}\n\n`);
  output.write(`${stderrHint}\n\n`);
  output.write(`${MENU_DIVIDER}\n`);
  output.write(`  ${RECOVERY_CHOICES.retry}) Retry\n`);
  output.write(`  ${RECOVERY_CHOICES.edit}) Edit\n`);
  output.write(`  ${RECOVERY_CHOICES.abort}) Abort\n`);
  output.write(`${MENU_DIVIDER}\n`);
}

function isSameRootCause(current, previous) {
  if (!current || !previous) return false;
  return current.exitCode === previous.exitCode
    && current.command === previous.command;
}

module.exports = {
  BOX_WIDTH,
  BOX_TOP,
  BOX_BOTTOM,
  MENU_DIVIDER,
  RECOVERY_CHOICES,
  renderRecoveryPrompt,
  isSameRootCause,
};
