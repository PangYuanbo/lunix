// warpui_core — from-scratch GPU terminal renderer (WebGL2), rebuilt bottom-up.
// Layers: gpu_grid (instanced cell backgrounds) -> glyph_atlas -> gpu_text (instanced glyphs) ->
// gpu_terminal (composed bg/selection/block-decorations/text/cursor, wide-char + text attributes).
// gpu_terminal/gpu_text touch `document`/WebGL and load in the renderer; the Node-side exports below
// are what tests/tooling can require directly. (The actual product terminal is the DOM block_view;
// this WebGL stack is retained for the rendering tests.)
'use strict';
module.exports = {
  __crate: 'warpui_core', __status: 'gpu-renderer',
  GlyphAtlas: require('./glyph_atlas').GlyphAtlas,
  GpuGrid: require('./gpu_grid').GpuGrid,
};
