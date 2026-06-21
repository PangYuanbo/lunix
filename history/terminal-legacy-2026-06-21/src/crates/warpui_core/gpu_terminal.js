// warpui_core GPU renderer — layer 4 + composition: a single GpuTerminal surface.
//
// Composes the whole terminal frame on one WebGL2 canvas in the correct order:
//   1. cell backgrounds   (opaque instanced solid quads)
//   2. selection highlight (translucent instanced quads over selected cells)
//   3. text                (instanced textured glyph quads, from the glyph atlas)
//   4. cursor              (a block or bar instanced quad)
// Two shader programs are shared: a "solid" rect program (bg/selection/cursor) and the textured
// glyph program (text). Each frame is a handful of instanced draw calls regardless of cell count —
// the same architecture as a native GPU terminal, runnable in Electron (macOS) and iPadOS WKWebView.
'use strict';

const SOLID_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_cell;
layout(location=2) in vec4 a_rect;   // offset.xy + size.zw, in cell units
layout(location=3) in vec4 a_color;  // rgba
uniform vec2 u_cellSize, u_resolution;
out vec4 v_color;
void main(){
  vec2 pixel = (a_cell + a_rect.xy + a_pos * a_rect.zw) * u_cellSize;
  vec2 clip = pixel / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_color;
}`;
const SOLID_FRAG = `#version 300 es
precision mediump float; in vec4 v_color; out vec4 o; void main(){ o = v_color; }`;

const TEXT_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_cell;
layout(location=2) in vec4 a_uv;
layout(location=3) in vec3 a_fg;
layout(location=4) in float a_w;   // glyph width in cells (1 or 2 for wide CJK/emoji)
uniform vec2 u_cellSize, u_resolution;
out vec2 v_uv; out vec3 v_fg;
void main(){
  vec2 pixel = (a_cell + vec2(a_pos.x * a_w, a_pos.y)) * u_cellSize; // span a_w cells horizontally
  vec2 clip = pixel / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = mix(a_uv.xy, a_uv.zw, a_pos); v_fg = a_fg;
}`;
const TEXT_FRAG = `#version 300 es
precision mediump float; uniform sampler2D u_atlas; in vec2 v_uv; in vec3 v_fg; out vec4 o;
void main(){ o = vec4(v_fg, texture(u_atlas, v_uv).a); }`;

