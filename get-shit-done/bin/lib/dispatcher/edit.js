const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

function askLine(prompt, opts = {}) {
  if (opts.ask) return opts.ask(prompt);
  const rl = readline.createInterface({
    input: opts.input || process.stdin,
    output: opts.output || process.stdout,
  });
  return new Promise((resolve) => rl.question(prompt, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

function openEditor(initial, opts = {}) {
  const editor = opts.editor || process.env.EDITOR || 'vi';
  const tmpFile = path.join(os.tmpdir(), `gsd-dispatch-${Date.now()}.cmd`);
  fs.writeFileSync(tmpFile, initial ?? '', 'utf8');
  const res = spawnSync(editor, [tmpFile], { stdio: 'inherit' });
  if (res.error) {
    return { command: null, cancelled: true, error: res.error };
  }
  const updated = fs.readFileSync(tmpFile, 'utf8');
  fs.unlinkSync(tmpFile);
  return { command: updated.trim(), cancelled: false };
}

async function editCommand(blockedCommand, opts = {}) {
  const output = opts.output || process.stdout;
  output.write('Blocked command. Edit to proceed or leave blank to cancel.\n');
  output.write('Press Ctrl+E (or pass useEditor=true) to open $EDITOR.\n');

  if (opts.useEditor) {
    return openEditor(blockedCommand, opts);
  }

  const answer = await askLine('Edited command: ', opts);
  if (!answer || !answer.trim()) {
    return { command: null, cancelled: true };
  }
  if (answer.trim().toLowerCase() === 'ctrl+e' || answer.trim().toLowerCase() === 'e') {
    return openEditor(blockedCommand, opts);
  }
  return { command: answer.trim(), cancelled: false };
}

module.exports = {
  editCommand,
};
