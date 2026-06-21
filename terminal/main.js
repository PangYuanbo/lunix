const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');

let win;
const ptys = new Map(); // id -> pty process

function createPty(id, cols, rows) {
  const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL?.startsWith('/') ? process.env.SHELL : '/bin/zsh');
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', LUNIX_TERMINAL: '1' };
  const p = pty.spawn(shell, [], { name: 'xterm-256color', cols: cols || 80, rows: rows || 24, cwd: os.homedir(), env });
  p.onData((data) => win && win.webContents.send('pty:data', { id, data }));
  p.onExit(({ exitCode }) => win && win.webContents.send('pty:exit', { id, exitCode }));
  ptys.set(id, p);
  return p;
}

ipcMain.handle('pty:spawn', (e, { id, cols, rows }) => { if (!ptys.has(id)) createPty(id, cols, rows); return true; });
ipcMain.on('pty:write', (e, { id, data }) => { const p = ptys.get(id); if (p) p.write(data); });
ipcMain.on('pty:resize', (e, { id, cols, rows }) => { const p = ptys.get(id); if (p) try { p.resize(cols, rows); } catch (_) {} });
ipcMain.on('pty:kill', (e, { id }) => { const p = ptys.get(id); if (p) { p.kill(); ptys.delete(id); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 760, titleBarStyle: 'hiddenInset', backgroundColor: '#171b1f',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile('index.html');
  if (process.env.WARP_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { for (const p of ptys.values()) p.kill(); app.quit(); });