function sh(gl, t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
function prog(gl, v, f) { const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }

class GpuTerminal {
  constructor(canvas, atlas, cols, rows, cellW, cellH) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl; this.canvas = canvas; this.atlas = atlas;
    this.cols = cols; this.rows = rows; this.cellW = cellW; this.cellH = cellH;
    canvas.width = cols * cellW; canvas.height = rows * cellH;

    this.solid = prog(gl, SOLID_VERT, SOLID_FRAG);
    this.text = prog(gl, TEXT_VERT, TEXT_FRAG);
    this.tex = gl.createTexture();

    // Shared unit quad.
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    this.solidBuf = gl.createBuffer();
    this.textBuf = gl.createBuffer();

    this.cells = new Map();     // key -> { char, fg, bg }
    this.cursor = null;         // { row, col, style, color }
    this.selection = [];        // [{ row, startCol, endCol }]
    this.blocks = [];           // [{ startRow, endRow, accent:[r,g,b], border:[r,g,b] }]
  }
  // Warp-style block decorations: top divider + left accent bar per command block.
  setBlocks(blocks) { this.blocks = blocks || []; }

  setCell(row, col, char, fg, bg, width = 1, attrs = null) { this.cells.set(row * this.cols + col, { char, fg, bg, width, attrs }); }
  setRow(row, text, fg, bg) { for (let c = 0; c < text.length && c < this.cols; c++) this.setCell(row, c, text[c], fg, bg); }
  setCursor(row, col, style = 'block', color = [0.35, 0.97, 0.56]) { this.cursor = { row, col, style, color }; }
  setSelection(ranges) { this.selection = ranges || []; }
  clear() { this.cells.clear(); this.cursor = null; this.selection = []; }

  _drawSolid(rects) { // rects: [{col,row,ox,oy,w,h,r,g,b,a}] -> instance buffer: cell(2) rect(4) color(4)
    const gl = this.gl;
    const buf = new Float32Array(rects.length * 10);
    rects.forEach((q, i) => { const o = i * 10; buf[o] = q.col; buf[o + 1] = q.row; buf[o + 2] = q.ox; buf[o + 3] = q.oy; buf[o + 4] = q.w; buf[o + 5] = q.h; buf[o + 6] = q.r; buf[o + 7] = q.g; buf[o + 8] = q.b; buf[o + 9] = q.a; });
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuf); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
    const ST = 10 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, ST, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, ST, 2 * 4); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, ST, 6 * 4); gl.vertexAttribDivisor(3, 1);
    gl.useProgram(this.solid);
    gl.uniform2f(gl.getUniformLocation(this.solid, 'u_cellSize'), this.cellW, this.cellH);
    gl.uniform2f(gl.getUniformLocation(this.solid, 'u_resolution'), this.canvas.width, this.canvas.height);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, rects.length);
    gl.bindVertexArray(null);
  }

  _drawText(glyphs) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buf = new Float32Array(glyphs.length * 10);
    glyphs.forEach((g, i) => { const o = i * 10; buf[o] = g.col; buf[o + 1] = g.row; buf[o + 2] = g.u0; buf[o + 3] = g.v0; buf[o + 4] = g.u1; buf[o + 5] = g.v1; buf[o + 6] = g.fg[0]; buf[o + 7] = g.fg[1]; buf[o + 8] = g.fg[2]; buf[o + 9] = g.w || 1; });
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuf); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
    const ST = 10 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, ST, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, ST, 2 * 4); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, ST, 6 * 4); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, ST, 9 * 4); gl.vertexAttribDivisor(4, 1);
    gl.useProgram(this.text);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(gl.getUniformLocation(this.text, 'u_atlas'), 0);
    gl.uniform2f(gl.getUniformLocation(this.text, 'u_cellSize'), this.cellW, this.cellH);
    gl.uniform2f(gl.getUniformLocation(this.text, 'u_resolution'), this.canvas.width, this.canvas.height);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, glyphs.length);
    gl.bindVertexArray(null);
  }

  draw(defaultBg = [0.118, 0.129, 0.153]) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(defaultBg[0], defaultBg[1], defaultBg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 1. cell backgrounds (only cells with an explicit bg; wide cells span their width)
    const bgRects = [];
    for (const [key, cell] of this.cells) if (cell.bg) bgRects.push({ col: key % this.cols, row: Math.floor(key / this.cols), ox: 0, oy: 0, w: cell.width || 1, h: 1, r: cell.bg[0], g: cell.bg[1], b: cell.bg[2], a: 1 });
    if (bgRects.length) this._drawSolid(bgRects);

    // 2. selection highlight
    const selRects = [];
    for (const s of this.selection) for (let c = s.startCol; c <= s.endCol; c++) selRects.push({ col: c, row: s.row, ox: 0, oy: 0, w: 1, h: 1, r: 0.34, g: 0.78, b: 1.0, a: 0.35 });
    if (selRects.length) this._drawSolid(selRects);

    // 2.5 block decorations: top divider line + left accent bar per command block.
    const blockRects = [];
    for (const blk of this.blocks) {
      const accent = blk.accent || [0.35, 0.97, 0.56], border = blk.border || [0.18, 0.20, 0.24];
      const h = (blk.endRow - blk.startRow + 1);
      const accentW = 3 / this.cellW; // ~3px accent bar regardless of cell size (matches Warp)
      blockRects.push({ col: 0, row: blk.startRow, ox: 0, oy: 0, w: this.cols, h: 0.05, r: border[0], g: border[1], b: border[2], a: 0.9 }); // top divider
      blockRects.push({ col: 0, row: blk.startRow, ox: 0, oy: 0, w: accentW, h, r: accent[0], g: accent[1], b: accent[2], a: 0.95 });       // left accent bar
    }
    if (blockRects.length) this._drawSolid(blockRects);

    // 3. text
    // Pre-pass: allocate every glyph first so the atlas reaches its FINAL size before we read any
    // UVs. getGlyph normalizes against the current atlas dimensions, so if a later glyph grows the
    // atlas canvas, UVs read earlier would be stale (garbled top rows). Allocating up front fixes it.
    for (const [, cell] of this.cells) {
      if (cell.char && cell.char !== ' ') { const a = cell.attrs; this.atlas.getGlyph(cell.char, cell.width || 1, { bold: !!(a && a.bold), italic: !!(a && a.italic) }); }
    }
    const glyphs = [];
    const decoRects = []; // underline / strikethrough
    for (const [key, cell] of this.cells) {
      const a = cell.attrs;
      const col = key % this.cols, row = Math.floor(key / this.cols);
      let fg = cell.fg || [0.78, 0.80, 0.83];
      if (a && a.dim) fg = [fg[0] * 0.66, fg[1] * 0.66, fg[2] * 0.66];  // DIM_FACTOR (terminal/color.rs)
      if (cell.char && cell.char !== ' ') {
        const g = this.atlas.getGlyph(cell.char, cell.width || 1, { bold: !!(a && a.bold), italic: !!(a && a.italic) });
        glyphs.push({ col, row, u0: g.u0, v0: g.v0, u1: g.u1, v1: g.v1, fg, w: g.w });
      }
      if (a && a.underline) decoRects.push({ col, row, ox: 0, oy: 0.88, w: cell.width || 1, h: 0.07, r: fg[0], g: fg[1], b: fg[2], a: 1 });
      if (a && a.strike) decoRects.push({ col, row, ox: 0, oy: 0.46, w: cell.width || 1, h: 0.07, r: fg[0], g: fg[1], b: fg[2], a: 1 });
    }
    if (glyphs.length) this._drawText(glyphs);
    if (decoRects.length) this._drawSolid(decoRects);

    // 4. cursor (block = full cell at 0.45 alpha; bar = 0.15 wide)
    if (this.cursor) {
      const isBar = this.cursor.style === 'bar';
      this._drawSolid([{ col: this.cursor.col, row: this.cursor.row, ox: 0, oy: 0, w: isBar ? 0.15 : 1, h: 1, r: this.cursor.color[0], g: this.cursor.color[1], b: this.cursor.color[2], a: isBar ? 1 : 0.45 }]);
    }
  }

  // Center pixel of a cell as [r,g,b,a] (test helper). WebGL origin bottom-left.
  cellCenter(row, col) {
    const gl = this.gl;
    const x = Math.floor((col + 0.5) * this.cellW);
    const y = Math.floor(this.canvas.height - (row + 0.5) * this.cellH);
    const px = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px;
  }
  cellMaxLuma(row, col) {
    const gl = this.gl; const w = this.cellW, h = this.cellH;
    const x = col * w, y = this.canvas.height - (row + 1) * h;
    const px = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let m = 0; for (let i = 0; i < px.length; i += 4) { const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; if (l > m) m = l; } return m;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GpuTerminal };
if (typeof window !== 'undefined') window.GpuTerminal = GpuTerminal;
