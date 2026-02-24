const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendRecord, readRecords, RING_SIZE } = require('../store');

let tmpDir;

test.beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-store-test-'));
});

test.afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// SESS-01 — Ring buffer (size 3, FIFO eviction)

test('RING_SIZE is 3', () => {
  assert.strictEqual(RING_SIZE, 3);
});

test('appendRecord to empty file creates array with 1 entry', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'git status', exitCode: 0, stderrSnippet: '' });
  const entries = readRecords(filePath);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].command, 'git status');
});

test('appendRecord 3 times produces 3 entries', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'cmd1', exitCode: 0, stderrSnippet: '' });
  appendRecord(filePath, { command: 'cmd2', exitCode: 0, stderrSnippet: '' });
  appendRecord(filePath, { command: 'cmd3', exitCode: 0, stderrSnippet: '' });
  const entries = readRecords(filePath);
  assert.strictEqual(entries.length, 3);
});

test('appendRecord 4th time evicts oldest, still 3 entries', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'cmd1', exitCode: 0, stderrSnippet: '' });
  appendRecord(filePath, { command: 'cmd2', exitCode: 0, stderrSnippet: '' });
  appendRecord(filePath, { command: 'cmd3', exitCode: 0, stderrSnippet: '' });
  appendRecord(filePath, { command: 'cmd4', exitCode: 0, stderrSnippet: '' });
  const entries = readRecords(filePath);
  assert.strictEqual(entries.length, 3);
  assert.strictEqual(entries[0].command, 'cmd2');
  assert.strictEqual(entries[2].command, 'cmd4');
});

test('readRecords on missing file returns empty array', () => {
  const filePath = path.join(tmpDir, 'nonexistent.json');
  const entries = readRecords(filePath);
  assert.deepStrictEqual(entries, []);
});

test('readRecords on corrupt file returns empty array', () => {
  const filePath = path.join(tmpDir, 'session.json');
  fs.writeFileSync(filePath, '{broken json!!!', 'utf8');
  const entries = readRecords(filePath);
  assert.deepStrictEqual(entries, []);
});

test('readRecords on empty file returns empty array', () => {
  const filePath = path.join(tmpDir, 'session.json');
  fs.writeFileSync(filePath, '', 'utf8');
  const entries = readRecords(filePath);
  assert.deepStrictEqual(entries, []);
});

// SESS-02 — Record shape

test('record contains command, exitCode, stderrSnippet, and ISO 8601 timestamp', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'git push', exitCode: 1, stderrSnippet: 'error: rejected' });
  const entries = readRecords(filePath);
  assert.strictEqual(entries.length, 1);
  const rec = entries[0];
  assert.strictEqual(typeof rec.command, 'string');
  assert.strictEqual(typeof rec.exitCode, 'number');
  assert.strictEqual(rec.exitCode, 1);
  assert.strictEqual(typeof rec.stderrSnippet, 'string');
  assert.strictEqual(typeof rec.timestamp, 'string');
  assert.match(rec.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

// SESS-03 — Atomic write

test('after appendRecord, file exists at target path with no leftover .tmp files', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'git status', exitCode: 0, stderrSnippet: '' });
  assert.ok(fs.existsSync(filePath), 'session file should exist');
  const dirFiles = fs.readdirSync(tmpDir);
  const tmpFiles = dirFiles.filter(f => f.endsWith('.tmp'));
  assert.strictEqual(tmpFiles.length, 0, 'no .tmp files should remain');
});

// SESS-04 — Permissions and redaction

test('file permissions are 0o600 after write', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'git status', exitCode: 0, stderrSnippet: '' });
  const stat = fs.statSync(filePath);
  const mode = stat.mode & 0o777;
  assert.strictEqual(mode, 0o600, 'session file must be mode 0o600');
});

test('command containing secret is stored with [REDACTED]', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'export STRIPE_SECRET_KEY=sk_live_abc123', exitCode: 0, stderrSnippet: '' });
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.ok(!raw.includes('sk_live_abc123'), 'raw secret must not appear in file');
  assert.ok(raw.includes('[REDACTED]'), 'redacted placeholder must appear');
});

test('stderrSnippet containing secret is also redacted', () => {
  const filePath = path.join(tmpDir, 'session.json');
  appendRecord(filePath, { command: 'git push', exitCode: 1, stderrSnippet: 'error: SERVICE_API_KEY=supersecret leaked' });
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.ok(!raw.includes('supersecret'), 'raw secret must not appear in stderr');
  assert.ok(raw.includes('[REDACTED]'), 'redacted placeholder must appear in stderr');
});
