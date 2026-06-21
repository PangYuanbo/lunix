// GPU layer-4 + composition test for warpui_core/gpu_terminal. Injects atlas + terminal into the
// live window over CDP, draws a frame with backgrounds, selection, text, and a cursor, then reads
// back pixels to confirm each pass landed in the right cells. App: --remote-debugging-port=9222.
const fs = require('fs');
const assert = require('assert');
const path = require('path');

(async () => {
  const atlasSrc = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/glyph_atlas.js'), 'utf8');
  const termSrc = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/gpu_terminal.js'), 'utf8');
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; });

  await ev("(function(){"+atlasSrc+"})()"); await ev("(function(){"+termSrc+"})()");
  const res = await ev(`(function(){
    const cv = document.createElement('canvas');
    const atlas = new window.GlyphAtlas(16, 28, { cols: 16 });
    const t = new window.GpuTerminal(cv, atlas, 12, 3, 16, 28);
    t.setRow(0, 'HELLO', [0.35,0.97,0.56]);              // green text row 0
    t.setCell(1, 0, ' ', null, [0.85,0.20,0.30]);         // a red background cell (1,0)
    t.setSelection([{ row: 0, startCol: 0, endCol: 1 }]); // select cols 0..1 in row 0
    t.setCursor(2, 3, 'block');                            // cursor block at (2,3)
    t.draw([0.05,0.05,0.06]);
    return {
      textLit: t.cellMaxLuma(0, 0),       // 'H' under selection -> still lit
      redBg: [...t.cellCenter(1, 0)],     // explicit red background cell
      cursor: [...t.cellCenter(2, 3)],    // cursor block (accent over dark bg)
      empty: [...t.cellCenter(2, 8)],     // untouched -> default dark bg
    };
  })()`);

  assert.ok(res.textLit > 60, `text under selection should stay lit, luma=${res.textLit}`);
  assert.ok(res.redBg[0] > 150 && res.redBg[2] < 120, `cell(1,0) should be red bg, got ${res.redBg}`);
  assert.ok(res.cursor[1] > 90 && res.cursor[0] < 120, `cursor block should show green accent, got ${res.cursor}`);
  assert.ok(res.empty[0] < 30 && res.empty[1] < 30, `empty cell should be default dark bg, got ${res.empty}`);

  console.log(`GPU TERMINAL PASS: bg+selection+text+cursor composed (text=${res.textLit|0}, redBg=${res.redBg.slice(0,3)}, cursor=${res.cursor.slice(0,3)})`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU TERMINAL FAIL:', e.message); process.exit(1); });
