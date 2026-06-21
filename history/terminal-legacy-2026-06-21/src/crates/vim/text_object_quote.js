// Faithful 1:1 port of crates/vim/src/text_objects/quote.rs — vim i"/a" (inner/a quote) text
// objects. vim_a_quote includes the surrounding quotes; vim_inner_quote trims them. Searches within
// the current line (cannot cross newlines), handling cursor-on-quote (odd/even quote count decides
// open vs close) and cursor-between-quotes cases. Offsets are char indices; returns [start, end) or null.
'use strict';

const QuoteType = Object.freeze({ Single: 'Single', Double: 'Double', Backtick: 'Backtick' });
function quoteIsChar(quoteType, c) {
  return (quoteType === QuoteType.Single && c === "'") || (quoteType === QuoteType.Double && c === '"') || (quoteType === QuoteType.Backtick && c === '`');
}

// take_while(c != '\n') over chars_at(offset) / chars_rev_at(offset), each .enumerate()ed.
function forwardEnum(chars, offset) {
  const out = [];
  for (let i = offset; i < chars.length && chars[i] !== '\n'; i++) out.push([i - offset, chars[i]]);
  return out;
}
function backwardEnum(chars, offset) {
  const out = [];
  for (let j = 0, i = offset - 1; i >= 0 && chars[i] !== '\n'; i--, j++) out.push([j, chars[i]]);
  return out;
}

function vimAQuote(buffer, offset, quoteType) {
  const chars = Array.from(buffer);
  if (offset > chars.length) return null;
  const forward = forwardEnum(chars, offset);   // [(i, char)] for char at offset+i
  const backward = backwardEnum(chars, offset); // [(i, char)] for char at offset-i-1
  if (forward.length === 0) return null;         // empty line
  const c = forward[0][1];

  if (!quoteIsChar(quoteType, c)) {
    let behind = null;
    for (const [i, ch] of backward) { if (quoteIsChar(quoteType, ch)) { behind = offset - i - 1; break; } }
    let aheadIdx = null; // index into `forward` where the ahead quote was found
    for (let k = 1; k < forward.length; k++) { if (quoteIsChar(quoteType, forward[k][1])) { aheadIdx = k; break; } }
    const ahead = aheadIdx === null ? null : offset + forward[aheadIdx][0];

    if (behind !== null && ahead !== null) return { start: behind, end: ahead + 1 };
    if (behind === null && ahead !== null) {
      // ahead is the opening quote; find the next quote after it.
      for (let k = aheadIdx + 1; k < forward.length; k++) {
        if (quoteIsChar(quoteType, forward[k][1])) return { start: ahead, end: offset + forward[k][0] + 1 };
      }
      return null;
    }
    return null;
  }
  // Cursor is on a quote: count quotes before it on the line.
  const quotesBehind = backward.filter(([, ch]) => quoteIsChar(quoteType, ch));
  if (quotesBehind.length % 2 === 1) {
    const i = quotesBehind[0][0];
    return { start: offset - i - 1, end: offset + 1 };
  }
  for (let k = 1; k < forward.length; k++) {
    if (quoteIsChar(quoteType, forward[k][1])) return { start: offset, end: offset + forward[k][0] + 1 };
  }
  return null;
}

function vimInnerQuote(buffer, offset, quoteType) {
  const r = vimAQuote(buffer, offset, quoteType);
  return r ? { start: r.start + 1, end: r.end - 1 } : null;
}

module.exports = { QuoteType, quoteIsChar, vimAQuote, vimInnerQuote };
