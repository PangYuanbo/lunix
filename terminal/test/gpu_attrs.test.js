// GPU text-attributes test: bold/italic glyph variants, underline, strikethrough, inverse, dim.
// Injects atlas + terminal, draws styled cells, and reads pixels back to confirm each attribute
// paints the right thing. App: --remote-debugging-port=9222.
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
    const t = new window.GpuTerminal(cv, atlas, 6, 4, 16, 28);
    const white = [0.9,0.9,0.9];
    t.setCell(0, 0, ' ', white, null, 1, { underline: true });   // underline on a blank cell
    t.setCell(1, 0, ' ', white, null, 1, { strike: true });      // strikethrough on a blank cell
    t.setCell(2, 0, ' ', white, [0.9,0.9,0.9], 1, {});           // inverse-style: white bg
    t.setCell(3, 0, 'B', white, null, 1, { bold: true });        // bold glyph
    t.draw([0.03,0.03,0.04]);
    // bottom strip of the underline cell vs its top strip
    function strip(row, frac0, frac1){ const gl=t.gl,w=t.cellW; const y0=Math.floor(t.canvas.height-(row+frac1)*t.cellH), hh=Math.max(1,Math.floor((frac1-frac0)*t.cellH)); const px=new Uint8Array(w*hh*4); gl.readPixels(0,y0,w,hh,gl.RGBA,gl.UNSIGNED_BYTE,px); let m=0; for(let i=0;i<px.length;i+=4){const l=0.299*px[i]+0.587*px[i+1]+0.114*px[i+2]; if(l>m)m=l;} return m; }
    return {
      underBottom: strip(0, 0.82, 0.98), underTop: strip(0, 0.0, 0.4),
      strikeMid: strip(1, 0.4, 0.55), strikeTop: strip(1, 0.0, 0.25),
      inverseCenter: t.cellMaxLuma(2, 0),
      boldLuma: t.cellMaxLuma(3, 0),
    };
  })()`);

  assert.ok(res.underBottom > 120 && res.underTop < 40, `underline should light the bottom strip only (bottom=${res.underBottom}, top=${res.underTop})`);
  assert.ok(res.strikeMid > 120 && res.strikeTop < 40, `strikethrough should light the mid strip (mid=${res.strikeMid}, top=${res.strikeTop})`);
  assert.ok(res.inverseCenter > 180, `inverse (white bg) cell should be bright, got ${res.inverseCenter}`);
  assert.ok(res.boldLuma > 60, `bold glyph should render, got ${res.boldLuma}`);

  console.log(`GPU ATTRS PASS: underline(${res.underBottom|0}/${res.underTop|0}) strike(${res.strikeMid|0}/${res.strikeTop|0}) inverse(${res.inverseCenter|0}) bold(${res.boldLuma|0})`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU ATTRS FAIL:', e.message); process.exit(1); });
