// GPU renderer test for warpui_core/gpu_grid (layer 1: instanced cell-background grid).
// WebGL2 only runs in the Electron renderer, so this injects the renderer source into the live
// window over CDP, draws a known checkerboard, and reads pixels back to assert the GPU output.
// Run the app first:  electron . --remote-debugging-port=9222
const fs = require('fs');
const assert = require('assert');
const path = require('path');

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/gpu_grid.js'), 'utf8');
  const targets = await (await fetch('http://localhost:9222/json')).json();
  const page = targets.find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; });

  await ev("(function(){"+src+"})()"); // inject the GPU renderer (exposes window.GpuGrid)
  const res = await ev(`(function(){
    const cv = document.createElement('canvas');
    const g = new window.GpuGrid(cv, 4, 4, 32, 32);
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) g.setCellBg(r,c, ((r+c)%2===0)?[1,0,0]:[0,1,0]);
    g.draw();
    return { c00:[...g.readCellPixel(0,0)], c01:[...g.readCellPixel(0,1)], c11:[...g.readCellPixel(1,1)] };
  })()`);

  // Red cells where (r+c) even, green where odd — read straight off the GPU framebuffer.
  assert.ok(res.c00[0] > 200 && res.c00[1] < 50, `cell(0,0) should be red, got ${res.c00}`);
  assert.ok(res.c01[1] > 200 && res.c01[0] < 50, `cell(0,1) should be green, got ${res.c01}`);
  assert.ok(res.c11[0] > 200 && res.c11[1] < 50, `cell(1,1) should be red, got ${res.c11}`);

  console.log('GPU PASS: instanced cell grid renders + pixel readback matches (red/green checkerboard)');
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU FAIL:', e.message); process.exit(1); });
