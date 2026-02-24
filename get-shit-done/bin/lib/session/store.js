'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { redactSecrets } = require('../dispatcher/sanitize');

const RING_SIZE = 3;

/**
 * Read session records from file.
 * Returns [] on missing, empty, or corrupt file.
 * @param {string} filePath
 * @returns {Array}
 */
function readRecords(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data;
  } catch (_err) {
    return [];
  }
}

/**
 * Append a session record to the ring buffer file.
 * Redacts secrets before writing. Atomic via temp + rename. Permissions 0o600.
 * @param {string} filePath
 * @param {{ command: string, exitCode: number, stderrSnippet: string }} record
 */
function appendRecord(filePath, { command, exitCode, stderrSnippet }) {
  let entries = readRecords(filePath);

  const { redacted: redactedCommand } = redactSecrets(command || '');
  const { redacted: redactedSnippet } = redactSecrets(stderrSnippet || '');

  const rec = {
    command: redactedCommand,
    exitCode,
    stderrSnippet: redactedSnippet,
    timestamp: new Date().toISOString(),
  };

  entries.push(rec);
  if (entries.length > RING_SIZE) {
    entries = entries.slice(entries.length - RING_SIZE);
  }

  // Atomic write: temp file in same directory + renameSync
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = path.join(dir, `.session-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
}

module.exports = { appendRecord, readRecords, RING_SIZE };
