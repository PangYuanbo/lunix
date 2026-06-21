// GPU block-decorations test: Warp's signature per-block top divider + left accent bar, painted
// by the GPU. Injects atlas + terminal, sets a block spanning rows 1..3, draws, and reads pixels
// to confirm the divider sits at the block's top row and the accent bar runs down its left edge.
// App: --remote-debugging-port=9222.
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
    const t = new window.GpuTerminal(cv, atlas, 8, 5, 16, 28);
    t.setBlocks([{ startRow: 1, endRow: 3, accent: [0.35, 0.97, 0.56], border: [0.5, 0.5, 0.5] }]);
    t.draw([0.04, 0.04, 0.05]);
    const gl = t.gl, W = t.canvas.width;
    // top divider: a thin lit strip across the top of row 1
    function topStrip(row){ const y = Math.floor(t.canvas.height - (row*t.cellH) - 2); const px=new Uint8Array(W*2*4); gl.readPixels(0,y,W,2,gl.RGBA,gl.UNSIGNED_BYTE,px); let lit=0; for(let i=0;i<px.length;i+=4){ if(0.299*px[i]+0.587*px[i+1]+0.114*px[i+2] > 90) lit++; } return lit; }
    // left accent: read the leftmost column pixels of a middle block row
    function leftPixel(row){ const x=1, y=Math.floor(t.canvas.height-(row+0.5)*t.cellH); const px=new Uint8Array(4); gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return [...px]; }
    return {
      dividerLit: topStrip(1),        // many lit pixels along row-1 top
      noDividerRow0: topStrip(0),     // row 0 (before block) -> no divider
      accentRow2: leftPixel(2),       // left edge of a block row -> green accent
      accentBeforeRow0: leftPixel(0), // left edge before block -> dark
    };
  })()`);

  assert.ok(res.dividerLit > 40, `block top divider should span the width, lit=${res.dividerLit}`);
  assert.ok(res.noDividerRow0 < 10, `row before the block should have no divider, lit=${res.noDividerRow0}`);
  assert.ok(res.accentRow2[1] > 120 && res.accentRow2[0] < 120, `left accent should be green, got ${res.accentRow2}`);
  assert.ok(res.accentBeforeRow0[1] < 60, `no accent before the block, got ${res.accentBeforeRow0}`);

  console.log(`GPU BLOCKS PASS: divider(row1=${res.dividerLit}, row0=${res.noDividerRow0}) accent(in=${res.accentRow2.slice(0,3)}, before=${res.accentBeforeRow0.slice(0,3)})`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU BLOCKS FAIL:', e.message); process.exit(1); });
