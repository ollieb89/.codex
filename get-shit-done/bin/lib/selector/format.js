/**
 * Formatting utilities for the selector
 */

/**
 * Strip ANSI escape codes from a string
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  if (typeof str !== 'string') return str;
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

/**
 * Get the visible width of a string (cell count)
 * Simple implementation: 2 for CJK/Emoji ranges, 1 otherwise.
 * @param {string} str
 * @returns {number}
 */
function stringWidth(str) {
  const stripped = stripAnsi(str);
  let width = 0;
  for (let i = 0; i < stripped.length; i++) {
    const code = stripped.charCodeAt(i);
    // Basic CJK/Emoji range check (covers common cases)
    if (code >= 0x1100 && (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2329 && code <= 0x232a) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    )) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Truncate a string to a maximum width
 * @param {string} str
 * @param {number} maxWidth
 * @returns {{label: string, truncated: boolean}}
 */
function truncateLabel(str, maxWidth) {
  const width = stringWidth(str);
  if (width <= maxWidth) {
    return { label: str, truncated: false };
  }

  // Truncate and add ellipsis
  const targetWidth = maxWidth - 3;
  let currentWidth = 0;
  let result = '';
  const stripped = stripAnsi(str); // Simplified: truncate stripped version if original is too complex
  
  // Actually, we should try to preserve formatting if possible, 
  // but for simplicity in this "lean" project, we'll strip if it's too long
  // and return the stripped truncated version if NO_COLOR is handled elsewhere.
  // The research says: "ANSI stripping before width calc"
  
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    const charWidth = stringWidth(char);
    if (currentWidth + charWidth > targetWidth) break;
    result += char;
    currentWidth += charWidth;
  }

  return { label: result + '...', truncated: true };
}

/**
 * Format a numbered menu item
 * @param {number} id
 * @param {string} label
 * @param {number} maxDigits
 * @param {number} maxWidth
 * @returns {string}
 */
function formatMenuItem(id, label, maxDigits, maxWidth) {
  const prefix = String(id).padStart(maxDigits, ' ') + '. ';
  const prefixWidth = prefix.length;
  const availableWidth = maxWidth - prefixWidth;
  
  const { label: truncatedLabel } = truncateLabel(label, availableWidth);
  return prefix + truncatedLabel;
}

module.exports = {
  stripAnsi,
  stringWidth,
  truncateLabel,
  formatMenuItem
};
