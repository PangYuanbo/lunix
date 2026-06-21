// Module mirror of Warp crate `warp_terminal` (Rust: crates/warp_terminal, 8900 LOC).
// STATUS: partial — faithful 1:1 port of the self-contained shell unescape_quotes from
// crates/warp_terminal/src/shell/unescape.rs (single-quote literal, ANSI-C $'...' escape
// translation, and double-quote backslash rules). The terminal model/grid/render is
// warpui_core-coupled and not ported here.
'use strict';

const QS = { None: 0, Single: 1, Double: 2, AnsiC: 3 };
// ANSI-C escape translations (https://en.wikipedia.org/wiki/Escape_sequences_in_C).
const ANSI_C = { a: '\x07', b: '\x08', e: '\x1B', E: '\x1B', f: '\x0C', n: '\n', r: '\r', t: '\t', v: '\x0B' };

// Unescape alias outputs in single-quote and ANSI-C ($'...') quoting. Throws on a trailing escape.
function unescapeQuotes(s) {
  const chars = Array.from(s);
  let quoting = QS.None;
  let res = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "'" && (quoting === QS.Single || quoting === QS.AnsiC)) { quoting = QS.None; }
    else if (c === "'" && quoting === QS.None) { quoting = QS.Single; }
    else if (c === '"' && quoting === QS.Double) { quoting = QS.None; }
    else if (c === '"' && quoting === QS.None) { quoting = QS.Double; }
    else if (c === '\\' && quoting === QS.AnsiC) {
      if (i + 1 >= chars.length) throw new Error(`invalid escape at char ${i} in string ${s}`);
      const next = chars[++i];
      res += Object.prototype.hasOwnProperty.call(ANSI_C, next) ? ANSI_C[next] : next;
    } else if (c === '\\' && quoting === QS.Double) {
      if (i + 1 >= chars.length) throw new Error(`invalid escape at char ${i} in string ${s}`);
      const next = chars[++i];
      if (next === '$' || next === '`' || next === '"' || next === '\\') res += next;
      else if (next === '\n') { /* ignored */ }
      else { res += '\\'; res += next; }
    } else if (c === '\\' && quoting === QS.None) {
      if (i + 1 >= chars.length) throw new Error(`invalid escape at char ${i} in string ${s}`);
      const next = chars[++i];
      if (next === '\n') { /* ignored */ } else res += next;
    } else if (c === '$' && quoting === QS.None) {
      if (chars[i + 1] === "'") { quoting = QS.AnsiC; i++; }
      else res += '$';
    } else {
      res += c;
    }
  }
  return res;
}

module.exports = { __crate: 'warp_terminal', __status: 'partial', __rustLoc: 8900, unescapeQuotes, cell: require('./cell'), content: require('./content'), attributeMap: require('./attribute_map'), indexing: require('./indexing') };
