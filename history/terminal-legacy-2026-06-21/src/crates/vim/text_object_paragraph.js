// Faithful 1:1 port of crates/vim/src/text_objects/paragraph.rs — vim ip/ap (inner/a paragraph)
// text objects. Builds on the already-ported find_previous_paragraph_start / find_next_paragraph_end.
// Offsets are char indices; returns [start, end) or null when the offset is out of bounds.
'use strict';
// findPreviousParagraphStart / findNextParagraphEnd live in the vim index (paragraph_iterator port);
// required lazily to avoid an eager require cycle.
const findPreviousParagraphStart = (buf, off) => require('./index').findPreviousParagraphStart(buf, off);
const findNextParagraphEnd = (buf, off) => require('./index').findNextParagraphEnd(buf, off);

// take_while(c == '\n') count over chars_at(offset) / chars_rev_at(offset).
function countLeadingNewlinesForward(chars, offset) { let k = 0; for (let i = offset; i < chars.length && chars[i] === '\n'; i++) k++; return k; }
function countLeadingNewlinesBackward(chars, offset) { let k = 0; for (let i = offset - 1; i >= 0 && chars[i] === '\n'; i--) k++; return k; }
function charsCountFrom(chars, offset) { return Math.max(0, chars.length - offset); } // chars.count() of chars_at(offset)

function vimInnerParagraph(buffer, offset) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const first = offset < chars.length ? chars[offset] : undefined;
  if (first === '\n') {
    const paragraphEnd = offset - 1 + countLeadingNewlinesForward(chars, offset);
    const paragraphStart = offset + 1 - countLeadingNewlinesBackward(chars, offset);
    return { start: paragraphStart, end: paragraphEnd };
  }
  const prev = findPreviousParagraphStart(buffer, offset);
  const paragraphStart = prev !== null ? prev + 1 : 0;
  const next = findNextParagraphEnd(buffer, offset);
  const paragraphEnd = next !== null ? next - 1 : offset + charsCountFrom(chars, offset);
  return { start: paragraphStart, end: paragraphEnd };
}

function vimAParagraph(buffer, offset) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const first = offset < chars.length ? chars[offset] : undefined;
  if (first === '\n') {
    const next = findNextParagraphEnd(buffer, offset);
    const paragraphEnd = next !== null ? next - 1 : offset + charsCountFrom(chars, offset);
    const paragraphStart = offset + 1 - countLeadingNewlinesBackward(chars, offset);
    return { start: paragraphStart, end: paragraphEnd };
  }
  const endOffset = findNextParagraphEnd(buffer, offset);
  const prev = findPreviousParagraphStart(buffer, offset);
  let paragraphStart;
  if (prev !== null) {
    if (endOffset !== null) paragraphStart = prev + 1;
    else paragraphStart = prev + 1 - countLeadingNewlinesBackward(chars, prev);
  } else paragraphStart = 0;
  const paragraphEnd = endOffset !== null
    ? endOffset - 1 + countLeadingNewlinesForward(chars, endOffset)
    : offset + charsCountFrom(chars, offset);
  return { start: paragraphStart, end: paragraphEnd };
}

module.exports = { vimInnerParagraph, vimAParagraph };
