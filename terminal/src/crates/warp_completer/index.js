// Module mirror of Warp crate `warp_completer` (Rust: crates/warp_completer, 18194 LOC).
// STATUS: partial — faithful 1:1 port of the self-contained Span / Spanned / SpannedItem
// token-position primitives from crates/warp_completer/src/meta.rs (the foundation the parser,
// completer, and signature engines build on). The completer/parser/signature subsystems
// (completer/, parsers/, signatures/) depend on the broader completion machinery and remain to port.
'use strict';

class Span {
  constructor(start, end) {
    if (end < start) throw new Error(`Can't create a Span whose end < start, start=${start}, end=${end}`);
    this.start = start; this.end = end;
  }
  static new(start, end) { return new Span(start, end); }
  static unknown() { return new Span(0, 0); }
  static forChar(pos) { return new Span(pos, pos + 1); }
  static from(input) {
    if (input == null) return new Span(0, 0);            // Option<Span> None
    if (input instanceof Span) return new Span(input.start, input.end);
    if (Array.isArray(input)) return new Span(input[0], input[1]); // (start, end) tuple
    return new Span(0, 0);
  }
  static fromList(list) {
    if (list.length === 0) return new Span(0, 0);
    const first = list[0].span(), last = list[list.length - 1].span();
    return new Span(first.start, last.end);
  }
  until(other) { const o = Span.from(other); return new Span(this.start, o.end); }
  isEmpty() { return this.start === this.end; }
  skip(nChars) { return new Span(this.start + nChars, this.end); }
  distance() { return this.end - this.start; }
  // PartialEq<usize>/PartialOrd<usize>: compares against the span's length (end - start).
  eqLen(other) { return (this.end - this.start) === other; }
  cmpLen(other) { const d = this.end - this.start; return d < other ? -1 : d > other ? 1 : 0; }
  slice(source) { return source.slice(this.start, this.end); }
  toRange() { return { start: this.start, end: this.end }; }
}

class Spanned {
  constructor(item, span) { this.item = item; this.span = span; }
  map(fn) { return new Spanned(fn(this.item), this.span); }
  // Deref shorthand: read the contained value.
  deref() { return this.item; }
}

// SpannedItem: any value can be wrapped with a span. `spanned(value, span)` / `spannedUnknown`.
function spanned(value, span) { return new Spanned(value, Span.from(span)); }
function spannedUnknown(value) { return new Spanned(value, Span.unknown()); }

const { Lexer, EscapeChar, Tok, tokenize } = require('./lexer');
const simpleParser = require('./simple_parser');
const matchers = require('./matchers');
const signatures = require('./signatures_lookup');

module.exports = {
  __crate: 'warp_completer', __status: 'partial', __rustLoc: 18194,
  Span, Spanned, spanned, spannedUnknown,
  Lexer, EscapeChar, Tok, tokenize,
  parser: simpleParser,
  matchers,
  signatures,
};
