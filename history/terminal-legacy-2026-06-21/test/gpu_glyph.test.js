// GPU layer-2 test for warpui_core/glyph_atlas. Canvas-2D rasterization runs in the renderer,
// so this injects the atlas source into the live window over CDP, rasterizes glyphs, and reads
// the atlas back with getImageData to assert ink/blank/caching. App must run with --remote-debugging-port=9222.
const fs = require('fs');
const assert = require('assert');
const path = require('path');

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/crates/warpui_core/glyph_atlas.js'), 'utf8');
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; });

  await ev("(function(){"+src+"})()");
  const res = await ev(`(function(){
    const a = new window.GlyphAtlas(14, 26, { cols: 8 });
    const ga = a.getGlyph('A'); a.getGlyph(' ');
    const gA2 = a.getGlyph('A');           // cached -> identical UV rect
    const gB = a.getGlyph('B');            // distinct slot, advanced to the right
    const gWide = a.getGlyph('中', 2);     // wide glyph -> width 2 cells
    return {
      aHasInk: a.slotHasInk('A'),
      spaceHasInk: a.slotHasInk(' '),
      cached: ga.u0 === gA2.u0 && ga.u1 === gA2.u1 && ga.v0 === gA2.v0,
      aWidth: ga.w, wideWidth: gWide.w,
      bAfterA: gB.u0 > ga.u0,              // 'B' packed to the right of 'A'
      aUV: [ga.u0, ga.v0, ga.u1, ga.v1],
      atlasW: a.canvas.width, atlasH: a.canvas.height,
    };
  })()`);

  assert.ok(res.aHasInk, "'A' slot should contain rasterized ink");
  assert.ok(!res.spaceHasInk, "space slot should be blank");
  assert.ok(res.cached, "re-requesting 'A' should return the cached UV rect");
  assert.strictEqual(res.aWidth, 1, "'A' should be width 1 cell");
  assert.strictEqual(res.wideWidth, 2, "'中' should be width 2 cells");
  assert.ok(res.bAfterA, "'B' should be packed to the right of 'A'");
  assert.ok(res.aUV[2] > res.aUV[0] && res.aUV[3] > res.aUV[1], "'A' UV rect should be non-degenerate");

  console.log(`GPU GLYPH PASS: atlas ${res.atlasW}x${res.atlasH}, 'A' inked, space blank, caching + UVs ok`);
  ws.close(); process.exit(0);
})().catch((e) => { console.error('GPU GLYPH FAIL:', e.message); process.exit(1); });
