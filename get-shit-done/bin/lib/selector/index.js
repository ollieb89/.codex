const readline = require('node:readline');
const { formatMenuItem } = require('./format');
const { handleHeadless } = require('./headless');
const { normalizeOptions, NormalizationError } = require('./normalize');

/**
 * Render entries and read numeric selection.
 * @param {Array<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null,singleOption?:boolean}>} entries
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, singleOption?: boolean}} opts
 * @returns {Promise<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null}>}
 */
async function selectOption(entries, opts = {}) {
  const args = opts.args || process.argv;
  const env = opts.env || process.env;

  // Headless check
  const headless = handleHeadless(entries, args, env, { stderr: opts.output || process.stderr });
  if (headless.exitCode !== -1) {
    if (headless.exitCode === 0) {
      return headless.result;
    }
    // For invalid/out-of-range selection in headless mode, we exit non-zero
    // but in tests we might want to just return or throw.
    if (opts.noExit) {
      const err = new Error('Headless selection failed');
      err.exitCode = headless.exitCode;
      throw err;
    }
    process.exit(headless.exitCode);
  }

  const input = opts.input || process.stdin;
  const output = opts.output || process.stdout;
  const singleOption = opts.singleOption ?? entries?.singleOption ?? false;
  const rl = opts.ask ? null : readline.createInterface({ input, output });
  const ask = opts.ask || ((prompt) => askQuestion(rl, prompt));

  try {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('No options to select from.');
    }

    if (singleOption || entries.length === 1) {
      const only = entries[0];
      const confirm = await ask(`Run: ${only.label}? (Y/n) `);
      if (/^n/i.test(confirm || '')) {
        return { id: 0, label: 'User Cancelled', value: '0', actionable: false };
      }
      return only;
    }

    const columns = output.columns || 80;
    const maxWidth = Math.max(40, columns - 12);
    const maxDigits = String(entries.length).length;

    for (const entry of entries) {
      output.write(formatMenuItem(entry.id, entry.label, maxDigits, maxWidth) + '\n');
    }
    output.write(formatMenuItem(0, 'Cancel/Back', maxDigits, maxWidth) + '\n');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = await ask('Select a number: ');
      const num = Number.parseInt((answer || '').trim(), 10);
      if (Number.isNaN(num)) {
        output.write('Please enter a valid number.\n');
        continue;
      }
      if (num === 0) {
        return { id: 0, label: 'User Cancelled', value: '0', actionable: false };
      }
      const picked = entries.find(e => e.id === num);
      if (!picked) {
        output.write('Out of range. Try again.\n');
        continue;
      }
      return picked;
    }
  } finally {
    if (rl) rl.close();
  }
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

/**
 * Normalize raw AI output and present selection.
 * Recommended entry point for most callers — combines normalize + select.
 * @param {string} rawOutput Raw AI-generated text with numbered options
 * @param {object} opts Options passed through to normalizeOptions and selectOption
 * @returns {Promise<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null}>}
 */
async function run(rawOutput, opts = {}) {
  const { entries, singleOption } = normalizeOptions(rawOutput, { attempt: opts.attempt ?? 0 });
  return selectOption(entries, { ...opts, singleOption });
}

module.exports = {
  selectOption,
  run,
  normalizeOptions,
  NormalizationError,
};
