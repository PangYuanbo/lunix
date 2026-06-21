// Faithful 1:1 port of crates/vim/src/word_iterator.rs — vim w/W/b/B/e/E/ge/gE word motions.
// CharacterKind classifies each char (WordChars / Symbols / Whitespace) using is_default_word_boundary
// (warpui_core/src/text/words.rs). WordHeadsVim drives w/W/ge/gE; WordTailsVim drives b/B/e/E.
// Offsets are char indices into the line. Returns a generator of CharOffsets.
'use strict';

const DEFAULT_WORD_BOUNDARY_CHARS = new Set([
  '`', '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '=', '+', '[', '{', ']', '}',
  '\\', '|', ';', ':', "'", '"', ',', '.', '<', '>', '/', '?', '«', '»',
]);
const isWhitespace = (c) => /\s/.test(c);
function isDefaultWordBoundary(c) { return isWhitespace(c) || DEFAULT_WORD_BOUNDARY_CHARS.has(c); }

const CharacterKind = Object.freeze({ WordChars: 'WordChars', Symbols: 'Symbols', Whitespace: 'Whitespace' });
function kindOf(c) {
  if (isWhitespace(c)) return CharacterKind.Whitespace;
  if (isDefaultWordBoundary(c)) return CharacterKind.Symbols;
  return CharacterKind.WordChars;
}
// equivalent_char_kind: for BigWord, WordChars and Symbols are equivalent.
function equivalentCharKind(a, b, wordType) {
  if (wordType === 'Default') return a === b;
  return a === b || (a === CharacterKind.WordChars && b === CharacterKind.Symbols) || (a === CharacterKind.Symbols && b === CharacterKind.WordChars);
}

const Direction = Object.freeze({ Forward: 'Forward', Backward: 'Backward' });
const WordBound = Object.freeze({ Start: 'Start', End: 'End' });
const WordType = Object.freeze({ Default: 'Default', BigWord: 'BigWord' });

// A peekable char stream over the line. For Backward we operate on chars before `offset` reversed.
function makeStream(line, offset, direction) {
  const chars = Array.from(line);
  // Rust chars_rev_at(offset) yields chars strictly before offset, in reverse.
  // chars_at(offset) yields chars from offset forward.
  const seq = direction === Direction.Backward ? chars.slice(0, offset).reverse() : chars.slice(offset);
  let i = 0;
  return {
    next() { i++; },
    peek() { return i < seq.length ? seq[i] : undefined; },
    peekNth(n) { return i + n < seq.length ? seq[i + n] : undefined; },
  };
}

// WordHeadsVim: w / W / ge / gE.
function* wordHeads(offset, line, direction, wordType) {
  if (direction === Direction.Backward) offset = offset + 1;
  const s = makeStream(line, offset, direction);
  const first = s.peek();
  let cursorContext = first === undefined ? CharacterKind.WordChars : kindOf(first);
  for (;;) {
    // step
    s.next();
    offset = direction === Direction.Backward ? offset - 1 : offset + 1;
    const c = s.peek();
    if (c === undefined) { yield offset; return; }
    const prev = cursorContext;
    cursorContext = kindOf(c);
    if (!equivalentCharKind(cursorContext, prev, wordType) && cursorContext !== CharacterKind.Whitespace) {
      yield direction === Direction.Backward ? offset - 1 : offset;
    }
  }
}

// WordTailsVim: b / B / e / E.
function* wordTails(offset, line, direction, wordType) {
  if (direction === Direction.Backward) offset = offset + 1;
  const s = makeStream(line, offset, direction);
  for (;;) {
    if (s.peekNth(1) === undefined) { yield direction === Direction.Backward ? offset - 1 : offset; return; }
    s.next();
    offset = direction === Direction.Backward ? offset - 1 : offset + 1;
    const c = s.peek();
    if (c === undefined) { yield direction === Direction.Backward ? offset - 1 : offset; return; }
    const cNext = s.peekNth(1);
    if (cNext === undefined) { yield direction === Direction.Backward ? offset - 1 : offset; return; }
    const cur = kindOf(c), next = kindOf(cNext);
    if (!equivalentCharKind(cur, next, wordType) && cur !== CharacterKind.Whitespace) {
      yield direction === Direction.Backward ? offset - 1 : offset;
    }
  }
}

// Public dispatcher (vim_word_iterator_from_offset). Returns an array of all yielded offsets.
function vimWordIteratorFromOffset(offset, line, direction, bound, wordType) {
  const useHeads = (direction === Direction.Forward && bound === WordBound.Start) || (direction === Direction.Backward && bound === WordBound.End);
  const gen = useHeads ? wordHeads(offset, line, direction, wordType) : wordTails(offset, line, direction, wordType);
  return [...gen];
}

module.exports = {
  CharacterKind, kindOf, equivalentCharKind, isDefaultWordBoundary,
  Direction, WordBound, WordType, vimWordIteratorFromOffset,
};
