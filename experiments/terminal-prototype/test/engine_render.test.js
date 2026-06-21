// End-to-end engine render test: proves Warp's real method works without xterm.js.
//   raw ANSI bytes -> Parser (vte.js) -> Terminal Grid<Cell> (term.js) -> GpuTerminal (WebGL2).
// Injects all four modules into the running app, feeds a colored ANSI stream, renders the grid on
// the GPU, reads pixels back to confirm color/text landed, and captures a PNG.
// App must run with --remote-debugging-port=9222.
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const read = (f, dir) => fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8');

(async () => {
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = (x) => send('Runtime.evaluate', { expression: x, returnByValue: true })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result && r.result.result && r.result.result.value; });

  // vte.js and term.js are CommonJS; wrap to expose globals without a bundler.
  const inject = (src) => `(function(){const module={exports:{}};const window=globalThis;${src}\n;return module.exports;})()`;
  await ev(`window.__vte = ${inject(read('vte.js', 'src/crates/warp_terminal'))};`);
  await ev(`window.__term = (function(){const module={exports:{}};const require=(p)=>window.__vte;const window=globalThis;${read('term.js', 'src/crates/warp_terminal')}\n;return module.exports;})();`);
  await ev('(function(){' + read('glyph_atlas.js', 'src/crates/warpui_core') + '})()');
  await ev('(function(){' + read('gpu_terminal.js', 'src/crates/warpui_core') + '})()');

  const res = await ev(`(function(){
    const { Terminal } = window.__term;
    const cols = 40, rows = 12, cw = 16, ch = 28;
    const term = new Terminal(cols, rows);
    // A realistic colored stream: bold red, green, a CJK word, default text.
    const enc = (s) => { const b = []; for (const ch of unescape(encodeURIComponent(s))) b.push(ch.charCodeAt(0)); return b; };
    term.write(new Uint8Array(enc(
      '\\x1b[1;31mERROR\\x1b[0m default text\\r\\n' +
      '\\x1b[32m+ added line\\x1b[0m\\r\\n' +
      '\\x1b[38;2;90;200;250mtruecolor\\x1b[0m 中文 path/to/file\\r\\n' +
      '\\x1b[4munderlined\\x1b[0m \\x1b[7minverse\\x1b[0m'
    )));

    // Resolve color descriptors against a Warp-like palette.
    const PAL = [[40,42,54],[255,85,85],[80,250,123],[241,250,140],[98,114,164],[255,121,198],[139,233,253],[200,205,214],
                 [98,114,164],[255,110,110],[120,255,160],[255,255,150],[130,150,200],[255,150,220],[170,250,255],[255,255,255]];
    const fgDef = [200,205,214], bgDef = [30,33,39];
    const resolve = (d, def) => d.t === 'rgb' ? [d.r,d.g,d.b] : d.t === 'idx' ? (PAL[d.i] || def) : def;

    const cv = document.createElement('canvas');
    const atlas = new window.GlyphAtlas(cw, ch, { cols: 16 });
    const gpu = new window.GpuTerminal(cv, atlas, cols, rows, cw, ch);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cell = term.cell(r, c); if (!cell || cell.spacer) continue;
      const inv = cell.inverse;
      let fg = resolve(cell.fg, fgDef), bg = cell.bg.t === 'bg' ? null : resolve(cell.bg, bgDef);
      if (inv) { const t = fg; fg = bg || bgDef; bg = t || fgDef; }
      const f = [fg[0]/255, fg[1]/255, fg[2]/255];
      const b = bg ? [bg[0]/255, bg[1]/255, bg[2]/255] : null;
      gpu.setCell(r, c, cell.c === ' ' ? ' ' : cell.c[0], f, b, cell.width,
        { bold: cell.bold, italic: cell.italic, underline: cell.underline, strike: cell.strike, dim: cell.dim });
    }
    gpu.draw([bgDef[0]/255, bgDef[1]/255, bgDef[2]/255]);

    // Verify: 'E' of ERROR is red-ish; the green '+' row is green-ish.
    const errRed = gpu.cellMaxLuma ? null : null;
    function avg(r0,c0){ const gl=gpu.gl,x=Math.floor((c0+0.5)*cw),y=Math.floor(gpu.canvas.height-(r0+0.5)*ch); const px=new Uint8Array(4); gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return [...px]; }
    // sample multiple columns of row0 (ERROR) and row1 (+ added) to find lit glyph pixels
    function rowColor(r0){ const gl=gpu.gl,W=cv.width; const y0=Math.floor(gpu.canvas.height-(r0+1)*ch); const px=new Uint8Array(W*ch*4); gl.readPixels(0,y0,W,ch,gl.RGBA,gl.UNSIGNED_BYTE,px); let R=0,G=0,B=0,nLit=0; for(let i=0;i<px.length;i+=4){const l=0.299*px[i]+0.587*px[i+1]+0.114*px[i+2]; if(l>60){R+=px[i];G+=px[i+1];B+=px[i+2];nLit++;}} return nLit?[Math.round(R/nLit),Math.round(G/nLit),Math.round(B/nLit),nLit]:[0,0,0,0]; }
    return {
      gridLine0: term.grid[0].map(c=>c.spacer?'':c.c).join('').replace(/\\s+$/,''),
      errorRowColor: rowColor(0),
      addedRowColor: rowColor(1),
      cjkPresent: term.grid[2].some(c=>c.c==='中'),
      canvasSize: [cv.width, cv.height],
    };
  })()`);

  // ERROR row should be dominantly red; the "+ added" row dominantly green.
  ok(res.gridLine0.startsWith('ERROR'), 'grid line0 holds ERROR -> ' + res.gridLine0);
  ok(res.errorRowColor[3] > 20, 'ERROR row has lit glyph pixels');
  ok(res.errorRowColor[0] > res.errorRowColor[1] && res.errorRowColor[0] > res.errorRowColor[2], 'ERROR row reads red -> ' + res.errorRowColor);
  ok(res.addedRowColor[1] > res.addedRowColor[0], 'added row reads green -> ' + res.addedRowColor);
  ok(res.cjkPresent, 'CJK 中 present in grid row2');

  console.log(`ENGINE RENDER PASS: line0="${res.gridLine0}" error=${res.errorRowColor.slice(0,3)} added=${res.addedRowColor.slice(0,3)} cjk=${res.cjkPresent} canvas=${res.canvasSize}`);
  ws.close(); process.exit(0);

  function ok(c, m) { if (!c) { console.error('ENGINE RENDER FAIL:', m); ws.close(); process.exit(1); } }
})().catch((e) => { console.error('ENGINE RENDER FAIL:', e.message); process.exit(1); });
