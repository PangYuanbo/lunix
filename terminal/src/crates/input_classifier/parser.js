// Faithful 1:1 port of crates/input_classifier/src/parser.rs — parses a query into tokens,
// keeping quoted spans ("…", '…', `…`) as single tokens and treating , . ! ? as separators.
// Mirrors the SentenceParser iterator state machine exactly.
'use strict';

function convertCharToDelimiter(c) {
  if (c === "'") return 'SingleQuote';
  if (c === '"') return 'DoubleQuote';
  if (c === '`') return 'Backtick';
  if (c === ',' || c === '.' || c === '!' || c === '?') return 'Separator';
  if (/\s/.test(c)) return 'Whitespace';
  return null;
}

function parseQueryIntoTokens(query) {
  const chars = Array.from(query);
  let i = 0;
  let activeDelimiter = null;
  let activeToken = '';
  const out = [];

  // Replicates SentenceParser::next(); returns the next token or null when exhausted.
  function next() {
    while (i < chars.length) {
      const c = chars[i++];
      const delimiter = convertCharToDelimiter(c);
      // Rust: peek().map(convert) -> None if no next char, else Some(Option<Delimiter>)
      const hasNext = i < chars.length;
      const nextDelimiter = hasNext ? convertCharToDelimiter(chars[i]) : undefined; // undefined == Rust None

      if (delimiter === 'Whitespace' && activeDelimiter === null) {
        if (activeToken === '') continue;
        const t = activeToken; activeToken = ''; return t;
      } else if (delimiter === 'Separator' && activeDelimiter === null) {
        if (activeToken === '') continue;
        // return token if next is whitespace OR there is no next char; else it's mid-word
        const ret = (nextDelimiter === undefined) ? true : (nextDelimiter === 'Whitespace');
        if (ret) { const t = activeToken; activeToken = ''; return t; }
        activeToken += c;
      } else if (delimiter === 'DoubleQuote' || delimiter === 'Backtick' || delimiter === 'SingleQuote') {
        let completeQuote;
        if (activeDelimiter === delimiter) { activeDelimiter = null; completeQuote = true; }
        else if (activeToken !== '' || activeDelimiter !== null) { completeQuote = false; }
        else { activeDelimiter = delimiter; completeQuote = false; }
        activeToken += c;
        if (completeQuote) {
          const token = activeToken; activeToken = '';
          // skip empty quotes (in-progress edits) for '' and "" (backtick has no skip in Rust)
          if ((delimiter === 'DoubleQuote' && token === '""') || (delimiter === 'SingleQuote' && token === "''")) continue;
          return token;
        }
      } else {
        activeToken += c;
      }
    }
    if (activeToken === '') return null;
    const t = activeToken; activeToken = ''; return t;
  }

  for (let tok = next(); tok !== null; tok = next()) out.push(tok);
  return out;
}

module.exports = { parseQueryIntoTokens };
