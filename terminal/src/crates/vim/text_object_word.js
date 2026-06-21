// Faithful 1:1 port of crates/vim/src/text_objects/word.rs — vim iw/aw (inner/a word) text
// objects. Uses the already-ported CharacterKind classification + equivalent_char_kind from
// word_iterator. Offsets are char indices; returns [start, end) or null when out of bounds.
'use strict';
const { kindOf, equivalentCharKind, CharacterKind } = require('./word_iterator');

const fwd = (chars, offset) => chars.slice(offset);            // chars_at(offset)
const bwd = (chars, offset) => chars.slice(0, offset).reverse(); // chars_rev_at(offset)

function vimInnerWord(buffer, offset, wordType) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const forward = fwd(chars, offset);
  if (forward.length === 0) return null; // empty buffer / out of bounds
  const cursorContext = kindOf(forward[0]);

  let wordStart = offset;
  for (const c of bwd(chars, offset)) { if (!equivalentCharKind(kindOf(c), cursorContext, wordType)) break; wordStart -= 1; }
  let wordEnd = offset;
  for (const c of forward) { if (!equivalentCharKind(kindOf(c), cursorContext, wordType)) break; wordEnd += 1; }
  return { start: wordStart, end: wordEnd };
}

function vimAWord(buffer, offset, wordType) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const forward = fwd(chars, offset);
  if (forward.length === 0) return null;
  const cursorContext = kindOf(forward[0]);

  let wordStart = offset, wordEnd = offset;
  // backward/forward peekable cursors with explicit indices.
  const back = bwd(chars, offset); let bi = 0;
  let fi = 0;
  while (bi < back.length && equivalentCharKind(kindOf(back[bi]), cursorContext, wordType)) { wordStart -= 1; bi++; }
  while (fi < forward.length && equivalentCharKind(kindOf(forward[fi]), cursorContext, wordType)) { wordEnd += 1; fi++; }

  if (cursorContext === CharacterKind.Whitespace) {
    if (fi >= forward.length) return { start: wordStart, end: wordEnd };
    const nextContext = kindOf(forward[fi]);
    for (; fi < forward.length; fi++) { if (!equivalentCharKind(kindOf(forward[fi]), nextContext, wordType)) break; wordEnd += 1; }
    return { start: wordStart, end: wordEnd };
  }

  // Cursor not in whitespace: include whitespace ahead, else whitespace behind.
  if (fi >= forward.length) {
    if (bi >= back.length) return { start: wordStart, end: wordEnd };
    if (kindOf(back[bi]) === CharacterKind.Whitespace) {
      for (; bi < back.length; bi++) { if (kindOf(back[bi]) !== CharacterKind.Whitespace) break; wordStart -= 1; }
    }
    return { start: wordStart, end: wordEnd };
  }
  if (kindOf(forward[fi]) === CharacterKind.Whitespace) {
    for (; fi < forward.length; fi++) { if (kindOf(forward[fi]) !== CharacterKind.Whitespace) break; wordEnd += 1; }
  } else {
    if (bi >= back.length) return { start: wordStart, end: wordEnd };
    if (kindOf(back[bi]) === CharacterKind.Whitespace) {
      for (; bi < back.length; bi++) { if (kindOf(back[bi]) !== CharacterKind.Whitespace) break; wordStart -= 1; }
    }
  }
  return { start: wordStart, end: wordEnd };
}

module.exports = { vimInnerWord, vimAWord };
