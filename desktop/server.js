// lunix backend: serves the static desktop and runs a cloud browser whose frames are streamed to the
// client as MJPEG (so the UI is fully ours — one address bar, page sized to the window, no devtools
// chrome). The API key never reaches the client. Zero dependencies — http/https + global WebSocket.
// Configure via env (or a local .env, gitignored):
//   BROWSERBASE_API_KEY=bb_live_...
//   BROWSERBASE_PROJECT_ID=...
// Run:  node server.js   then open http://localhost:8090
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Local filesystem mount for the Files app — browse/read/write real folders on this machine.
// Sandboxed to the home directory (localhost, single-user dev). ponytail: home-only is the blast-radius
// guard; widen the roots if you need to, but never expose this off localhost.
const LOCAL_ROOT = os.homedir();
function localResolve(p) {
  const abs = path.resolve(LOCAL_ROOT, String(p || '').replace(/^\/+/, '') || '.');
  if (abs !== LOCAL_ROOT && !abs.startsWith(LOCAL_ROOT + path.sep)) throw new Error('path escapes home');
  return abs;
}

// --- tiny .env loader (no dotenv dep) ---
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* rely on real env vars */ }

const PORT = process.env.PORT || 8090;
const KEY = process.env.BROWSERBASE_API_KEY || '';
const PROJECT = process.env.BROWSERBASE_PROJECT_ID || '';
const HOME_URL = process.env.BROWSER_HOME || 'https://www.google.com';
const ROOT = __dirname;
const sessions = new Map(); // sessionId -> active CDP page + stream state

