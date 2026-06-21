// Web (browser) backend for the Warp replica. Serves the same renderer that Electron loads, but
// bridges the PTY over HTTP instead of IPC: SSE for shell output (server->browser), POST for input.
// Zero new deps — http/fs/https + the already-present node-pty. Run:  npm run web  (then open :7777)
// ponytail: SSE+POST keeps it dependency-free; swap to a ws server only if input latency ever matters.
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');

const PORT = process.env.PORT || 7777;
const ROOT = __dirname;
const ptys = new Map();    // id -> pty process
const streams = new Map(); // id -> SSE response (the browser's output channel for that pty)

// ---- store + AI (same behavior as Electron main, no auth/API keys) ----
const DATA_DIR = path.join(os.homedir(), '.warp-electron');
const STORE = path.join(DATA_DIR, 'store.json');
const defaultStore = () => ({ settings: { theme: 'warpDark', fontSize: 13 }, workflows: [] });
const stripAuth = (s) => ({ settings: s?.settings || defaultStore().settings, workflows: Array.isArray(s?.workflows) ? s.workflows : [] });
const readStore = () => { try { return stripAuth(JSON.parse(fs.readFileSync(STORE, 'utf8'))); } catch { return defaultStore(); } };
const writeStore = (s) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STORE, JSON.stringify(stripAuth(s), null, 2)); };
function heuristicCmd(q) {
  const s = q.toLowerCase();
  const rules = [[/list.*(file|dir)|show.*files|what.*here/, 'ls -la'], [/disk|space|storage/, 'df -h'], [/memory|ram/, 'top -l 1 | head -10'], [/process|running/, 'ps aux | head -20'], [/current.*(dir|folder|path)|where am i/, 'pwd'], [/git.*status|changes/, 'git status'], [/git.*log|history/, 'git log --oneline -20'], [/find.*\b(\w+\.\w+)\b/, (m) => `find . -name '${m[1]}'`], [/ip address|my ip/, 'ipconfig getifaddr en0'], [/who am i|username/, 'whoami'], [/date|time/, 'date']];
  for (const [re, out] of rules) { const m = s.match(re); if (m) return typeof out === 'function' ? out(m) : out; }
  return `# no offline rule for: ${q}`;
}

// ---- PTY ----
function createPty(id, cols, rows) {
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
  const isZsh = /zsh$/.test(shell);
  const env = { ...process.env, TERM: 'xterm-256color', WARP_ELECTRON: '1' };
  let args = [];
  const siDir = path.join(ROOT, 'shell-integration');
  if (os.platform() !== 'win32') {
    if (isZsh) { env.ZDOTDIR = siDir; env.USER_ZDOTDIR = process.env.ZDOTDIR || os.homedir(); }
    else { args = ['--rcfile', path.join(siDir, 'bash-init.sh'), '-i']; }
  }
  const p = pty.spawn(shell, args, { name: 'xterm-256color', cols: cols || 80, rows: rows || 24, cwd: os.homedir(), env });
  const send = (event, msg) => { const res = streams.get(id); if (res) res.write(`event: ${event}\ndata: ${JSON.stringify(msg)}\n\n`); };
  p.onData((data) => send('data', { id, data }));
  p.onExit(({ exitCode }) => { send('exit', { id, exitCode }); ptys.delete(id); });
  ptys.set(id, p);
  return p;
}

// ---- HTTP ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });
const json = (res, obj) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // --- PTY bridge ---
  if (p === '/pty/stream') {                       // SSE: browser opens one per pty id
    const id = u.searchParams.get('id');
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    streams.set(id, res);
    req.on('close', () => { if (streams.get(id) === res) streams.delete(id); });
    return;
  }
  if (p === '/pty/spawn') { const { id, cols, rows } = await body(req); if (!ptys.has(id)) createPty(id, cols, rows); return json(res, true); }
  if (p === '/pty/write') { const { id, data } = await body(req); const t = ptys.get(id); if (t) t.write(data); return json(res, true); }
  if (p === '/pty/resize') { const { id, cols, rows } = await body(req); const t = ptys.get(id); if (t) try { t.resize(cols, rows); } catch (_) {} return json(res, true); }
  if (p === '/pty/kill') { const { id } = await body(req); const t = ptys.get(id); if (t) { t.kill(); ptys.delete(id); } return json(res, true); }

  // --- store + AI ---
  if (p === '/store' && req.method === 'GET') return json(res, readStore());
  if (p === '/store' && req.method === 'POST') { writeStore(await body(req)); return json(res, true); }
  if (p === '/ai') {
    const { prompt } = await body(req);
    return json(res, { source: 'offline', text: heuristicCmd(prompt) });
  }

  // --- static files (path-traversal-safe) ---
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`Warp web → http://localhost:${PORT}`));
process.on('SIGINT', () => { for (const t of ptys.values()) t.kill(); process.exit(0); });
