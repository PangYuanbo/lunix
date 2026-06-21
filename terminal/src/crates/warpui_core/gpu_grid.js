// warpui_core GPU renderer — layer 1: instanced cell-background grid (WebGL2).
//
// This is the bottom of a from-scratch rebuild of Warp's GPU terminal renderer. A terminal is a
// grid of cells; the hot path is filling thousands of cells with background colors every frame.
// We draw the whole grid in a single instanced draw call: one unit quad, one instance per cell,
// per-instance (col,row) + RGB color. This is the same instancing strategy a wgpu renderer uses,
// expressed in WebGL2 so it runs in Electron (macOS) and iPadOS WKWebView.
'use strict';

const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;      // unit quad corner [0..1]
layout(location=1) in vec2 a_cell;     // per-instance (col, row)
layout(location=2) in vec3 a_color;    // per-instance background RGB (0..1)
uniform vec2 u_cellSize;               // cell size in pixels
uniform vec2 u_resolution;             // canvas size in pixels
out vec3 v_color;
void main() {
  vec2 pixel = (a_cell + a_pos) * u_cellSize;        // top-left origin, y-down
  vec2 clip = pixel / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);     // flip y to top-left origin
  v_color = a_color;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 outColor;
void main() { outColor = vec4(v_color, 1.0); }`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}

class GpuGrid {
  constructor(canvas, cols, rows, cellW, cellH) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl; this.canvas = canvas;
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

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    // Unit quad (two triangles) at location 0.
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Per-instance cell coords (location 1) and colors (location 2), built once, updated on demand.
    this.cellData = new Float32Array(cols * rows * 2);
    this.colorData = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c; this.cellData[i * 2] = c; this.cellData[i * 2 + 1] = r;
    }
    this.cellBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.cellData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1);

    this.colorBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.colorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  // Set a cell's background color (rgb each 0..1).
  setCellBg(row, col, rgb) {
    const i = (row * this.cols + col) * 3;
    this.colorData[i] = rgb[0]; this.colorData[i + 1] = rgb[1]; this.colorData[i + 2] = rgb[2];
  }
  fill(rgb) { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.setCellBg(r, c, rgb); }

  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colorData); // upload latest colors
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uCellSize, this.cellW, this.cellH);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.cols * this.rows); // one draw call for the whole grid
    gl.bindVertexArray(null);
  }

  // Read back a cell's center pixel as [r,g,b,a] bytes (for tests). WebGL origin is bottom-left.
  readCellPixel(row, col) {
    const gl = this.gl;
    const x = Math.floor((col + 0.5) * this.cellW);
    const y = Math.floor(this.canvas.height - (row + 0.5) * this.cellH);
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GpuGrid, VERT, FRAG };
if (typeof window !== 'undefined') window.GpuGrid = GpuGrid; // browser global for in-renderer use
