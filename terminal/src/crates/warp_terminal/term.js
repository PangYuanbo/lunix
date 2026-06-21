// Terminal model — Warp's `alacritty_terminal`-style Grid<Cell> + the ANSI Performer that the VTE
// parser drives. This is the engine that replaces xterm.js: it owns the screen grid, the cursor,
// the SGR pen, scroll regions and tab stops, and applies every CSI/ESC/SGR/control action.
//
// Pipeline: PTY bytes -> Parser (vte.js) -> this Performer -> Grid<Cell> -> GPU renderer reads the
// grid. Colors are kept as structured descriptors (default / ansi index / rgb) and resolved to
// pixels at render time against the active palette.
'use strict';
// IIFE-wrapped so a <script>-tag load leaks nothing into global scope. A bare top-level
// `class Terminal` would otherwise shadow xterm.js's window.Terminal and break its panes; a bare
// `class Parser` would collide with vte.js. Only the window.* exports at the bottom are global.
(function () {
const VteParserClass = ((typeof require !== 'undefined') ? require('./vte').Parser : (typeof window !== 'undefined' ? window.VteParser : globalThis.VteParser));

// Cross-env UTF-8 helpers (Node Buffer OR browser TextEncoder/Decoder) — the engine runs in both.
const _dec = (typeof TextDecoder !== 'undefined') ? new TextDecoder('utf-8') : null;
const decodeUtf8 = (bytes) => _dec ? _dec.decode(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)) : Buffer.from(bytes).toString('utf8');
const encodeUtf8 = (s) => (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8'));

// --- color descriptors ---
const DEFAULT_FG = { t: 'fg' };
const DEFAULT_BG = { t: 'bg' };
const idx = (i) => ({ t: 'idx', i });
const rgb = (r, g, b) => ({ t: 'rgb', r, g, b });

// East-Asian / emoji width. Minimal but covers the cases Warp's grid cares about (wide chars take
// two cells with a spacer). Combining marks are width 0.
function charWidth(cp) {
  if (cp === 0) return 0;
  if (cp < 0x20) return 0;
  if ((cp >= 0x300 && cp <= 0x36f) || (cp >= 0x1ab0 && cp <= 0x1aff) || (cp >= 0x1dc0 && cp <= 0x1dff)
    || (cp >= 0x20d0 && cp <= 0x20ff) || (cp >= 0xfe20 && cp <= 0xfe2f)) return 0; // combining
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||  // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) ||  // CJK radicals …
    (cp >= 0x3041 && cp <= 0x33ff) ||  // Hiragana..CJK symbols
    (cp >= 0x3400 && cp <= 0x4dbf) ||  // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) ||  // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) ||  // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) ||  // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||  // CJK compat
    (cp >= 0xfe30 && cp <= 0xfe4f) ||  // CJK compat forms
    (cp >= 0xff00 && cp <= 0xff60) ||  // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji & symbols
    (cp >= 0x20000 && cp <= 0x3fffd)    // CJK Ext B+
  ) return 2;
  return 1;
}

class Cell {
  constructor() { this.reset(); }
  reset() {
    this.c = ' '; this.fg = DEFAULT_FG; this.bg = DEFAULT_BG; this.width = 1;
    this.bold = false; this.italic = false; this.underline = false;
    this.strike = false; this.inverse = false; this.dim = false; this.hidden = false; this.spacer = false;
    this.link = null;
  }
  copyPen(pen) {
    this.fg = pen.fg; this.bg = pen.bg; this.bold = pen.bold; this.italic = pen.italic;
    this.underline = pen.underline; this.strike = pen.strike; this.inverse = pen.inverse;
    this.dim = pen.dim; this.hidden = pen.hidden;
  }
}

class Terminal {
  constructor(cols = 80, rows = 24, opts = {}) {
    this.cols = cols; this.rows = rows;
    this.grid = [];
    for (let r = 0; r < rows; r++) this.grid.push(this._blankRow());
    this.cursor = { row: 0, col: 0 };
    this.saved = null;
    this.curLink = null;                            // active OSC 8 hyperlink URI (persists across SGR)
    this.pen = this._defaultPen();
    this.top = 0; this.bottom = rows - 1;          // scroll region
    this.wrapNext = false;                          // deferred wrap (alacritty behaviour)
    this.autowrap = true;
    this.cursorVisible = true;
    this.tabs = this._defaultTabs(cols);
    this.parser = new VteParserClass();
    this.onOsc = opts.onOsc || null;                // (numStr, args[]) => void
    this.onBell = opts.onBell || null;
    this.onAltScreen = opts.onAltScreen || null;    // (boolean) => void  — alt buffer enter/exit
    this.altScreen = false; this._mainBuf = null; this.bracketedPaste = false;
    this.scrollback = [];                            // rows scrolled off the top (oldest first)
    this.maxScrollback = opts.maxScrollback || 5000;
  }

  _defaultPen() { return { fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false, italic: false, underline: false, strike: false, inverse: false, dim: false, hidden: false }; }
  _blankRow() { const row = new Array(this.cols); for (let c = 0; c < this.cols; c++) row[c] = new Cell(); return row; }
  _defaultTabs(cols) { const t = new Array(cols).fill(false); for (let i = 8; i < cols; i += 8) t[i] = true; return t; }

  // ---- public API ----
  write(bytes) { this.parser.advance(this, bytes instanceof Uint8Array ? bytes : (typeof bytes === 'string' ? encodeUtf8(bytes) : Uint8Array.from(bytes))); }
  cell(r, c) { return this.grid[r] && this.grid[r][c]; }
  resize(cols, rows) {
    if (cols === this.cols && rows === this.rows) return;
    const old = this.grid; const oldRows = this.rows;
    this.grid = []; for (let r = 0; r < rows; r++) {
      const row = this._blankRow();
      if (r < oldRows) for (let c = 0; c < Math.min(cols, this.cols); c++) row[c] = old[r][c];
      this.grid.push(row);
    }
    this.cols = cols; this.rows = rows; this.top = 0; this.bottom = rows - 1;
    this.tabs = this._defaultTabs(cols);
    this.cursor.row = Math.min(this.cursor.row, rows - 1);
    this.cursor.col = Math.min(this.cursor.col, cols - 1);
  }

  // ---- VTE Performer callbacks ----
  print(ch) {
    const cp = ch.codePointAt(0);
    const w = charWidth(cp);
    if (w === 0) { // combining: attach to the cell left of the cursor
      const c = this.cursor.col > 0 ? this.cursor.col - 1 : 0;
      const cell = this.cell(this.cursor.row, c); if (cell) cell.c += ch;
      return;
    }
    if (this.wrapNext && this.autowrap) { this.grid[this.cursor.row]._wrapped = true; this._lineFeed(); this.cursor.col = 0; this.wrapNext = false; }
    if (this.cursor.col + w > this.cols) {
      if (this.autowrap) { this.grid[this.cursor.row]._wrapped = true; this._lineFeed(); this.cursor.col = 0; }
      else this.cursor.col = this.cols - w;
    }
    const row = this.grid[this.cursor.row];
    const cell = row[this.cursor.col]; cell.reset(); cell.copyPen(this.pen); cell.c = ch; cell.width = w; cell.link = this.curLink;
    if (w === 2) { const sp = row[this.cursor.col + 1]; if (sp) { sp.reset(); sp.copyPen(this.pen); sp.c = ' '; sp.spacer = true; sp.link = this.curLink; } }
    this.cursor.col += w;
    if (this.cursor.col >= this.cols) { this.cursor.col = this.cols - 1; this.wrapNext = true; }
  }

  execute(b) {
    switch (b) {
      case 0x0a: case 0x0b: case 0x0c: this._lineFeed(); this.wrapNext = false; break; // LF/VT/FF
      case 0x0d: this.cursor.col = 0; this.wrapNext = false; break;                     // CR
      case 0x08: if (this.cursor.col > 0) this.cursor.col--; this.wrapNext = false; break; // BS
      case 0x09: this._tab(); break;                                                    // TAB
      case 0x07: this.onBell && this.onBell(); break;                                   // BEL
      default: break;
    }
  }

  _tab() {
    let c = this.cursor.col + 1;
    while (c < this.cols && !this.tabs[c]) c++;
    this.cursor.col = Math.min(c, this.cols - 1);
  }
  _lineFeed() {
    if (this.cursor.row === this.bottom) this._scrollUp(1);
    else if (this.cursor.row < this.rows - 1) this.cursor.row++;
  }
  _scrollUp(n) {
    for (let k = 0; k < n; k++) {
      const evicted = this.grid.splice(this.top, 1)[0];
      // Only full-screen scrolling (region starts at the top) contributes to scrollback history.
      // Alt-screen apps (vim/top) never accumulate scrollback.
      if (this.top === 0 && !this.altScreen) { this.scrollback.push(evicted); if (this.scrollback.length > this.maxScrollback) this.scrollback.shift(); }
      this.grid.splice(this.bottom, 0, this._blankRow());
    }
  }
  // Total logical rows (history + viewport) and a row accessor across both, for the renderer.
  totalRows() { return this.scrollback.length + this.rows; }
  rowAt(i) { return i < this.scrollback.length ? this.scrollback[i] : this.grid[i - this.scrollback.length]; }
  _scrollDown(n) {
    for (let k = 0; k < n; k++) { this.grid.splice(this.bottom, 1); this.grid.splice(this.top, 0, this._blankRow()); }
  }

  csiDispatch(params, inter, finalB) {
    const priv = inter.length && inter[0] === 0x3f; // '?'
    // Any private-parameter prefix (< = > ?). `CSI > 4;2 m` (modifyOtherKeys) and `CSI < u`/`CSI > 1 u`
    // (kitty keyboard) must NOT be treated as SGR/cursor ops — that bug underlined whole agent CLIs.
    const privMark = inter.length && inter[0] >= 0x3c && inter[0] <= 0x3f;
    const fin = String.fromCharCode(finalB);
    const p = (i, d) => { const v = params[i] && params[i][0]; return v === undefined || v === 0 ? (d === undefined ? 0 : d) : v; };
    const p1 = (i, d) => { const v = params[i] && params[i][0]; return v === undefined ? d : v; };
    switch (fin) {
      case 'A': this.cursor.row = Math.max(this.top, this.cursor.row - p(0, 1)); this.wrapNext = false; break;
      case 'B': this.cursor.row = Math.min(this.bottom, this.cursor.row + p(0, 1)); this.wrapNext = false; break;
      case 'C': this.cursor.col = Math.min(this.cols - 1, this.cursor.col + p(0, 1)); this.wrapNext = false; break;
      case 'D': this.cursor.col = Math.max(0, this.cursor.col - p(0, 1)); this.wrapNext = false; break;
      case 'E': this.cursor.row = Math.min(this.bottom, this.cursor.row + p(0, 1)); this.cursor.col = 0; break;
      case 'F': this.cursor.row = Math.max(this.top, this.cursor.row - p(0, 1)); this.cursor.col = 0; break;
      case 'G': case '`': this.cursor.col = Math.min(this.cols - 1, Math.max(0, p1(0, 1) - 1)); this.wrapNext = false; break;
      case 'd': this.cursor.row = Math.min(this.rows - 1, Math.max(0, p1(0, 1) - 1)); break;
      case 'H': case 'f': this.cursor.row = Math.min(this.rows - 1, Math.max(0, p1(0, 1) - 1)); this.cursor.col = Math.min(this.cols - 1, Math.max(0, p1(1, 1) - 1)); this.wrapNext = false; break;
      case 'J': this._eraseDisplay(p(0, 0)); break;
      case 'K': this._eraseLine(p(0, 0)); break;
      case 'L': this._insertLines(p(0, 1)); break;
      case 'M': this._deleteLines(p(0, 1)); break;
      case '@': this._insertChars(p(0, 1)); break;
      case 'P': this._deleteChars(p(0, 1)); break;
      case 'X': this._eraseChars(p(0, 1)); break;
      case 'S': this._scrollUp(p(0, 1)); break;
      case 'T': this._scrollDown(p(0, 1)); break;
      case 'm': if (!privMark) this._sgr(params); break;  // ignore private `CSI > … m` (modifyOtherKeys)
      case 'r': this._setRegion(p1(0, 1), p1(1, this.rows)); break;
      case 'h': this._mode(params, priv, true); break;
      case 'l': this._mode(params, priv, false); break;
      case 's': this.saved = { ...this.cursor, pen: { ...this.pen } }; break;
      case 'u': if (!privMark && this.saved) { this.cursor.row = this.saved.row; this.cursor.col = this.saved.col; } break;  // private `CSI <u`/`CSI >1u` = kitty keyboard, ignore
      default: break;
    }
  }

  escDispatch(inter, finalB) {
    const fin = String.fromCharCode(finalB);
    if (inter.length) return; // charset designations etc. — consume
    switch (fin) {
      case 'M': if (this.cursor.row === this.top) this._scrollDown(1); else if (this.cursor.row > 0) this.cursor.row--; break; // RI
      case 'D': this._lineFeed(); break;                       // IND
      case 'E': this._lineFeed(); this.cursor.col = 0; break;  // NEL
      case '7': this.saved = { ...this.cursor, pen: { ...this.pen } }; break;
      case '8': if (this.saved) { this.cursor.row = this.saved.row; this.cursor.col = this.saved.col; this.pen = { ...this.saved.pen }; } break;
      case 'c': this._reset(); break;                          // RIS
      default: break;
    }
  }

  oscDispatch(slices, bell) {
    if (bell) this.onBell && this.onBell();
    if (!slices.length) return;
    const num = decodeUtf8(slices[0]);
    const args = slices.slice(1).map((s) => decodeUtf8(s));
    // OSC 8 ; params ; URI  — explicit hyperlink; empty URI closes it. Tracked on the terminal so it
    // persists across SGR changes (independent of the pen). Cells written meanwhile carry cell.link.
    // Handled here (not via onOsc) because it's terminal state — must run even with no onOsc callback.
    if (num === '8') { this.curLink = (args[1] || '') || null; return; }
    if (this.onOsc) this.onOsc(num, args);
  }
  hook() {} put() {} unhook() {}

  // ---- erase / edit helpers ----
  _blankAt(r, c) { const cell = this.grid[r][c]; cell.reset(); cell.bg = this.pen.bg; }
  _eraseDisplay(mode) {
    if (mode === 0) { for (let c = this.cursor.col; c < this.cols; c++) this._blankAt(this.cursor.row, c); for (let r = this.cursor.row + 1; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this._blankAt(r, c); }
    else if (mode === 1) { for (let r = 0; r < this.cursor.row; r++) for (let c = 0; c < this.cols; c++) this._blankAt(r, c); for (let c = 0; c <= this.cursor.col; c++) this._blankAt(this.cursor.row, c); }
    else { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this._blankAt(r, c); }
  }
  _eraseLine(mode) {
    const r = this.cursor.row;
    if (mode === 0) for (let c = this.cursor.col; c < this.cols; c++) this._blankAt(r, c);
    else if (mode === 1) for (let c = 0; c <= this.cursor.col; c++) this._blankAt(r, c);
    else for (let c = 0; c < this.cols; c++) this._blankAt(r, c);
  }
  _insertLines(n) {
    if (this.cursor.row < this.top || this.cursor.row > this.bottom) return;
    for (let k = 0; k < n; k++) { this.grid.splice(this.bottom, 1); this.grid.splice(this.cursor.row, 0, this._blankRow()); }
  }
  _deleteLines(n) {
    if (this.cursor.row < this.top || this.cursor.row > this.bottom) return;
    for (let k = 0; k < n; k++) { this.grid.splice(this.cursor.row, 1); this.grid.splice(this.bottom, 0, this._blankRow()); }
  }
  _insertChars(n) {
    const row = this.grid[this.cursor.row];
    for (let k = 0; k < n; k++) { row.pop(); row.splice(this.cursor.col, 0, new Cell()); }
  }
  _deleteChars(n) {
    const row = this.grid[this.cursor.row];
    for (let k = 0; k < n; k++) { row.splice(this.cursor.col, 1); row.push(new Cell()); }
  }
  _eraseChars(n) { for (let c = this.cursor.col; c < Math.min(this.cols, this.cursor.col + n); c++) this._blankAt(this.cursor.row, c); }
  _setRegion(top, bot) { this.top = Math.max(0, top - 1); this.bottom = Math.min(this.rows - 1, bot - 1); if (this.top >= this.bottom) { this.top = 0; this.bottom = this.rows - 1; } this.cursor.row = this.top; this.cursor.col = 0; }
  _reset() { for (let r = 0; r < this.rows; r++) this.grid[r] = this._blankRow(); this.cursor = { row: 0, col: 0 }; this.pen = this._defaultPen(); this.curLink = null; this.top = 0; this.bottom = this.rows - 1; }

  _mode(params, priv, on) {
    for (const pp of params) {
      const n = pp[0];
      if (priv) {
        if (n === 7) this.autowrap = on;
        else if (n === 25) this.cursorVisible = on;
        else if (n === 2004) this.bracketedPaste = on;
        else if (n === 1048) { if (on) this._saveCursor(); else this._restoreCursor(); }   // cursor save/restore
        else if (n === 47 || n === 1047) on ? this._altEnter(false) : this._altExit(false); // alt buffer
        else if (n === 1049) on ? this._altEnter(true) : this._altExit(true);               // alt buffer + cursor
        // 1000.. mouse: acknowledged, not modeled here
      }
    }
  }

  _saveCursor() { this.saved = { row: this.cursor.row, col: this.cursor.col, pen: { ...this.pen } }; }
  _restoreCursor() { if (this.saved) { this.cursor.row = this.saved.row; this.cursor.col = this.saved.col; this.pen = { ...this.saved.pen }; } }

  // Alternate screen buffer (vim/top/less/htop). The alt buffer is screen-sized with no scrollback;
  // the main buffer (grid + scrollback + cursor) is stashed and restored on exit. saveCursor=true for
  // 1049 (DECSET save/restore cursor too). onAltScreen lets the UI switch to a full-screen render.
  _altEnter(saveCursor) {
    if (this.altScreen) return;
    if (saveCursor) this._saveCursor();
    this._mainBuf = { grid: this.grid, scrollback: this.scrollback, cursor: this.cursor, saved: this.saved, top: this.top, bottom: this.bottom };
    this.grid = []; for (let r = 0; r < this.rows; r++) this.grid.push(this._blankRow());
    this.scrollback = []; this.cursor = { row: 0, col: 0 }; this.top = 0; this.bottom = this.rows - 1;
    this.altScreen = true;
    if (this.onAltScreen) this.onAltScreen(true);
  }
  _altExit(restoreCursor) {
    if (!this.altScreen || !this._mainBuf) { this.altScreen = false; return; }
    const m = this._mainBuf;
    let grid = m.grid;                                  // a resize while in alt left this at the old size
    if (grid.length > this.rows) grid = grid.slice(grid.length - this.rows);
    while (grid.length < this.rows) grid.unshift(this._blankRow());
    this.grid = grid; this.scrollback = m.scrollback; this.top = 0; this.bottom = this.rows - 1;
    this.cursor = { row: Math.min(m.cursor.row, this.rows - 1), col: Math.min(m.cursor.col, this.cols - 1) };
    this.saved = m.saved; this._mainBuf = null;
    this.altScreen = false;
    if (restoreCursor) this._restoreCursor();
    if (this.onAltScreen) this.onAltScreen(false);
  }

  _sgr(params) {
    if (!params.length) params = [[0]];
    for (let i = 0; i < params.length; i++) {
      const sub = params[i]; const n = sub[0] || 0;
      switch (n) {
        case 0: this.pen = this._defaultPen(); break;
        case 1: this.pen.bold = true; break;
        case 2: this.pen.dim = true; break;
        case 3: this.pen.italic = true; break;
        case 4: this.pen.underline = !(sub.length > 1 && sub[1] === 0); break;  // 4:0 = underline off; 4 / 4:1..5 = on
        case 7: this.pen.inverse = true; break;
        case 8: this.pen.hidden = true; break;
        case 9: this.pen.strike = true; break;
        case 22: this.pen.bold = false; this.pen.dim = false; break;
        case 23: this.pen.italic = false; break;
        case 24: this.pen.underline = false; break;
        case 27: this.pen.inverse = false; break;
        case 28: this.pen.hidden = false; break;
        case 29: this.pen.strike = false; break;
        case 38: { const r = this._extColor(sub, params, i); this.pen.fg = r.color; i = r.i; break; }
        case 39: this.pen.fg = DEFAULT_FG; break;
        case 48: { const r = this._extColor(sub, params, i); this.pen.bg = r.color; i = r.i; break; }
        case 49: this.pen.bg = DEFAULT_BG; break;
        default:
          if (n >= 30 && n <= 37) this.pen.fg = idx(n - 30);
          else if (n >= 40 && n <= 47) this.pen.bg = idx(n - 40);
          else if (n >= 90 && n <= 97) this.pen.fg = idx(n - 90 + 8);
          else if (n >= 100 && n <= 107) this.pen.bg = idx(n - 100 + 8);
          break;
      }
    }
  }
  // Handle 38/48 extended color, both subparam (38:2:r:g:b / 38:5:i) and legacy semicolon forms.
  _extColor(sub, params, i) {
    if (sub.length > 1) { // subparam form within one param
      if (sub[1] === 2) return { color: rgb(sub[sub.length - 3] || 0, sub[sub.length - 2] || 0, sub[sub.length - 1] || 0), i };
      if (sub[1] === 5) return { color: idx(sub[2] || 0), i };
      return { color: DEFAULT_FG, i };
    }
    // legacy: next params are the mode then components
    const mode = params[i + 1] && params[i + 1][0];
    if (mode === 2) return { color: rgb((params[i + 2] || [0])[0], (params[i + 3] || [0])[0], (params[i + 4] || [0])[0]), i: i + 4 };
    if (mode === 5) return { color: idx((params[i + 2] || [0])[0]), i: i + 2 };
    return { color: DEFAULT_FG, i };
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { Terminal, Cell, charWidth, DEFAULT_FG, DEFAULT_BG, idx, rgb };
if (typeof window !== 'undefined') { window.WarpTerminal = Terminal; window.warpCharWidth = charWidth; }
})();
