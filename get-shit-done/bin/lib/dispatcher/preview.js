const readline = require('node:readline');
const { DESTRUCTIVE_HIGHLIGHT_TERMS } = require('./commands');

const colors = {
  dim: (s) => `\u001b[2m${s}\u001b[22m`,
  redBold: (s) => `\u001b[1m\u001b[31m${s}\u001b[39m\u001b[22m`,
  reset: '\u001b[0m',
};

function highlightDestructive(command) {
  if (!command) return '';
  let out = command;
  for (const term of DESTRUCTIVE_HIGHLIGHT_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, (m) => colors.redBold(m));
  }
  return colors.dim(out);
}

function formatMetadata(meta = {}) {
  const parts = [];
  if (meta.impact) parts.push(`Impact: ${meta.impact}`);
  if (meta.sourceAgentId) parts.push(`Source: ${meta.sourceAgentId}`);
  if (meta.actionType) parts.push(`Type: ${meta.actionType}`);
  return parts.join(' | ');
}

function renderPreview(payload = {}, meta = {}, opts = {}) {
  const output = opts.output || process.stdout;
  const command = payload.command || '';
  const diff = payload.diff || '';
  const highlighted = highlightDestructive(command);

  output.write('=== Preview ===\n');
  if (command) output.write(`${highlighted}\n`);
  if (diff) {
    output.write('--- Preview (mini-diff ±3) ---\n');
    output.write(`${diff}\n`);
  }

  const metaLine = formatMetadata({
    impact: payload.impact || meta.impact,
    sourceAgentId: meta.sourceAgentId || payload.sourceAgentId,
    actionType: payload.actionType || meta.actionType || payload.type,
  });
  if (metaLine) output.write(`${metaLine}\n`);
}

async function confirm(prompt, opts = {}) {
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

module.exports = {
  renderPreview,
  highlightDestructive,
  confirm,
};
