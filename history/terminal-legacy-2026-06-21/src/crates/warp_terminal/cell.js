// Faithful 1:1 port of the self-contained parts of crates/warp_terminal/src/model/grid/cell.rs
// (itself adapted from alacritty_terminal): the Flags bitflags, the Cell content model with
// zero-width grapheme accumulation (push_zerowidth, capped at MAX_GRAPHEME_BYTES), raw_content /
// content_for_display, and is_empty / is_visible. Color is modeled as named-color strings.
'use strict';

const DEFAULT_CHAR = '\0';
const MAX_GRAPHEME_BYTES = 256;
const WARN_GRAPHEME_BYTES = 128;
const byteLen = (s) => Buffer.byteLength(s, 'utf8');

// Flags bitflags (u16). intersects(a, b) === (a & b) !== 0.
const Flags = {
  INVERSE: 0x0001, BOLD: 0x0002, ITALIC: 0x0004, BOLD_ITALIC: 0x0006, UNDERLINE: 0x0008,
  WRAPLINE: 0x0010, WIDE_CHAR: 0x0020, WIDE_CHAR_SPACER: 0x0040, DIM: 0x0080, DIM_BOLD: 0x0082,
  HIDDEN: 0x0100, STRIKEOUT: 0x0200, LEADING_WIDE_CHAR_SPACER: 0x0400, DOUBLE_UNDERLINE: 0x0800,
  HAS_CURSOR: 0x1000, CELL_DECORATIONS: 0x0A08,
  empty: () => 0,
  intersects: (a, b) => (a & b) !== 0,
};

// CharOrStr: { Char } | { Str }.
const CharOrStr = { Char: (c) => ({ kind: 'Char', value: c }), Str: (s) => ({ kind: 'Str', value: s }) };

const Color = { Background: 'Named:Background', Foreground: 'Named:Foreground', Named: (n) => 'Named:' + n };

class Cell {
  constructor(opts = {}) {
    this.c = opts.c !== undefined ? opts.c : DEFAULT_CHAR;
    this.fg = opts.fg !== undefined ? opts.fg : Color.Foreground;
    this.bg = opts.bg !== undefined ? opts.bg : Color.Background;
    this.flags = opts.flags !== undefined ? opts.flags : Flags.empty();
    this.extra = null; // { cell_with_zero_width?, end_of_prompt? }
  }
  contentWithZerowidth() { return this.extra ? (this.extra.cell_with_zero_width ?? null) : null; }
  rawContent() { const z = this.contentWithZerowidth(); return z !== null ? CharOrStr.Str(z) : CharOrStr.Char(this.c); }
  contentForDisplay() { const r = this.rawContent(); return (r.kind === 'Char' && r.value === DEFAULT_CHAR) ? CharOrStr.Char(' ') : r; }

  pushZerowidth(c, _logLongGraphemeWarnings) {
    if (this.c === DEFAULT_CHAR) this.c = ' ';
    if (!this.extra) this.extra = {};
    if (this.extra.cell_with_zero_width != null) {
      const oldLen = byteLen(this.extra.cell_with_zero_width);
      const newLen = oldLen + byteLen(c);
      if (newLen > MAX_GRAPHEME_BYTES) return; // drop beyond the cap
      this.extra.cell_with_zero_width += c;
    } else {
      this.extra.cell_with_zero_width = this.c + c; // seed with base char
    }
  }

  isEmpty() {
    const masks = Flags.INVERSE | Flags.UNDERLINE | Flags.DOUBLE_UNDERLINE | Flags.STRIKEOUT
      | Flags.WRAPLINE | Flags.WIDE_CHAR_SPACER | Flags.LEADING_WIDE_CHAR_SPACER | Flags.HAS_CURSOR;
    return this.c === DEFAULT_CHAR && this.bg === Color.Background && this.fg === Color.Foreground && !Flags.intersects(this.flags, masks);
  }
  isVisible() { return !this.isEmpty() && !/^[\t\n\v\f\r ]$/.test(this.c); }
}

module.exports = { Cell, Flags, CharOrStr, Color, DEFAULT_CHAR, MAX_GRAPHEME_BYTES, WARN_GRAPHEME_BYTES };
