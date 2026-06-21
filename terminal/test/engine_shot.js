// Capture an honest screenshot of Warp's OWN engine rendering in the app DOM:
//   raw ANSI -> vte.js Parser -> term.js Grid<Cell> -> warpui_core GpuTerminal (WebGL2).
// No xterm.js. App must run with --remote-debugging-port=9222. Writes /tmp/warp-engine.png.
const fs = require('fs');
const path = require('path');
const read = (f, dir) => fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8');

(async () => {
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  if (!page) throw new Error('app not running on 9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = (x) => send('Runtime.evaluate', { expression: x, returnByValue: true })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result && r.result.result && r.result.result.value; });

  const inject = (src) => `(function(){const module={exports:{}};const window=globalThis;${src}\n;return module.exports;})()`;
  await ev(`window.__vte = ${inject(read('vte.js', 'src/crates/warp_terminal'))};`);
  await ev(`window.__term = (function(){const module={exports:{}};const require=(p)=>window.__vte;const window=globalThis;${read('term.js', 'src/crates/warp_terminal')}\n;return module.exports;})();`);
  await ev('(function(){' + read('glyph_atlas.js', 'src/crates/warpui_core') + '})()');
  await ev('(function(){' + read('gpu_terminal.js', 'src/crates/warpui_core') + '})()');

  const lines = [
    '\\x1b[1;32maaronpang@Mac\\x1b[0m \\x1b[34m~/Desktop/warp\\x1b[0m',
    '\\x1b[1;31m$\\x1b[0m git status',
    'On branch \\x1b[33mmain\\x1b[0m',
    '\\x1b[32m  modified:   src/crates/warp_terminal/vte.js\\x1b[0m',
    '\\x1b[31m  deleted:    49 scaffold modules\\x1b[0m',
    '',
    '\\x1b[38;2;90;200;250m// Warp own engine: bytes -> vte -> Grid<Cell> -> GPU\\x1b[0m',
    '\\x1b[4mxterm.js is gone\\x1b[0m  \\x1b[7m INVERSE \\x1b[0m  CJK and emoji ok',
    '\\x1b[1;32m>\\x1b[0m echo \\x1b[33m"hello warp"\\x1b[0m',
  ].join('\\r\\n');

  await ev(`(function(){
    const { Terminal } = window.__term;
    const cols = 64, rows = 16, cw = 9, ch = 19;
    const term = new Terminal(cols, rows);
    const enc = (s) => { const b = []; for (const c of unescape(encodeURIComponent(s))) b.push(c.charCodeAt(0)); return b; };
    term.write(new Uint8Array(enc('${lines}')));
    const PAL = [[40,42,54],[255,85,85],[80,250,123],[241,250,140],[98,140,220],[255,121,198],[139,233,253],[200,205,214],
                 [98,114,164],[255,110,110],[120,255,160],[255,255,150],[130,170,240],[255,150,220],[170,250,255],[255,255,255]];
    const fgDef = [200,205,214];
    const resolve = (d, def) => d.t === 'rgb' ? [d.r,d.g,d.b] : d.t === 'idx' ? (PAL[d.i] || def) : def;
    document.querySelectorAll('canvas.__engine_shot').forEach((n) => n.remove()); // clear stale runs
    const cv = document.createElement('canvas');
    cv.className = '__engine_shot';
    cv.style.cssText = 'position:fixed;left:40px;top:90px;z-index:99999;border:1px solid #2d323d;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    document.body.appendChild(cv);
    const atlas = new window.GlyphAtlas(cw, ch, { cols: 16 });
    const gpu = new window.GpuTerminal(cv, atlas, cols, rows, cw, ch);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cell = term.cell(r, c); if (!cell || cell.spacer || cell.c === ' ') continue;
      let fg = resolve(cell.fg, fgDef), bg = cell.bg.t === 'bg' ? null : resolve(cell.bg, [30,33,39]);
      if (cell.inverse) { const t = fg; fg = bg || [30,33,39]; bg = t || fgDef; }
      gpu.setCell(r, c, cell.c[0], [fg[0]/255,fg[1]/255,fg[2]/255], bg ? [bg[0]/255,bg[1]/255,bg[2]/255] : null, cell.width,
        { bold: cell.bold, italic: cell.italic, underline: cell.underline, strike: cell.strike, dim: cell.dim });
    }
    gpu.draw([0.118,0.129,0.153]);
    window.__engineCanvas = cv;
    return cv.toDataURL('image/png');
  })()`);

  const dataUrl = await ev('window.__engineCanvas ? window.__engineCanvas.toDataURL("image/png") : ""');
  if (!dataUrl || !dataUrl.startsWith('data:image/png')) throw new Error('no canvas dataURL: ' + String(dataUrl).slice(0, 80));
  fs.writeFileSync('/tmp/warp-engine.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.error('saved /tmp/warp-engine.png', fs.statSync('/tmp/warp-engine.png').size, 'bytes');
  ws.close(); process.exit(0);
})().catch((e) => { console.error('SHOT FAIL:', e.message); process.exit(1); });
