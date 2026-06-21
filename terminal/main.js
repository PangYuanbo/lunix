const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');

let win;
const ptys = new Map(); // id -> pty process

// ---- Local persistence ("Warp Drive": settings + workflows only) ----
const DATA_DIR = path.join(os.homedir(), '.warp-electron');
const STORE = path.join(DATA_DIR, 'store.json');
function defaultStore() { return { settings: { theme: 'warpDark', fontSize: 13 }, workflows: [] }; }
function stripAuth(s) { return { settings: s?.settings || defaultStore().settings, workflows: Array.isArray(s?.workflows) ? s.workflows : [] }; }
function readStore() {
  try { return stripAuth(JSON.parse(fs.readFileSync(STORE, 'utf8'))); }
  catch { return defaultStore(); }
}
function writeStore(s) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(stripAuth(s), null, 2));
}

function shellIntegrationDir() { return path.join(__dirname, 'shell-integration'); }

function createPty(id, cols, rows) {
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
  const isZsh = /zsh$/.test(shell);
  const env = { ...process.env, TERM: 'xterm-256color', WARP_ELECTRON: '1' };
  let args = [];
  const siDir = shellIntegrationDir();
  if (os.platform() !== 'win32') {
    if (isZsh) { env.ZDOTDIR = siDir; env.USER_ZDOTDIR = process.env.ZDOTDIR || os.homedir(); }
    else { args = ['--rcfile', path.join(siDir, 'bash-init.sh'), '-i']; }
  }
  const p = pty.spawn(shell, args, { name: 'xterm-256color', cols: cols || 80, rows: rows || 24, cwd: os.homedir(), env });
  p.onData((data) => win && win.webContents.send('pty:data', { id, data }));
  p.onExit(({ exitCode }) => win && win.webContents.send('pty:exit', { id, exitCode }));
  ptys.set(id, p);
  return p;
}

ipcMain.handle('pty:spawn', (e, { id, cols, rows }) => { if (!ptys.has(id)) createPty(id, cols, rows); return true; });
ipcMain.on('pty:write', (e, { id, data }) => { const p = ptys.get(id); if (p) p.write(data); });
ipcMain.on('pty:resize', (e, { id, cols, rows }) => { const p = ptys.get(id); if (p) try { p.resize(cols, rows); } catch (_) {} });
ipcMain.on('pty:kill', (e, { id }) => { const p = ptys.get(id); if (p) { p.kill(); ptys.delete(id); } });
ipcMain.on('open-external', (e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });  // only http(s)
ipcMain.on('open-path', (e, p) => {                       // open a file/dir clicked in agent output
  let f = String(p).replace(/:\d+(:\d+)?$/, '');          // strip :line:col
  if (f.startsWith('~')) f = path.join(os.homedir(), f.slice(1));
  if (fs.existsSync(f)) shell.openPath(f);                 // only open paths that actually exist
});

// ---- Store IPC ----
ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (e, s) => { writeStore(s); return true; });

// ---- Agentic AI: local NL -> shell command heuristic, no auth/API keys. ----
function heuristicCmd(q) {
  const s = q.toLowerCase();
  const rules = [
    [/list.*(file|dir)|show.*files|what.*here/, 'ls -la'],
    [/disk|space|storage/, 'df -h'],
    [/memory|ram/, 'top -l 1 | head -10'],
    [/process|running/, 'ps aux | head -20'],
    [/current.*(dir|folder|path)|where am i/, 'pwd'],
    [/git.*status|changes/, 'git status'],
    [/git.*log|history/, 'git log --oneline -20'],
    [/find.*\b(\w+\.\w+)\b/, (m) => `find . -name '${m[1]}'`],
    [/ip address|my ip/, 'ipconfig getifaddr en0'],
    [/who am i|username/, 'whoami'],
    [/date|time/, 'date'],
  ];
  for (const [re, out] of rules) { const m = s.match(re); if (m) return typeof out === 'function' ? out(m) : out; }
  return `# no offline rule for: ${q}`;
}
ipcMain.handle('ai:ask', async (e, prompt) => {
  return { source: 'offline', text: heuristicCmd(prompt) };
});

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 760, titleBarStyle: 'hiddenInset', backgroundColor: '#171b1f',
    // sandbox:false so the preload can require the ported crate modules from src/crates.
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile('index.html');
  if (process.env.WARP_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { for (const p of ptys.values()) p.kill(); app.quit(); });
