// GPU wide-char test: a wide (CJK) glyph occupies 2 cells, a narrow one occupies 1. Injects the
// atlas + terminal, renders a CJK glyph at width 2 and an ASCII glyph at width 1, and reads back
// the framebuffer to confirm the wide glyph paints across both of its cells while the cell beyond
// the narrow glyph stays blank. App: --remote-debugging-port=9222.
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core', f), 'utf8');

(async () => {
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; });

  await ev('(function(){' + read('glyph_atlas.js') + '})()');
  await ev('(function(){' + read('gpu_terminal.js') + '})()');
  const res = await ev(`(function(){
    const cv = document.createElement('canvas');
    const atlas = new window.GlyphAtlas(16, 28, { cols: 16 });
    const t = new window.GpuTerminal(cv, atlas, 8, 2, 16, 28);
    t.setCell(0, 0, '中', [0.9,0.9,0.9], null, 2); // wide glyph spanning cols 0..1
    t.setCell(1, 0, 'A', [0.9,0.9,0.9], null, 1);   // narrow glyph in col 0 only
    t.draw([0.04,0.04,0.05]);
    const wideUV = atlas.getGlyph('中', 2).w, narrowUV = atlas.getGlyph('A', 1).w;
    return {
      wideUV, narrowUV,
      wideCell0: t.cellMaxLuma(0, 0),   // first half of 中 -> lit
      wideCell1: t.cellMaxLuma(0, 1),   // second half of 中 -> lit (spans 2 cells)
      narrowCell0: t.cellMaxLuma(1, 0), // 'A' -> lit
      narrowCell1: t.cellMaxLuma(1, 1), // cell after 'A' -> blank
    };
  })()`);

  assert.strictEqual(res.wideUV, 2, 'CJK glyph should report width 2 cells');
  assert.strictEqual(res.narrowUV, 1, 'ASCII glyph should report width 1 cell');
  assert.ok(res.wideCell0 > 50 && res.wideCell1 > 50, `wide glyph should paint both cells, got ${res.wideCell0}/${res.wideCell1}`);
  assert.ok(res.narrowCell0 > 50, `narrow glyph cell should be lit, got ${res.narrowCell0}`);
  assert.ok(res.narrowCell1 < 25, `cell after narrow glyph should be blank, got ${res.narrowCell1}`);

  console.log(`GPU WIDECHAR PASS: 中 spans 2 cells (${res.wideCell0|0}/${res.wideCell1|0} lit), A spans 1 (after=${res.narrowCell1|0} blank)`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU WIDECHAR FAIL:', e.message); process.exit(1); });
