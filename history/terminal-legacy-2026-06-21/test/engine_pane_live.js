// LIVE end-to-end: mount the xterm-free WarpEnginePane on a REAL shell PTY inside the app, run
// actual commands, and screenshot the GPU-rendered output. Proves term.js + the engine fully
// replace xterm for an interactive pane. App must run with --remote-debugging-port=9222.
const fs = require('fs');
const path = require('path');
const readSrc = (f, dir) => fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8');

(async () => {
  const page = (await (await fetch('http://localhost:9222/json')).json()).find((t) => t.type === 'page' && t.title === 'Warp');
  if (!page) throw new Error('app not running on 9222');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); });
  const ev = (x) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true, awaitPromise: true } })); })
    .then((r) => { if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result && r.result.result && r.result.result.value; });

  // Load the engine modules as globals (no bundler). term.js/keys.js are CJS that also set window.*.
  await ev('(function(){const module={exports:{}};const window=globalThis;' + readSrc('vte.js', 'src/crates/warp_terminal') + '})()');
  await ev('(function(){const module={exports:{}};const require=()=>({Parser:window.VteParser});const window=globalThis;' + readSrc('term.js', 'src/crates/warp_terminal') + '})()');
  await ev('(function(){const module={exports:{}};const window=globalThis;' + readSrc('keys.js', 'src/crates/warp_terminal') + '})()');
  await ev('(function(){' + readSrc('glyph_atlas.js', 'src/crates/warpui_core') + '})()');
  await ev('(function(){' + readSrc('gpu_terminal.js', 'src/crates/warpui_core') + '})()');
  await ev('(function(){const module={exports:{}};const require=(p)=>p.endsWith("term")?{Terminal:window.WarpTerminal}:{encodeKey:window.warpEncodeKey,encodePaste:window.warpEncodePaste};const window=globalThis;' + readSrc('engine_pane.js', 'src/crates/warp_terminal') + '})()');

  // Mount the pane on a real PTY.
  const ready = await ev(`(function(){
    document.querySelectorAll('#__livepane').forEach(n=>n.remove());
    const host = document.createElement('div');
    host.id='__livepane';
    host.style.cssText='position:fixed;left:40px;top:80px;width:640px;height:418px;z-index:99999;background:#1e2127;border:1px solid #2d323d;border-radius:8px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    document.body.appendChild(host);
    const ptyId = 'engine-live-' + (window.__el = (window.__el||0)+1);
    window.__io = { bytes: 0, err: '' };
    const io = {
      spawn: (cols, rows) => window.warp.spawn(ptyId, cols, rows),
      write: (data) => window.warp.write(ptyId, data),
      resize: (cols, rows) => window.warp.resize(ptyId, cols, rows),
      onData: (cb) => window.warp.onData((m) => { if (m.id === ptyId) { window.__io.bytes += (m.data || '').length; try { cb(m.data); } catch (e) { window.__io.err = String(e); } } }),
    };
    window.__pane = new window.WarpEnginePane(host, io, { cellW: 9, cellH: 19 });
    window.__ptyId = ptyId;
    return { cols: window.__pane.term.cols, rows: window.__pane.term.rows };
  })()`);
  console.error('pane mounted on real PTY:', JSON.stringify(ready));

  const type = (s) => ev(`window.warp.write(window.__ptyId, ${JSON.stringify(s)})`);
  await new Promise((r) => setTimeout(r, 600));          // shell prompt
  await type('echo "engine pane: no xterm"\r');
  await new Promise((r) => setTimeout(r, 300));
  await type('ls --color=always -G 2>/dev/null || ls -G\r');
  await new Promise((r) => setTimeout(r, 400));
  await type('git --version; printf "\\033[1;32mGREEN\\033[0m \\033[33myellow\\033[0m \\033[4munder\\033[0m\\r\\n"\r');
  await new Promise((r) => setTimeout(r, 600));
  await ev('window.__pane.render()');

  console.error('io stats:', await ev('JSON.stringify(window.__io)'));
  const grid = await ev(`(function(){const t=window.__pane.term;const out=[];for(let r=0;r<t.rows;r++){out.push(t.grid[r].map(c=>c.spacer?'':c.c).join('').replace(/\\s+$/,''));}return out.filter(Boolean).slice(-8);})()`);
  console.error('engine grid (last lines):'); grid.forEach((l) => console.error('  ' + l));

  const dataUrl = await ev('window.__pane.canvas.toDataURL("image/png")');
  if (!dataUrl || !dataUrl.startsWith('data:image/png')) throw new Error('no canvas');
  fs.writeFileSync('/tmp/warp-engine-live.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.error('saved /tmp/warp-engine-live.png', fs.statSync('/tmp/warp-engine-live.png').size, 'bytes');
  await ev('window.warp.kill(window.__ptyId)');
  ws.close(); process.exit(0);
})().catch((e) => { console.error('LIVE FAIL:', e.message); process.exit(1); });
