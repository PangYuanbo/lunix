// Module mirror of Warp crate `vim` (Rust: crates/vim, 4734 LOC).
// STATUS: partial — faithful 1:1 port of vim_find_matching_bracket (matching_brackets.rs) and the
// BracketChar/BracketEnd model from vim.rs. Searches forward from an opening bracket (or backward
// from a closing one) honoring nesting depth. The TextBuffer trait is modeled over a plain string
// (chars_at / chars_rev_at). The broader Vim mode state machine is warpui_core-coupled and not ported.
'use strict';

const BracketEnd = Object.freeze({ Opening: 'Opening', Closing: 'Closing' });
const BRACKETS = {
  '(': { end: BracketEnd.Opening, kind: 'Parenthesis' }, ')': { end: BracketEnd.Closing, kind: 'Parenthesis' },
  '[': { end: BracketEnd.Opening, kind: 'SquareBracket' }, ']': { end: BracketEnd.Closing, kind: 'SquareBracket' },
  '{': { end: BracketEnd.Opening, kind: 'CurlyBrace' }, '}': { end: BracketEnd.Closing, kind: 'CurlyBrace' },
};

class BracketChar {
  constructor(end, kind) { this.end = end; this.kind = kind; }
  static tryFrom(c) { const b = BRACKETS[c]; return b ? new BracketChar(b.end, b.kind) : null; }
  static fromChar(c) { const b = BracketChar.tryFrom(c); if (!b) throw new Error(`invalid bracket char: ${c}`); return b; }
  isChar(c) { const o = BracketChar.tryFrom(c); return o ? this.end === o.end && this.kind === o.kind : false; }
  complements(other) { const o = BracketChar.tryFrom(other); return o ? this.kind === o.kind && this.end !== o.end : false; }
}

// Find the bracket that pairs with bracket_char, starting at `offset` (char index into `buffer`).
function vimFindMatchingBracket(buffer, bracketChar, offset) {
  const chars = Array.from(buffer);
  // Build the search sequence: forward from offset+1 (opening) or backward from offset-1 (closing).
  let seq;
  if (bracketChar.end === BracketEnd.Opening) {
    if (offset + 1 > chars.length) return null;
    seq = chars.slice(offset + 1);
  } else {
    if (offset > chars.length) return null;
    seq = chars.slice(0, offset).reverse();
  }
  let depth = 0;
  let found = -1;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (bracketChar.isChar(c)) depth += 1;
    else if (bracketChar.complements(c)) {
      if (depth === 0) { found = i; break; }
      depth -= 1;
    }
  }
  if (found === -1) return null;
  return bracketChar.end === BracketEnd.Opening ? offset + found + 1 : offset - found - 1;
}

// Faithful 1:1 port of paragraph_iterator.rs. Offsets are char indices into `buffer`.
// find_previous_paragraph_start: scanning backward (from offset+1, exclusive of current), skip
// leading newlines, then return the offset of the second of two consecutive newlines.
function findPreviousParagraphStart(buffer, offset) {
  const chars = Array.from(buffer);
  if (offset + 1 > chars.length) return null;
  const rev = chars.slice(0, offset + 1).reverse(); // chars_rev_at(offset+1)
  let i = 0;
  while (i < rev.length && rev[i] === '\n') i++; // skip_while newline
  let prevWasNewline = false;
  for (; i < rev.length; i++) {
    const c = rev[i];
    if (c === '\n') { if (prevWasNewline) return offset + 1 - i; prevWasNewline = true; }
    else prevWasNewline = false;
  }
  return null;
}
// find_next_paragraph_end: scanning forward from offset, skip leading newlines, then return the
// offset of the second of two consecutive newlines.
function findNextParagraphEnd(buffer, offset) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const fwd = chars.slice(offset); // chars_at(offset)
  let i = 0;
  while (i < fwd.length && fwd[i] === '\n') i++; // skip_while newline
  let prevWasNewline = false;
  for (; i < fwd.length; i++) {
    const c = fwd[i];
    if (c === '\n') { if (prevWasNewline) return offset + i; prevWasNewline = true; }
    else prevWasNewline = false;
  }
  return null;
}

// Faithful 1:1 port of find_char.rs — vim f/F/t/T single-line character motions. `motion` is
// { direction:'Forward'|'Backward', destination:'AtChar'|'BeforeChar', is_repetition, c }.
const Direction = Object.freeze({ Forward: 'Forward', Backward: 'Backward' });
const FindCharDestination = Object.freeze({ AtChar: 'AtChar', BeforeChar: 'BeforeChar' });

function vimFindCharOnLine(line, currentColumn, motion, occurrenceCount, keepSelection) {
  const { direction, destination, is_repetition, c } = motion;
  let searchStart;
  if (direction === Direction.Backward && (destination === FindCharDestination.AtChar || !is_repetition)) searchStart = currentColumn;
  else if (direction === Direction.Backward && destination === FindCharDestination.BeforeChar && is_repetition) searchStart = Math.max(0, currentColumn - 1);
  else if (direction === Direction.Forward && (destination === FindCharDestination.AtChar || !is_repetition)) searchStart = currentColumn + 1;
  else searchStart = currentColumn + 2; // Forward, BeforeChar, repetition

  const chars = Array.from(line);
  const seq = direction === Direction.Backward ? chars.slice(0, searchStart).reverse() : chars.slice(searchStart);
  const target = Math.max(0, occurrenceCount - 1); // .nth(occurrence_count - 1)
  let matchIdx = 0, foundI = -1;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === c) { if (matchIdx === target) { foundI = i; break; } matchIdx++; }
  }
  if (foundI === -1) return null;
  const i = foundI;
  const moveDistance = (destination === FindCharDestination.AtChar || (destination === FindCharDestination.BeforeChar && is_repetition)) ? i + 1 : i;
  let newColumn = direction === Direction.Backward ? Math.max(0, currentColumn - moveDistance) : currentColumn + moveDistance;
  if (keepSelection && direction === Direction.Forward) newColumn += 1;
  return newColumn;
}

module.exports = {
  __crate: 'vim', __status: 'partial', __rustLoc: 4734,
  BracketEnd, BracketChar, vimFindMatchingBracket, findPreviousParagraphStart, findNextParagraphEnd,
  Direction, FindCharDestination, vimFindCharOnLine,
  wordIterator: require('./word_iterator'),
  quoteTextObject: require('./text_object_quote'),
  get paragraphTextObject() { return require('./text_object_paragraph'); },
  wordTextObject: require('./text_object_word'),
  get blockTextObject() { return require('./text_object_block'); },
  // register.rs: the black-hole register (always reads empty) + valid register names.
  BLACK_HOLE_REGISTER: '_',
  validRegisterName: (c) => /^[a-zA-Z]$/.test(c) || c === '+' || c === '*' || c === '"',
};
