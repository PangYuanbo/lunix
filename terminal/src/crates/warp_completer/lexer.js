// Faithful 1:1 port of crates/warp_completer/src/parsers/simple/lexer.rs (+ token.rs) — the naive
// shell tokenizer. Operates on UTF-8 *byte* offsets exactly like the Rust (spans are byte ranges,
// so multi-byte chars such as 😀 advance by 4). EscapeChar selects which char (\ or `) escapes the
// following token; parse_quotes_as_literals disables ' and " as quote tokens.
'use strict';

const EscapeChar = Object.freeze({ Backslash: 'Backslash', Backtick: 'Backtick' });
const escIsChar = (esc, c) => (esc === EscapeChar.Backslash ? c === '\\' : c === '`');
const utf8Len = (b) => (b < 0x80 ? 1 : b < 0xE0 ? 2 : b < 0xF0 ? 3 : 4);
const until = (a, b) => ({ start: a.start, end: b.end });

// Token constructors (token.rs).
const Tok = {
  Literal: (v) => ({ t: 'Literal', v }), Whitespace: (v) => ({ t: 'Whitespace', v }), EscapeChar: (v) => ({ t: 'EscapeChar', v }),
  Pipe: { t: 'Pipe' }, LogicalOr: { t: 'LogicalOr' }, Ampersand: { t: 'Ampersand' }, LogicalAnd: { t: 'LogicalAnd' },
  Semicolon: { t: 'Semicolon' }, Newline: { t: 'Newline' }, Backtick: { t: 'Backtick' }, OpenParen: { t: 'OpenParen' },
  CloseParen: { t: 'CloseParen' }, OpenCurly: { t: 'OpenCurly' }, CloseCurly: { t: 'CloseCurly' }, Dollar: { t: 'Dollar' },
  SingleQuote: { t: 'SingleQuote' }, DoubleQuote: { t: 'DoubleQuote' }, RedirectInput: { t: 'RedirectInput' }, RedirectOutput: { t: 'RedirectOutput' },
};

class Lexer {
  constructor(source, escapeChar, parseQuotesAsLiterals) {
    this.buf = Buffer.from(source, 'utf8');
    this.escapeChar = escapeChar;
    this.pql = parseQuotesAsLiterals;
    this.pos = 0;
    this.queued = null;
  }
  peek() {
    if (this.pos >= this.buf.length) return null;
    const end = this.pos + utf8Len(this.buf[this.pos]);
    return { span: { start: this.pos, end }, chr: this.buf.subarray(this.pos, end).toString('utf8') };
  }
  step() { const p = this.peek(); if (!p) return null; this.pos = p.span.end; return p; }
  sliceBytes(s, e) { return this.buf.subarray(s, e).toString('utf8'); }

  classifyNext() {
    if (this.queued) { const q = this.queued; this.queued = null; return q; }
    const st = this.step();
    if (!st) return null;
    const { span, chr } = st;
    const token = (item, sp) => ({ kind: 'token', sp: { item, span: sp || span } });

    if (chr === '|') { const p = this.peek(); if (p && p.chr === '|') { this.step(); return token(Tok.LogicalOr, until(span, p.span)); } return token(Tok.Pipe, span); }
    if (chr === '&') { const p = this.peek(); if (p && p.chr === '&') { this.step(); return token(Tok.LogicalAnd, until(span, p.span)); } return token(Tok.Ampersand, span); }
    if (chr === ';') return token(Tok.Semicolon, span);
    if (chr === '\n') return token(Tok.Newline, span);
    if (chr === '(') return token(Tok.OpenParen, span);
    if (chr === ')') return token(Tok.CloseParen, span);
    if (chr === '{') return token(Tok.OpenCurly, span);
    if (chr === '}') return token(Tok.CloseCurly, span);
    if (chr === '$') return token(Tok.Dollar, span);
    if (chr === "'" && !this.pql) return token(Tok.SingleQuote, span);
    if (chr === '"' && !this.pql) return token(Tok.DoubleQuote, span);
    if (chr === '<') return token(Tok.RedirectInput, span);
    if (chr === '>') return token(Tok.RedirectOutput, span);
    if ((chr === '\\' || chr === '`') && escIsChar(this.escapeChar, chr)) {
      const posAdjust = this.pos;            // byte offset of the next (escaped) char
      const nx = this.step();
      let nextToken = null;
      if (nx) {
        const sub = new Lexer(this.sliceBytes(nx.span.start, nx.span.end), this.escapeChar, this.pql);
        const t = sub.next();
        if (t) nextToken = { item: t.item, span: { start: t.span.start + posAdjust, end: t.span.end + posAdjust } };
      }
      return { kind: 'escaped', escapeChar: { item: Tok.EscapeChar(this.sliceBytes(span.start, span.end)), span }, nextToken };
    }
    if (chr === '`') return token(Tok.Backtick, span);
    if (/\s/.test(chr)) { // whitespace excluding newline (handled above)
      let sp = span;
      for (;;) { const p = this.peek(); if (p && /\s/.test(p.chr) && p.chr !== '\n') { sp = until(sp, p.span); this.step(); } else break; }
      return token(Tok.Whitespace(this.sliceBytes(sp.start, sp.end)), sp);
    }
    return { kind: 'raw', span };
  }

  next() {
    const c = this.classifyNext();
    if (!c) return null;
    if (c.kind === 'token') return c.sp;
    if (c.kind === 'escaped') { this.queued = c.nextToken ? { kind: 'token', sp: c.nextToken } : null; return c.escapeChar; }
    // raw: accumulate consecutive raw chars into one Literal
    let span = c.span;
    for (;;) {
      const o = this.classifyNext();
      if (o && o.kind === 'raw') span = until(span, o.span);
      else { this.queued = o; break; }
    }
    return { item: Tok.Literal(this.sliceBytes(span.start, span.end)), span };
  }
}

function tokenize(source, escapeChar, parseQuotesAsLiterals) {
  const lx = new Lexer(source, escapeChar, parseQuotesAsLiterals);
  const out = [];
  for (let t = lx.next(); t !== null; t = lx.next()) out.push(t);
  return out;
}

module.exports = { Lexer, EscapeChar, Tok, tokenize };
