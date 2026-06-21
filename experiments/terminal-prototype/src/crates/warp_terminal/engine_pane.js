// WarpEnginePane — a fully xterm-free terminal pane. This is the integration that retires xterm.js:
//   PTY bytes -> term.js Terminal (vte parser + Grid<Cell>) -> warpui_core GpuTerminal (WebGL2).
// It owns the canvas, keyboard input (keys.js -> PTY), sizing, the ANSI palette, and the render loop.
//
// Browser module. Construct with a container element and an IO adapter:
//   io = { spawn(cols, rows), write(strOrBytes), resize(cols, rows), onData(cb) }
// (in the app these map to window.warp.spawn/write/resize and the PTY data event.)
'use strict';
(function (root) {
  const Term = (typeof require !== 'undefined') ? require('./term').Terminal : root.WarpTerminal;
  const enc = (typeof require !== 'undefined') ? require('./keys') : { encodeKey: root.warpEncodeKey, encodePaste: root.warpEncodePaste };

  // Standard xterm 256-color palette: 16 base + 6x6x6 cube + 24 grays.
  function buildPalette(base) {
    const p = base.slice();
    const lvl = [0, 95, 135, 175, 215, 255];
    for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) p.push([lvl[r], lvl[g], lvl[b]]);
    for (let i = 0; i < 24; i++) { const v = 8 + i * 10; p.push([v, v, v]); }
    return p;
  }
  // A Warp-ish base 16 (dark theme).
  // Exact Warp default-dark ANSI palette (app/src/themes/default_themes.rs DARK_MODE_NORMAL/BRIGHT_COLORS).
  const BASE16 = [
    [0x61, 0x61, 0x61], [0xFF, 0x82, 0x72], [0xB4, 0xFA, 0x72], [0xFE, 0xFD, 0xC2], [0xA5, 0xD5, 0xFE], [0xFF, 0x8F, 0xFD], [0xD0, 0xD1, 0xFE], [0xF1, 0xF1, 0xF1],
    [0x8E, 0x8E, 0x8E], [0xFF, 0xC4, 0xBD], [0xD6, 0xFC, 0xB9], [0xFE, 0xFD, 0xD5], [0xC1, 0xE3, 0xFE], [0xFF, 0xB1, 0xFE], [0xE5, 0xE6, 0xFE], [0xFE, 0xFF, 0xFF],
  ];

  class WarpEnginePane {
    constructor(container, io, opts = {}) {
      this.container = container; this.io = io;
      this.cellW = opts.cellW || 9; this.cellH = opts.cellH || 19;
      this.palette = buildPalette(opts.base16 || BASE16);
      this.fgDefault = opts.fg || [200, 205, 214];
      this.bgDefault = opts.bg || [30, 33, 39];
      this.bracketedPaste = false;
      this._needsRender = false;

      const { cols, rows } = this._measure();
      this.term = new Term(cols, rows, { onOsc: (num, args) => this._osc(num, args), onBell: () => {} });

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'warp-engine-canvas';
      this.canvas.style.cssText = 'display:block;width:100%;height:100%';
      container.appendChild(this.canvas);
      const Atlas = root.GlyphAtlas, Gpu = root.GpuTerminal;
      this.atlas = new Atlas(this.cellW, this.cellH, { cols: 16, font: opts.font || 'Menlo, monospace' });
      this.gpu = new Gpu(this.canvas, this.atlas, cols, rows, this.cellW, this.cellH);

      this.onOscHook = opts.onOsc || null;       // (num, args) -> void  (app uses this for OSC 133 blocks)
      this.onInput = opts.onInput || null;       // (keyStr) -> void  (autosuggest / input mirror)
      this.decorations = opts.decorations || null; // () -> [{startRow,endRow,accent,border}] block decos
      this._wireInput();
      this.io.onData((d) => { this.term.write(typeof d === 'string' ? this._utf8(d) : d); this.scheduleRender(); });
      this.io.spawn(cols, rows);
      this.render();
    }

    _utf8(s) { return (typeof Buffer !== 'undefined') ? Uint8Array.from(Buffer.from(s, 'utf8')) : new TextEncoder().encode(s); }
    _measure() {
      const w = this.container.clientWidth || 640, h = this.container.clientHeight || 380;
      return { cols: Math.max(2, Math.floor(w / this.cellW)), rows: Math.max(2, Math.floor(h / this.cellH)) };
    }

    _wireInput() {
      this.container.tabIndex = 0;
      this._keyHandler = (e) => {
        if (e.metaKey && (e.key === 'v' || e.key === 'c')) return; // let copy/paste through
        const bytes = enc.encodeKey(e);
        if (bytes) { e.preventDefault(); this.io.write(bytes); if (this.onInput) this.onInput(bytes); }
      };
      this._pasteHandler = (e) => {
        const text = (e.clipboardData || root.clipboardData).getData('text');
        if (text) { e.preventDefault(); this.io.write(enc.encodePaste(text, this.bracketedPaste)); }
      };
      this.container.addEventListener('keydown', this._keyHandler);
      this.container.addEventListener('paste', this._pasteHandler);
    }

    _osc(num, args) {
      if (num === '7' && args[0]) { const m = args[0].match(/file:\/\/[^/]*(\/.*)/); if (m) this.cwd = decodeURIComponent(m[1]); }
      if (this.onOscHook) this.onOscHook(num, args);
    }

    _resolve(d, def) { return d.t === 'rgb' ? [d.r, d.g, d.b] : d.t === 'idx' ? (this.palette[d.i] || def) : def; }

    scheduleRender() {
      if (this._needsRender) return;
      this._needsRender = true;
      (root.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { this._needsRender = false; this.render(); });
    }

    render() {
      const t = this.term, gpu = this.gpu;
      gpu.cells.clear();
      for (let r = 0; r < t.rows; r++) {
        for (let c = 0; c < t.cols; c++) {
          const cell = t.cell(r, c); if (!cell || cell.spacer) continue;
          if (cell.c === ' ' && cell.bg.t === 'bg' && !cell.underline && !cell.strike) continue;
          let fg = this._resolve(cell.fg, this.fgDefault);
          let bg = cell.bg.t === 'bg' ? null : this._resolve(cell.bg, this.bgDefault);
          if (cell.inverse) { const tmp = fg; fg = bg || this.bgDefault; bg = tmp || this.fgDefault; }
          if (cell.hidden) fg = bg || this.bgDefault;
          gpu.setCell(r, c, cell.c === ' ' ? ' ' : cell.c[0],
            [fg[0] / 255, fg[1] / 255, fg[2] / 255], bg ? [bg[0] / 255, bg[1] / 255, bg[2] / 255] : null, cell.width,
            { bold: cell.bold, italic: cell.italic, underline: cell.underline, strike: cell.strike, dim: cell.dim });
        }
      }
      if (t.cursorVisible) gpu.setCursor(t.cursor.row, t.cursor.col, 'block', [0.35, 0.97, 0.56]);
      else gpu.cursor = null;
      gpu.setBlocks(this.decorations ? this.decorations() : []);
      gpu.draw([this.bgDefault[0] / 255, this.bgDefault[1] / 255, this.bgDefault[2] / 255]);
    }

    // Feed raw PTY bytes (used by the app's global data fan-in).
    write(data) { this.term.write(typeof data === 'string' ? this._utf8(data) : data); this.scheduleRender(); }
    clear() { this.term.scrollback.length = 0; this.term._reset(); this.scheduleRender(); }
    // Absolute logical row of the cursor (scrollback history + viewport), for block markers.
    absCursorRow() { return this.term.scrollback.length + this.term.cursor.row; }

    fit() {
      const { cols, rows } = this._measure();
      if (cols === this.term.cols && rows === this.term.rows) return;
      this.term.resize(cols, rows);
      this.canvas.width = cols * this.cellW; this.canvas.height = rows * this.cellH;
      this.gpu.cols = cols; this.gpu.rows = rows;
      this.io.resize(cols, rows); this.render();
    }
    focus() { this.container.focus(); }
    dispose() { this.container.removeEventListener('keydown', this._keyHandler); this.container.removeEventListener('paste', this._pasteHandler); this.canvas.remove(); }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { WarpEnginePane, buildPalette, BASE16 };
  if (typeof window !== 'undefined') { window.WarpEnginePane = WarpEnginePane; window.warpBuildPalette = buildPalette; window.warpBASE16 = BASE16; }
})(typeof window !== 'undefined' ? window : globalThis);
