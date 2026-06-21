// warpui_core GPU renderer — layer 2: glyph atlas (variable-width packing).
//
// Rasterizes each unique glyph once into a packed texture. Glyphs are placed by horizontal
// advance, so a wide (CJK/emoji) glyph can occupy 2 cells' worth of width. Each glyph is cached
// and exposes a UV rect plus its width-in-cells. The atlas canvas uploads directly as a WebGL
// texture for the instanced text pass.
'use strict';

class GlyphAtlas {
  constructor(cellW, cellH, { font = 'Menlo, monospace', fontSize = null, cols = 32 } = {}) {
    this.cellW = cellW; this.cellH = cellH;
    this.family = font;
    this.fontSize = fontSize || Math.floor(cellH * 0.8);
    this.slots = new Map(); // "<b><i>|char" -> { x, y, w(px) }
    this.curX = 0; this.curY = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cols * cellW;
    this.canvas.height = cellH;
    this.ctx = this.canvas.getContext('2d');
    this._configureCtx();
  }
  _configureCtx() {
    this.ctx.textBaseline = 'middle';   // vertically center the glyph in its cell
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#ffffff';     // white glyphs; tinted by the cell fg in the shader
  }
  _fontFor(bold, italic) { return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${this.fontSize}px ${this.family}`; }
  _grow(neededHeight) {
    const prev = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = neededHeight;
    const ctx = c.getContext('2d');
    ctx.putImageData(prev, 0, 0);
    this.canvas = c; this.ctx = ctx; this._configureCtx();
  }

  // Returns { u0,v0,u1,v1, w }. Bold/italic produce distinct cached slots (styled font variants).
  getGlyph(char, cellsWide = 1, { bold = false, italic = false } = {}) {
    const key = `${bold ? 1 : 0}${italic ? 1 : 0}|${char}`;
    let slot = this.slots.get(key);
    if (!slot) {
      const w = cellsWide * this.cellW;
      if (this.curX + w > this.canvas.width) { this.curX = 0; this.curY += this.cellH; }
      if (this.curY + this.cellH > this.canvas.height) this._grow(this.curY + this.cellH);
      slot = { x: this.curX, y: this.curY, w };
      this.slots.set(key, slot);
      this.curX += w;
      this.ctx.clearRect(slot.x, slot.y, w, this.cellH);
      if (char !== ' ' && char !== '') { this.ctx.font = this._fontFor(bold, italic); this.ctx.fillText(char, slot.x + 0.5, slot.y + this.cellH / 2 + 1); }
    }
    return {
      u0: slot.x / this.canvas.width, v0: slot.y / this.canvas.height,
      u1: (slot.x + slot.w) / this.canvas.width, v1: (slot.y + this.cellH) / this.canvas.height,
      w: slot.w / this.cellW,
    };
  }

  // True if a rasterized glyph slot has any non-transparent pixels (for tests).
  slotHasInk(char, { bold = false, italic = false } = {}) {
    const slot = this.slots.get(`${bold ? 1 : 0}${italic ? 1 : 0}|${char}`);
    if (!slot) return false;
    const data = this.ctx.getImageData(slot.x, slot.y, slot.w, this.cellH).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GlyphAtlas };
if (typeof window !== 'undefined') window.GlyphAtlas = GlyphAtlas;
