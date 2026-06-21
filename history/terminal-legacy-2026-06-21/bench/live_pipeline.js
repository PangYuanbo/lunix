'use strict';

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = Number(process.env.CDP_PORT || 9333);
const rows = Number(process.env.ROWS || 4000);
const chunkRows = Number(process.env.CHUNK_ROWS || 400);
const pageRows = Number(process.env.PAGE_ROWS || 80);
const pageJumps = Number(process.env.PAGE_JUMPS || 1000);
const tmuxPageJumps = Number(process.env.TMUX_PAGE_JUMPS || 100);

function round(n) { return Math.round(n * 100) / 100; }
function nowMs() { return Number(process.hrtime.bigint()) / 1e6; }

async function pageWs() {
  const pages = await (await fetch(`http://localhost:${port}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && p.title === 'Warp');
  assert(page, `Warp page not found on CDP_PORT=${port}`);
  return page.webSocketDebuggerUrl;
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const waiters = new Map();
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method && waiters.has(m.method)) { waiters.get(m.method)(m); waiters.delete(m.method); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const waitFor = (method) => new Promise((r) => waiters.set(method, r));
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  return { send, evalJs, waitFor, errors };
}

async function benchElectron() {
  const ws = new WebSocket(await pageWs());
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const { send, evalJs, waitFor, errors } = cdp(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = waitFor('Page.loadEventFired');
  await send('Page.reload', { ignoreCache: true });
  await loaded;
  await send('HeapProfiler.collectGarbage');
  const result = await evalJs(`(async function(){
    const rows=${rows}, chunkRows=${chunkRows}, pageRows=${pageRows}, pageJumps=${pageJumps};
    const pane = window.__warp.activePane;
    if (!pane || !pane.view) throw new Error('active pane missing');
    const oldRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    try {
      const line = (i) => '\\x1b[3'+(i%7)+'mrow '+String(i).padStart(5,'0')+' abcdefghijklmnopqrstuvwxyz 0123456789 '+(i%97===0?'https://example.com/'+i+' ':'')+'\\x1b[0m\\r\\n'+(i%113===0?'\\r\\n':'');
      pane.view.clear();
      pane.view.write('\\x1b]133;A\\x07❯ bench-live\\r\\n\\x1b]133;C\\x07');
      await tick();
      const t0 = performance.now();
      let writeMs = 0;
      let flushMs = 0;
      for (let from = 0; from < rows; from += chunkRows) {
        let s = '';
        for (let i = from; i < Math.min(rows, from + chunkRows); i++) s += line(i);
        const writeStart = performance.now();
        pane.view.write(s);
        writeMs += performance.now() - writeStart;
        const flushStart = performance.now();
        await tick();
        flushMs += performance.now() - flushStart;
      }
      const activeRenderMs = performance.now() - t0;
      pane.view.write('\\x1b]133;D;0\\x07');
      await tick();
      const exportStart = performance.now();
      const snap = pane.view.exportSnapshot();
      for (const b of snap.blocks) b.pageRows = pageRows;
      const exportMs = performance.now() - exportStart;
      const clearStart = performance.now();
      pane.view.clear();
      const clearMs = performance.now() - clearStart;
      const loadStart = performance.now();
      pane.view.loadSnapshot(snap);
      const loadMs = performance.now() - loadStart;
      const pageStart = performance.now();
      const maxStart = Math.max(0, snap.blocks[0].outputHtmlRows.length - pageRows);
      for (let i = 0; i < pageJumps; i++) pane.view.renderSnapshotPage(0, (i * 997) % (maxStart + 1));
      const pageMs = performance.now() - pageStart;
      return {
        rows,
        rafMode: 'setTimeout(0)',
        logicalRows: snap.blocks[0].outputHtmlRows.length,
        chunkRows,
        activeRenderMs,
        writeMs,
        flushMs,
        activeRowsPerSecond: rows / (activeRenderMs / 1000),
        snapshotExportMs: exportMs,
        clearLiveDomMs: clearMs,
        snapshotLoadMs: loadMs,
        pageRows,
        pageJumps,
        pageRenderTotalMs: pageMs,
        pageRenderAvgMs: pageMs / pageJumps,
        renderedLastPage: pane.el.querySelector('.wblock-out').textContent.length > 0,
      };
    } finally {
      window.requestAnimationFrame = oldRaf;
    }
  })()`);
  assert.strictEqual(errors.length, 0, errors.join('\n'));
  ws.close();
  return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]));
}

function tmuxInstalled() {
  try { cp.execFileSync('tmux', ['-V'], { stdio: 'ignore' }); return true; } catch { return false; }
}

function benchTmux() {
  if (!tmuxInstalled()) return { skipped: 'tmux not installed' };
  const name = `warpbench-${Date.now()}`;
  const script = path.join(os.tmpdir(), `${name}.py`);
  const tmux = (args) => cp.execFileSync('tmux', ['-L', name, ...args]);
  fs.writeFileSync(script, `for i in range(${rows}):\n    print(f"row {i:05d} abcdefghijklmnopqrstuvwxyz 0123456789")\nprint("__DONE__")\n`);
  try {
    tmux(['start-server', ';', 'set-option', '-g', 'history-limit', String(rows + 2000), ';', 'new-session', '-d', '-s', name, '-x', '120', '-y', '40']);
    tmux(['send-keys', '-t', name, `python3 ${script}`, 'C-m']);
    const waitUntil = Date.now() + 15000;
    while (Date.now() < waitUntil) {
      const tail = tmux(['capture-pane', '-p', '-t', name, '-S', '-20']).toString();
      if (tail.includes('__DONE__')) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    const t0 = nowMs();
    const full = tmux(['capture-pane', '-p', '-t', name, '-S', String(-rows - 20)]).toString();
    const fullCaptureMs = nowMs() - t0;
    let bytes = 0;
    const p0 = nowMs();
    for (let i = 0; i < tmuxPageJumps; i++) {
      const fromBottom = -Math.min(rows, ((i * 997) % Math.max(1, rows - pageRows)) + pageRows);
      bytes += tmux(['capture-pane', '-p', '-t', name, '-S', String(fromBottom), '-E', String(fromBottom + pageRows - 1)]).length;
    }
    const pageMs = nowMs() - p0;
    return {
      rows,
      fullCaptureMs: round(fullCaptureMs),
      capturedBytes: Buffer.byteLength(full),
      pageRows,
      pageJumps: tmuxPageJumps,
      pageCaptureTotalMs: round(pageMs),
      pageCaptureAvgMs: round(pageMs / tmuxPageJumps),
      bytes,
    };
  } finally {
    try { tmux(['kill-server']); } catch {}
    try { fs.unlinkSync(script); } catch {}
  }
}

(async () => {
  const electron = await benchElectron();
  const tmux = benchTmux();
  console.log(JSON.stringify({ rows, chunkRows, pageRows, electron, tmux }, null, 2));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
