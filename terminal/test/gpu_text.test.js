// GPU layer-3 test for warpui_core/gpu_text: instanced textured glyph rendering. Injects the atlas
// + text renderer into the live window over CDP, draws real glyphs on a dark background, and reads
// back per-cell luminance to confirm glyph cells are lit and blank cells stay dark.
// App must run with --remote-debugging-port=9222.
const fs = require('fs');
const assert = require('assert');
const path = require('path');

(async () => {
  const atlasSrc = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/glyph_atlas.js'), 'utf8');
  const textSrc = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/gpu_text.js'), 'utf8');
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; });

  await ev("(function(){"+atlasSrc+"})()"); await ev("(function(){"+textSrc+"})()");
  const res = await ev(`(function(){
    const cv = document.createElement('canvas');
    const atlas = new window.GlyphAtlas(16, 28, { cols: 16 });
    const t = new window.GpuText(cv, atlas, 10, 2, 16, 28);
    t.setRow(0, 'HELLO', [0.35, 0.97, 0.56]); // green text in row 0, cols 0..4
    // row 1, cols 0..4 intentionally left blank
    t.draw([0.05, 0.05, 0.06]);
    return {
      litH: t.cellMaxLuma(0, 0),  // 'H'
      litE: t.cellMaxLuma(0, 1),  // 'E'
      blank: t.cellMaxLuma(1, 0), // empty cell
      farBlank: t.cellMaxLuma(0, 8),
    };
  })()`);

  assert.ok(res.litH > 60, `glyph cell 'H' should be lit, luma=${res.litH}`);
  assert.ok(res.litE > 60, `glyph cell 'E' should be lit, luma=${res.litE}`);
  assert.ok(res.blank < 25, `empty cell should be dark, luma=${res.blank}`);
  assert.ok(res.farBlank < 25, `unwritten cell should be dark, luma=${res.farBlank}`);

  console.log(`GPU TEXT PASS: instanced glyphs rendered (H=${res.litH|0} E=${res.litE|0} lit, blank=${res.blank|0} dark)`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU TEXT FAIL:', e.message); process.exit(1); });
