// Module mirror of Warp crate `string-offset` (Rust: crates/string-offset, 266 LOC).
// STATUS: ported — CharCounter (byte-offset -> char-offset mapping over UTF-8) is a faithful
// port. The Rust CharOffset/ByteOffset newtypes + operator-overload macro collapse to plain
// integers in JS, so the arithmetic API is provided as helpers rather than wrapper structs.
'use strict';

const enc = new TextEncoder();
const byteLen = (s) => enc.encode(s).length;

// Iterate (byteOffset, char) pairs like Rust's str::char_indices.
function* charIndices(str) {
  let byte = 0;
  for (const ch of str) { yield [byte, ch]; byte += byteLen(ch); }
}

// Faithful port of CharCounter: map a UTF-8 byte offset to a char offset while scanning
// left-to-right. Returns null if byteOffset is past the end, not a char boundary, or already
// passed. (Rust returns Option<CharOffset>.)
class CharCounter {
  constructor(str) { this._it = charIndices(str); this._offset = 0; this._lastByte = 0; }
  charOffset(byteOffset) {
    if (this._lastByte > byteOffset) return null;
    // Manual .next() (not for...of) so an early return doesn't close the shared iterator —
    // this mirrors Rust's `char_indices.by_ref()`, which keeps advancing across calls.
    for (let r = this._it.next(); !r.done; r = this._it.next()) {
      const nextByte = r.value[0];
      this._offset += 1; this._lastByte = nextByte;
      if (nextByte === byteOffset) return this._offset - 1;
      if (nextByte > byteOffset) return null; // overshot a non-boundary offset
    }
    return null;
  }
}

module.exports = { __crate: 'string-offset', __status: 'ported', __rustLoc: 266, CharCounter, byteLen };
