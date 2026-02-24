// Matches numbered lines with optional bold/backtick wrapping and leading zeros
// Captures: group 1 = number (stripped of leading zeros), group 2 = label text
const VALID_NUMBERED_LINE = /^(?:\*{1,2}|`)?0*(\d+)\.(?:\*{1,2}|`)?\s+(.+)$/;
const RETRY_BUDGET = 2;
const DUPLICATE_HINT = 'Duplicate numbered options detected. Re-generate the list with unique sequential numbers (1, 2, 3, ...).';
const EMPTY_HINT = 'Return a numbered list only (1. ..., 2. ...), no filler.';

module.exports = {
  VALID_NUMBERED_LINE,
  RETRY_BUDGET,
  DUPLICATE_HINT,
  EMPTY_HINT,
};
