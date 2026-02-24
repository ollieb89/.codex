const readline = require('node:readline');

/**
 * Render entries and read numeric selection.
 * @param {Array<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null,singleOption?:boolean}>} entries
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, singleOption?: boolean}} opts
 * @returns {Promise<{id:number,label:string,value:string,actionable:boolean,payload?:object|null,metadata?:object|null}>}
 */
async function selectOption(entries, opts = {}) {
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

    for (const entry of entries) {
      output.write(`${entry.id}. ${entry.label}\n`);
    }
    output.write('0. Cancel/Back\n');

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

module.exports = {
  selectOption,
};