// --- Browserbase REST ---
function bb(method, apiPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request('https://api.browserbase.com' + apiPath, {
      method, headers: { 'X-BB-API-Key': KEY, 'Content-Type': 'application/json' },
    }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}

// --- persistent CDP client over a Browserbase connectUrl (kept open for the session's life) ---
function cdpConnect(connectUrl) {
  return new Promise((resolve, reject) => {
    let ws; try { ws = new WebSocket(connectUrl); } catch (e) { return reject(e); }
    let id = 0; const pending = new Map(); const listeners = [];
    const api = {
      send(method, params, sessionId) {
        return new Promise((res, rej) => { const k = ++id; pending.set(k, { res, rej }); const m = { id: k, method, params: params || {} }; if (sessionId) m.sessionId = sessionId; try { ws.send(JSON.stringify(m)); } catch (e) { rej(e); } });
      },
      on(fn) { listeners.push(fn); },
      close() { try { ws.close(); } catch {} },
    };
    const timer = setTimeout(() => reject(new Error('cdp connect timeout')), 12000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(api); });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('cdp ws error')); });
    ws.addEventListener('message', (e) => {
      const o = JSON.parse(e.data);
      if (o.id && pending.has(o.id)) { const p = pending.get(o.id); pending.delete(o.id); o.error ? p.rej(new Error(o.error.message)) : p.res(o.result); }
      else if (o.method) listeners.forEach((fn) => { try { fn(o); } catch {} });
    });
  });
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
function writeFrame(res, buf) {
  try { res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`); res.write(buf); res.write('\r\n'); } catch {}
}

async function startSession(width, height, initialUrl) {
  const w = clamp(width, 360, 1600), h = clamp(height, 260, 1200);
  const home = /^https?:\/\//i.test(initialUrl || '') ? initialUrl : HOME_URL;
  const s = await bb('POST', '/v1/sessions', { projectId: PROJECT, keepAlive: true, timeout: Number(process.env.BROWSER_TIMEOUT) || 1800 });
  if (!s.id) throw new Error('session create failed');
  const dbg = await bb('GET', `/v1/sessions/${s.id}/debug`);
  const targetId = dbg.pages && dbg.pages[0] && dbg.pages[0].id;
  const cdp = await cdpConnect(s.connectUrl);
  // Discover the page target from CDP itself (the debug API id can lag/mismatch) and attach.
  let pageTarget = targetId;
  try { const tg = await cdp.send('Target.getTargets'); const pt = (tg.targetInfos || []).find((t) => t.type === 'page'); if (pt) pageTarget = pt.targetId; } catch {}
  const rec = { cdp, ps: null, targetId: null, streams: new Set(), latest: null, width: w, height: h, targets: [] };
  const activate = async (targetId) => {
    if (!targetId || targetId === rec.targetId) return;
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    rec.ps = sessionId; rec.targetId = targetId;
    rec.targets = rec.targets.filter((id) => id !== targetId).concat(targetId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: rec.width, height: rec.height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: rec.width, maxHeight: rec.height, everyNthFrame: 1 }, sessionId);
  };
  cdp.on((o) => {
    if (o.method === 'Page.screencastFrame') {
      if (o.sessionId !== rec.ps) return;
      const buf = Buffer.from(o.params.data, 'base64');
      rec.latest = buf;
      for (const res of rec.streams) writeFrame(res, buf);
      cdp.send('Page.screencastFrameAck', { sessionId: o.params.sessionId }, rec.ps).catch(() => {});
    }
    if (o.method === 'Target.targetCreated' && o.params.targetInfo.type === 'page') activate(o.params.targetInfo.targetId).catch(() => {});
    if (o.method === 'Target.targetDestroyed') {
      rec.targets = rec.targets.filter((id) => id !== o.params.targetId);
      if (o.params.targetId === rec.targetId) activate(rec.targets.at(-1)).catch(() => {});
    }
  });
  // Start the screencast on the stable about:blank, THEN navigate — startScreencast fails if issued
  // while the page is mid-navigation; once running it persists across the navigation.
  await activate(pageTarget);
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  cdp.send('Page.navigate', { url: home }, rec.ps).catch(() => {});
  sessions.set(s.id, rec);
  return { sessionId: s.id, home, width: w, height: h };
}

const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const requestCookie = (req, name) => req.headers.cookie?.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
};

function streamFile(req, res, file) {
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range && req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) {
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
    return fs.createReadStream(file).pipe(res);
  }
  const suffix = !range[1] && range[2];
  const start = suffix ? Math.max(0, size - Number(range[2])) : Number(range[1] || 0);
  const end = suffix ? size - 1 : Math.min(Number(range[2] || size - 1), size - 1);
  if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
  res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
  fs.createReadStream(file, { start, end }).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // Runtime config for the client, from this server's env. Point lunix at any Nodus / user / terminal
  // without editing code:  NODUS_URL=... NODUS_USER=... TERMINAL_URL=... node server.js
  if (p === '/config.js') {
    const cfg = {
      nodusUrl: process.env.NODUS_URL || 'http://localhost:8787',
      nodusUser: process.env.NODUS_USER || 'lunix-demo',
      terminalUrl: process.env.TERMINAL_URL || 'http://localhost:7777/?theme=sand&embed=1',
    };
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(`window.__LUNIX = ${JSON.stringify(cfg)};`);
  }

  if (p.startsWith('/api/browser/')) {
    if (!KEY || !PROJECT) return json(res, 500, { error: 'BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID not configured' });
    try {
      if (p === '/api/browser/session') {                          // create + screencast
        const { width, height, url } = await readBody(req);
        const savedId = requestCookie(req, 'lunix_browser_session');
        const saved = savedId && sessions.get(savedId);
        if (saved) return json(res, 200, { sessionId: savedId, home: '', width: saved.width, height: saved.height, reused: true });
        const session = await startSession(width, height, url);
        res.setHeader('Set-Cookie', `lunix_browser_session=${session.sessionId}; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax`);
        return json(res, 200, session);
      }
      if (p === '/api/browser/stream') {                           // live MJPEG: <img src> renders it natively
        const rec = sessions.get(u.searchParams.get('sessionId'));
        if (!rec) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-cache', Connection: 'keep-alive', Pragma: 'no-cache' });
        try { res.socket.setTimeout(0); res.socket.setNoDelay(true); } catch {}
        rec.streams.add(res);
        if (rec.latest) writeFrame(res, rec.latest);
        req.on('close', () => rec.streams.delete(res));
        return;
      }
      if (p === '/api/browser/input') {                            // forward mouse/key to the cloud page
        const b = await readBody(req); const rec = sessions.get(b.sessionId);
        if (!rec) return json(res, 404, { error: 'unknown session' });
        if (b.kind === 'mouse') await rec.cdp.send('Input.dispatchMouseEvent', { type: b.type, x: b.x, y: b.y, button: b.button || 'none', clickCount: b.clickCount || 0, deltaX: b.deltaX || 0, deltaY: b.deltaY || 0, modifiers: b.modifiers || 0 }, rec.ps);
        else if (b.kind === 'key') await rec.cdp.send('Input.dispatchKeyEvent', { type: b.type, key: b.key, code: b.code, text: b.text || '', unmodifiedText: b.text || '', windowsVirtualKeyCode: b.vk || 0, nativeVirtualKeyCode: b.vk || 0, modifiers: b.modifiers || 0 }, rec.ps);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/browser/navigate') {
        const { sessionId, url } = await readBody(req); const rec = sessions.get(sessionId);
        if (!rec) return json(res, 404, { error: 'unknown session' });
        await rec.cdp.send('Page.navigate', { url: /^[a-z]+:\/\//i.test(url) ? url : 'https://' + url }, rec.ps);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/browser/resize') {
        const { sessionId, width, height } = await readBody(req); const rec = sessions.get(sessionId);
        if (!rec) return json(res, 404, { error: 'unknown session' });
        const w = clamp(width, 360, 1600), h = clamp(height, 260, 1200); rec.width = w; rec.height = h;
        await rec.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, rec.ps);
        await rec.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: w, maxHeight: h, everyNthFrame: 1 }, rec.ps);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/browser/release') {
        const { sessionId } = await readBody(req); const rec = sessions.get(sessionId);
        sessions.delete(sessionId);
        if (rec) { for (const s of rec.streams) try { s.end(); } catch {} try { rec.cdp.close(); } catch {} }
        await bb('POST', `/v1/sessions/${sessionId}`, { projectId: PROJECT, status: 'REQUEST_RELEASE' }).catch(() => {});
        res.setHeader('Set-Cookie', 'lunix_browser_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
        return json(res, 200, { ok: true });
      }
    } catch (e) { return json(res, 500, { error: String((e && e.message) || e) }); }
    return json(res, 404, { error: 'not found' });
  }

  // local filesystem mount (Files app "Local" source) — home-sandboxed list/read/write
  if (p.startsWith('/api/local/')) {
    try {
      if (p === '/api/local/files') {
        const qp = u.searchParams.get('path') || '/';
        const ents = await fs.promises.readdir(localResolve(qp), { withFileTypes: true });
        const base = '/' + String(qp).replace(/^\/+|\/+$/g, '');
        const entries = ents.map((d) => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file', path: `${base}/${d.name}`.replace(/\/+/g, '/') }));
        entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
        return json(res, 200, { path: base || '/', entries });
      }
      if (p === '/api/local/file' && req.method === 'GET') {
        const qp = u.searchParams.get('path');
        if (!qp) return json(res, 400, { error: 'path required' });
        const buf = await fs.promises.readFile(localResolve(qp));
        const content = buf.length > 1_000_000 ? `(file too large to preview: ${buf.length} bytes)` : buf.toString('utf8');
        return json(res, 200, { path: qp, size: buf.length, content });
      }
      if (p === '/api/local/raw' && req.method === 'GET') {
        const qp = u.searchParams.get('path');
        if (!qp) return json(res, 400, { error: 'path required' });
        return streamFile(req, res, localResolve(qp));
      }
      if (p === '/api/local/file' && req.method === 'POST') {
        const b = await readBody(req);
        if (!b.path) return json(res, 400, { error: 'path required' });
        await fs.promises.writeFile(localResolve(b.path), String(b.content ?? ''));
        return json(res, 200, { ok: true, path: b.path });
      }
    } catch (e) { return json(res, 500, { error: String((e && e.message) || e) }); }
    return json(res, 404, { error: 'not found' });
  }

  // static files
  const fromPlanB = (req.headers.referer || '').includes('/plan-b');
  const rel = p === '/' ? 'index.html' : p === '/favicon.svg' ? 'cloud-browser/favicon.svg' : /^\/cloud-browser\/?$/.test(p) ? 'cloud-browser/index.html' : /^\/plan-b\/?$/.test(p) ? 'cloud-browser/plan-b.html' : fromPlanB && /^\/(assets|media)\//.test(p) ? `cloud-browser${p}` : decodeURIComponent(p).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`lunix → http://localhost:${PORT}${KEY ? '' : '  (set BROWSERBASE_API_KEY to enable the Browser app)'}`));
