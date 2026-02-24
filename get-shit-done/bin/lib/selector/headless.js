const { formatMenuItem, stripAnsi } = require('./format');

/**
 * Handle headless selection based on flags and environment.
 * @param {Array<{id:number,label:string,value:string}>} entries
 * @param {string[]} args CLI arguments (usually process.argv.slice(2))
 * @param {Object} env Environment variables (usually process.env)
 * @param {Object} [opts] Options
 * @param {NodeJS.WritableStream} [opts.stderr] Stderr stream to use
 * @returns {{exitCode: number, result: any}}
 */
function handleHeadless(entries, args = [], env = {}, opts = {}) {
  const stderr = opts.stderr || process.stderr;
  // Precedence: --select flag > GS_DONE_SELECT env
  let selectionRaw = null;

  // Find --select in args
  const selectIndex = args.indexOf('--select');
  if (selectIndex !== -1 && args[selectIndex + 1]) {
    selectionRaw = args[selectIndex + 1];
  } else {
    // Also check for --select=N
    const selectArg = args.find(a => a.startsWith('--select='));
    if (selectArg) {
      selectionRaw = selectArg.split('=')[1];
    } else {
      selectionRaw = env.GS_DONE_SELECT;
    }
  }

  if (selectionRaw === undefined || selectionRaw === null) {
    return { exitCode: -1, result: null }; // Not in headless mode
  }

  const selection = Number.parseInt(selectionRaw, 10);
  const noColor = args.includes('--no-color') || env.NO_COLOR !== undefined;

  // Standard menu formatting
  const renderMenu = (output) => {
    const maxDigits = String(entries.length).length;
    const maxWidth = 80; // Default for headless if not specified

    for (const entry of entries) {
      let line = formatMenuItem(entry.id, entry.label, maxDigits, maxWidth);
      if (noColor) line = stripAnsi(line);
      output.write(line + '\n');
    }
    let cancelLine = formatMenuItem(0, 'Cancel/Back', maxDigits, maxWidth);
    if (noColor) cancelLine = stripAnsi(cancelLine);
    output.write(cancelLine + '\n');
  };

  if (Number.isNaN(selection)) {
    renderMenu(stderr);
    stderr.write('Invalid selection: not a number\n');
    return { exitCode: 1, result: null };
  }

  if (selection === 0) {
    return { exitCode: 0, result: { id: 0, label: 'User Cancelled', value: '0', actionable: false } };
  }

  const picked = entries.find(e => e.id === selection);
  if (!picked) {
    renderMenu(stderr);
    stderr.write(`Out of range: ${selection}\n`);
    return { exitCode: 1, result: null };
  }

  // Valid selection
  renderMenu(stderr);
  stderr.write(`[Headless] Selected: ${picked.id} (${stripAnsi(picked.label)})\n`);

  return { exitCode: 0, result: picked };
}

module.exports = {
  handleHeadless
};
