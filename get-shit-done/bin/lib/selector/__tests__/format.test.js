const test = require('node:test');
const assert = require('node:assert');
const { stripAnsi, stringWidth, truncateLabel, formatMenuItem } = require('../format');

test('stripAnsi', () => {
  assert.strictEqual(stripAnsi('\u001b[31mRed\u001b[39m'), 'Red');
  assert.strictEqual(stripAnsi('\u001b[1mBold\u001b[22m'), 'Bold');
  assert.strictEqual(stripAnsi('Plain'), 'Plain');
});

test('stringWidth', () => {
  assert.strictEqual(stringWidth('abc'), 3);
  assert.strictEqual(stringWidth('\u001b[31mabc\u001b[39m'), 3);
  assert.strictEqual(stringWidth('你好'), 4); // CJK
  assert.strictEqual(stringWidth('🚀'), 2); // Emoji (might be 2 depending on environment, our impl says 2)
});

test('truncateLabel', () => {
  // Simple truncation
  assert.deepStrictEqual(truncateLabel('Hello World', 8), { label: 'Hello...', truncated: true });
  assert.deepStrictEqual(truncateLabel('Hello', 8), { label: 'Hello', truncated: false });
  
  // CJK truncation
  // maxWidth 6, target 3. '你' (2) fits, '好' (2) doesn't.
  assert.deepStrictEqual(truncateLabel('你好世界', 6), { label: '你...', truncated: true });
});

test('formatMenuItem', () => {
  // maxDigits 1, so no leading space for 1
  assert.strictEqual(formatMenuItem(1, 'Short', 1, 40), '1. Short');
  // maxDigits 2, so leading space for 1
  assert.strictEqual(formatMenuItem(1, 'Short', 2, 40), ' 1. Short');
  assert.strictEqual(formatMenuItem(10, 'Short', 2, 40), '10. Short');
  assert.strictEqual(formatMenuItem(1, 'A very long label that should definitely be truncated because it exceeds the limit', 1, 40), '1. A very long label that should defi...');
});
