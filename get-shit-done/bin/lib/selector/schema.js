const VALID_NUMBERED_LINE = /^\d+\.\s+.+$/;
const RETRY_BUDGET = 1;
const DUPLICATE_HINT = 'Ensure unique numbering and no filler text.';
const EMPTY_HINT = 'Return a numbered list only (1. ..., 2. ...), no filler.';

module.exports = {
  VALID_NUMBERED_LINE,
  RETRY_BUDGET,
  DUPLICATE_HINT,
  EMPTY_HINT,
};
