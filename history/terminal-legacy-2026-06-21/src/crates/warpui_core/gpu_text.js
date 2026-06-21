// warpui_core GPU renderer — layer 3: instanced textured glyph quads (the foreground text pass).
//
// Consumes the layer-2 GlyphAtlas (uploaded as a WebGL texture) and draws one textured quad per
// non-blank cell in a single instanced draw call. Each instance carries its (col,row), the glyph's
// atlas UV rect, and the cell's foreground RGB; the fragment shader samples the glyph's coverage
// alpha and tints it by the fg color, alpha-blended over whatever the background pass drew. This is
// how a GPU terminal paints text: thousands of glyphs per frame, one draw call, no per-glyph state.
'use strict';

const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;     // unit quad corner [0..1]
layout(location=1) in vec2 a_cell;    // (col, row)
layout(location=2) in vec4 a_uv;      // (u0, v0, u1, v1)
layout(location=3) in vec3 a_fg;      // foreground RGB
uniform vec2 u_cellSize;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec3 v_fg;
void main() {
  vec2 pixel = (a_cell + a_pos) * u_cellSize;
  vec2 clip = pixel / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = mix(a_uv.xy, a_uv.zw, a_pos);
  v_fg = a_fg;
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_atlas;
in vec2 v_uv;
in vec3 v_fg;
out vec4 outColor;
void main() {
  float coverage = texture(u_atlas, v_uv).a;   // glyph coverage from the rasterized atlas
  outColor = vec4(v_fg, coverage);             // fg-tinted glyph, coverage as alpha
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}

class GpuText {
  constructor(canvas, atlas, cols, rows, cellW, cellH) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl; this.canvas = canvas; this.atlas = atlas;
    this.cols = cols; this.rows = rows; this.cellW = cellW; this.cellH = cellH;
    canvas.width = cols * cellW; canvas.height = rows * cellH;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.uCellSize = gl.getUniformLocation(prog, 'u_cellSize');
    this.uResolution = gl.getUniformLocation(prog, 'u_resolution');
    this.uAtlas = gl.getUniformLocation(prog, 'u_atlas');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Interleaved instance buffer: cell(2) uv(4) fg(3) = 9 floats.
    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    const STRIDE = 9 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 2 * 4); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE, 6 * 4); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);

    this.tex = gl.createTexture();
    this.cells = new Map(); // cellIndex -> { col, row, u0,v0,u1,v1, fg:[r,g,b] }
  }

  // Place a glyph at (row,col). Blank chars clear the cell.
  setCell(row, col, char, fg) {
    const key = row * this.cols + col;
    if (char === ' ' || char === '' || char == null) { this.cells.delete(key); return; }
    const g = this.atlas.getGlyph(char);
    this.cells.set(key, { col, row, u0: g.u0, v0: g.v0, u1: g.u1, v1: g.v1, fg });
  }
  setRow(row, text, fg) { for (let c = 0; c < text.length && c < this.cols; c++) this.setCell(row, c, text[c], fg); }
  clear() { this.cells.clear(); }

  uploadAtlas() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw(clearRgb) {
    const gl = this.gl;
    // Rebuild instance data from active glyph cells (atlas UVs may shift as it grows).
    const data = new Float32Array(this.cells.size * 9);
    let i = 0;
    for (const g of this.cells.values()) {
      data[i++] = g.col; data[i++] = g.row;
      data[i++] = g.u0; data[i++] = g.v0; data[i++] = g.u1; data[i++] = g.v1;
      data[i++] = g.fg[0]; data[i++] = g.fg[1]; data[i++] = g.fg[2];
    }
    this.uploadAtlas();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (clearRgb) { gl.clearColor(clearRgb[0], clearRgb[1], clearRgb[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.uAtlas, 0);
    gl.uniform2f(this.uCellSize, this.cellW, this.cellH);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.cells.size); // all glyphs, one draw call
    gl.bindVertexArray(null);
  }

  // Max luminance over a cell's pixels (for tests). WebGL origin is bottom-left.
  cellMaxLuma(row, col) {
    const gl = this.gl;
    const w = this.cellW, h = this.cellH;
    const x = col * w, y = this.canvas.height - (row + 1) * h;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let max = 0;
    for (let i = 0; i < px.length; i += 4) { const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; if (l > max) max = l; }
    return max;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GpuText, VERT, FRAG };
if (typeof window !== 'undefined') window.GpuText = GpuText;
