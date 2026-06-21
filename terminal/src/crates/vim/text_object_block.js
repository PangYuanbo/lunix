// Faithful 1:1 port of crates/vim/src/text_objects/block.rs — vim i{/a{ (and (), []) block text
// objects, built on the already-ported vim_find_matching_bracket + BracketChar model. a-block
// includes the brackets; inner-block trims them plus "trailing padding" (whitespace+newline before
// the closing bracket) and, when preserveLeadingPadding is false (the `d` command), the leading
// padding after the opening bracket. Offsets are char indices; returns [start, end) or null.
'use strict';
const { BracketChar, BracketEnd, vimFindMatchingBracket } = require('./index');

const isWs = (c) => c !== undefined && /\s/.test(c);

function vimABlock(buffer, offset, bracketType) {
  const chars = Array.from(buffer);
  const c = offset < chars.length ? chars[offset] : undefined;
  if (c === undefined) return null;

  const onBracket = BracketChar.tryFrom(c);
  if (onBracket && onBracket.kind === bracketType) {
    const other = vimFindMatchingBracket(buffer, onBracket, offset);
    if (other === null) return null;
    const [start, end] = other > offset ? [offset, other] : [other, offset];
    return { start, end: end + 1 };
  }
  const endOffset = vimFindMatchingBracket(buffer, new BracketChar(BracketEnd.Opening, bracketType), offset);
  if (endOffset === null) return null;
  const startOffset = vimFindMatchingBracket(buffer, new BracketChar(BracketEnd.Closing, bracketType), endOffset);
  if (startOffset === null) return null;
  return { start: startOffset, end: endOffset + 1 };
}

function vimInnerBlock(buffer, offset, bracketType, preserveLeadingPadding) {
  const range = vimABlock(buffer, offset, bracketType);
  if (range === null) return null;
  const chars = Array.from(buffer);
  let blockStart = range.start + 1;
  let blockEnd = range.end - 1;

  // Trailing padding: scanning backward from blockEnd over whitespace, find the first '\n'.
  { let i = -1, j = 0;
    for (let pos = blockEnd - 1; pos >= 0; pos--, j++) { const ch = chars[pos]; if (!isWs(ch)) break; if (ch === '\n') { i = j; break; } }
    if (i >= 0) blockEnd -= i + 1; }

  // Leading padding (only for the `c` command, which preserves it): scanning forward over
  // whitespace from blockStart, find the first '\n'.
  if (preserveLeadingPadding) {
    let i = -1, j = 0;
    for (let pos = blockStart; pos < chars.length; pos++, j++) { const ch = chars[pos]; if (!isWs(ch)) break; if (ch === '\n') { i = j; break; } }
    if (i >= 0) blockStart += i + 1;
  }
  return { start: blockStart, end: blockEnd };
}

module.exports = { vimABlock, vimInnerBlock };
