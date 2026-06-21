// lunix — a lightweight web desktop: a windowing shell with a dock, draggable/resizable windows,
// a Files explorer, Memo, an assistant, and a Terminal. Vanilla JS, no framework or dependencies —
// a desktop shell is just windows + a dock + a little drag math.

// ---- icon set (line icons) ----
const I = {
  storyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8.5L12 4l8 4.5V20"/><path d="M8 20v-6h8v6"/></svg>',
  browser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M8 8h.01M12 8h.01"/></svg>',
  memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h9.5L19 7.3v12.9H6z"/><path d="M15.5 3.8V8H19"/><path d="M9 11h7M9 14h7M9 17h4"/></svg>',
  files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2.5h5.5A2.5 2.5 0 0 1 20 9v7.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/></svg>',
  terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/></svg>',
  preview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="12.5" rx="2.2"/><path d="m7 14 3.1-3.4 2.4 2.4 1.6-2 3 3"/><path d="M9 20h6M12 17.5V20"/><circle cx="8.2" cy="8.8" r=".8" fill="currentColor" stroke="none"/></svg>',
  apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/></svg>',
  recordings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5a3 3 0 0 0-3 3v4.2a3 3 0 0 0 6 0V7.5a3 3 0 0 0-3-3Z"/><path d="M6.2 10.6v.8a5.8 5.8 0 0 0 11.6 0v-.8"/><path d="M12 17.2v3.3"/><path d="M8.8 20.5h6.4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.8a7.8 7.8 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.3 2.8h4.6l.3-2.8c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1.1Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.8A2.3 2.3 0 0 1 5.8 4.5h4.3l2 2.4h6.1a2.3 2.3 0 0 1 2.3 2.3v7.7a2.6 2.6 0 0 1-2.6 2.6H6.1a2.6 2.6 0 0 1-2.6-2.6Z"/><path d="M3.5 9.2h17"/></svg>',
  doc: '<svg viewBox="0 0 48 56"><path d="M8 3h22l10 10v36c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V7c0-2.2 1.8-4 4-4Z" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M30 3v11h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 25h22M13 33h18M13 41h13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".58"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  newfolder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.2A2.2 2.2 0 0 1 5.7 5h4.1l2 2.3h6.5a2.2 2.2 0 0 1 2.2 2.2v7.1a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4Z"/><path d="M15.5 11.5v5M13 14h5"/></svg>',
  agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4 10.2 11.5 5.3 9.7 10.2 7.9z"/><path d="M19 16.5l.7 2 .7-2-.7-2zM5 4.5l.6 1.7.6-1.7-.6-1.7z" opacity=".7"/></svg>',
};

// ---- sample filesystem (so the Files explorer has content) ----
const FS = {
  Desktop: [
    { name: 'welcome.md', kind: 'text', size: '1 KB', body: '# Welcome to lunix\n\nA lightweight web desktop.\nOpen apps from the dock, drag windows by their title bar, resize from the edges.' },
    { name: 'shortcuts.md', kind: 'text', size: '2 KB', body: '# Shortcuts\n\n- Click a dock icon to open an app\n- Drag the title bar to move a window\n- Drag any edge or corner to resize\n- Click a window to bring it to the front' },
  ],
  Notes: [
    { name: 'ideas.md', kind: 'text', size: '2 KB', body: '# Ideas\n\n- A tiling layout mode\n- Per-app window memory\n- A quick-launch palette' },
    { name: 'changelog.txt', kind: 'text', size: '1 KB', body: 'v0.1  desktop shell + dock\nv0.2  window manager (drag / focus / resize)\nv0.3  files explorer\nv0.4  embedded terminal' },
  ],
  Media: [
    { name: 'sizes.csv', kind: 'text', size: '1 KB', body: 'item,bytes\nicon,512\nwallpaper,40960\nthumbnail,2048' },
    { name: 'mark.svg', kind: 'image', size: '2 KB', body: './assets/mark.svg' },
  ],
  Trash: [],
};

// ---- dock config ----
const ACCENT = 'rgb(74,158,142)', MUTED = 'rgb(122,118,112)', INK = 'rgb(43,42,40)';
// The Terminal app embeds a web terminal running as a local service.
// ?theme=sand matches this desktop's palette; ?embed=1 hides the terminal's own window chrome
// (title/status bars) so this window's frame is the only chrome — no nesting, no double status bar.
const TERMINAL_URL = 'http://localhost:7777/?theme=sand&embed=1';

// Files app sources ("mounts"). Each mount is a provider with the same list/read/write shape:
//   • Workspace — the Nodus WorkspaceRuntime, via the Nodus SDK.
//   • Local     — real folders on this machine, via lunix's own /api/local routes (home-sandboxed).
const NODUS_URL = 'http://localhost:8787';
const NODUS_USER = 'lunix-demo'; // swap for a real Nodus user id when provided
const nodusClient = (typeof Nodus !== 'undefined') ? Nodus({ baseUrl: NODUS_URL, userId: NODUS_USER }) : null;
const localFs = {
  list: (p) => fetch('/api/local/files?path=' + encodeURIComponent(p || '/')).then((r) => r.json()),
  read: (p) => fetch('/api/local/file?path=' + encodeURIComponent(p)).then((r) => r.json()),
  write: (p, content) => fetch('/api/local/file', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: p, content }) }).then((r) => r.json()),
};
// Local FS is a desktop-only convenience (a second-class resource). On iPad / a cloud-hosted lunix
// there's no local runtime to mount, so it's only offered when lunix is served from this machine.
const IS_LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|::1|\[::1\])/.test(location.hostname);
const MOUNTS = [
  { id: 'workspace', name: 'Workspace', sub: 'runtime', provider: () => nodusClient && nodusClient.workspace },
  ...(IS_LOCAL_HOST ? [{ id: 'local', name: 'Local', sub: '~ home', provider: () => localFs }] : []),
];

const GROUP_A = [{ id: 'storyboard', label: 'Storyboard', icon: I.storyboard }];
const GROUP_B = [
  { id: 'browser', label: 'Browser', icon: I.browser },
  { id: 'terminal', label: 'Terminal', icon: I.terminal, accent: true },
  { id: 'memo', label: 'Memo', icon: I.memo, accent: true },
  { id: 'files', label: 'Files', icon: I.files, accent: true },
  { id: 'preview', label: 'Preview', icon: I.preview },
  { id: 'apps', label: 'Apps', icon: I.apps },
  { id: 'recordings', label: 'Recordings', icon: I.recordings },
  { id: 'settings', label: 'Settings', icon: I.settings },
  { id: 'trash', label: 'Trash', icon: I.trash },
];
const GROUP_C = [{ id: 'agent', label: 'Assistant', icon: I.agent, accent: true }];

const surface = document.getElementById('surface');
const dockEl = document.getElementById('dock');
let zTop = 100;
const windows = new Map(); // id -> element
const cleanup = new Map(); // app id -> fn to run when its window closes (e.g. release a browser session)

// ---- dock ----
function buildDock() {
  dockEl.setAttribute('style', 'position:absolute;left:50%;bottom:32px;transform:translateX(-50%);z-index:1300;');
  const bar = document.createElement('div');
  bar.className = 'flex items-center';
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;height:54px;background:rgba(246,245,242,0.85);backdrop-filter:blur(12px);border:1px solid rgba(226,223,216,0.6);border-radius:27px;padding:0 12px;box-shadow:rgba(43,42,40,0.18) 0 14px 28px -12px,rgba(43,42,40,0.12) 0 6px 12px -10px;';
  const btn = (app, base) => {
    const b = document.createElement('button');
    b.title = app.label; b.setAttribute('aria-label', app.label);
    b.style.cssText = `width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:50%;cursor:pointer;transition:all .18s;color:${app.accent ? ACCENT : base};`;
    b.innerHTML = app.img ? `<img src="${app.img}" alt="" style="width:22px;height:12px;object-fit:contain;" draggable="false">` : app.icon;
    if (b.firstElementChild && b.firstElementChild.tagName === 'svg') { b.firstElementChild.setAttribute('width', '18'); b.firstElementChild.setAttribute('height', '18'); }
    b.onmouseenter = () => { b.style.background = 'rgba(43,42,40,0.06)'; };
    b.onmouseleave = () => { b.style.background = 'transparent'; };
    b.onclick = () => openApp(app);
    return b;
  };
  const grp = (apps, base, pad) => { const g = document.createElement('div'); g.style.cssText = `display:flex;align-items:center;gap:${pad};`; apps.forEach((a) => g.appendChild(btn(a, base))); return g; };
  const sep = () => { const s = document.createElement('div'); s.style.cssText = 'width:1px;height:24px;background:rgb(226,223,216);'; return s; };
  bar.append(grp(GROUP_A, INK, '12px'), grp(GROUP_B, MUTED, '4px'), sep(), grp(GROUP_C, MUTED, '8px'));
  dockEl.appendChild(bar);
}

// ---- window manager ----
function focusWin(el) { el.style.zIndex = ++zTop; windows.forEach((w) => w.classList.remove('active')); el.classList.add('active'); }

function openApp(app) {
  if (windows.has(app.id)) { focusWin(windows.get(app.id)); return; }
  const idx = windows.size;
  const w = document.createElement('section');
  w.className = 'lunix-desktop-window active';
  w.setAttribute('aria-label', app.label);
  const width = app.id === 'browser' ? 1040 : app.id === 'files' ? 840 : app.id === 'terminal' ? 900 : app.id === 'memo' ? 760 : 620;
  const height = app.id === 'browser' ? 720 : app.id === 'files' ? 560 : app.id === 'terminal' ? 600 : 480;
  w.style.cssText = `left:${120 + idx * 34}px;top:${64 + idx * 30}px;width:${width}px;height:${height}px;z-index:${++zTop};`;

  const titleIcon = app.icon || I.doc;
  w.innerHTML = `
    <div class="lunix-window-titlebar">
      <div class="lunix-window-controls">
        <button type="button" class="close" aria-label="Close"></button>
        <button type="button" class="minimize" aria-label="Minimize"></button>
        <button type="button" class="maximize" aria-label="Maximize"></button>
      </div>
      <div class="lunix-window-title"><span>${app.id === 'files' || app.id === 'memo' ? I.doc : titleIcon}</span><strong>${app.label}</strong></div>
      <div class="lunix-window-actions">
        <button type="button" class="lunix-window-icon-button" aria-label="New">${I.plus}</button>
        <button type="button" class="lunix-window-icon-button" aria-label="More">${I.newfolder}</button>
      </div>
    </div>
    <div class="lunix-window-body"><div class="lunix-window-pane"><div class="lunix-window-content no-padding"></div></div></div>
    ${['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => `<span class="lunix-window-resize-handle ${d}" data-dir="${d}" aria-hidden="true"></span>`).join('')}`;

  surface.appendChild(w);
  windows.set(app.id, w);
  renderApp(app.id, w.querySelector('.lunix-window-content'));

  w.addEventListener('mousedown', () => focusWin(w));
  w.querySelector('.close').onclick = (e) => { e.stopPropagation(); w.remove(); windows.delete(app.id); const fn = cleanup.get(app.id); if (fn) { cleanup.delete(app.id); try { fn(); } catch (_) {} } };
  makeDraggable(w, w.querySelector('.lunix-window-titlebar'));
  w.querySelectorAll('.lunix-window-resize-handle').forEach((h) => makeResizable(w, h));
}

// While dragging/resizing, disable iframe hit-testing so an embedded app can't swallow
// the mouse stream — otherwise the cursor passing over the iframe drops frames and the drag stutters.
function freezeIframes(on) { document.querySelectorAll('.lunix-desktop-window iframe').forEach((f) => { f.style.pointerEvents = on ? 'none' : ''; }); }

function makeDraggable(win, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const sx = e.clientX, sy = e.clientY, baseL = win.offsetLeft, baseT = win.offsetTop;
    let dx = 0, dy = 0;
    handle.setPointerCapture(e.pointerId); // route every move here even over the iframe or outside the window
    freezeIframes(true); win.style.willChange = 'transform'; document.body.classList.add('lunix-dragging');
    // Move on the compositor with transform (no per-frame relayout of the heavy iframe subtree).
    const move = (ev) => { dx = ev.clientX - sx; dy = Math.max(-baseT, ev.clientY - sy); win.style.transform = `translate(${dx}px,${dy}px)`; };
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      win.style.transform = ''; win.style.willChange = '';
      win.style.left = baseL + dx + 'px'; win.style.top = baseT + dy + 'px';
      freezeIframes(false); document.body.classList.remove('lunix-dragging');
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up); e.preventDefault();
  });
}

function makeResizable(win, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const dir = handle.dataset.dir, sx = e.clientX, sy = e.clientY;
    const w0 = win.offsetWidth, h0 = win.offsetHeight, l0 = win.offsetLeft, t0 = win.offsetTop;
    handle.setPointerCapture(e.pointerId);
    freezeIframes(true); document.body.classList.add('lunix-dragging');
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (dir.includes('e')) win.style.width = Math.max(360, w0 + dx) + 'px';
      if (dir.includes('s')) win.style.height = Math.max(280, h0 + dy) + 'px';
      if (dir.includes('w')) { const nw = Math.max(360, w0 - dx); win.style.width = nw + 'px'; win.style.left = l0 + (w0 - nw) + 'px'; }
      if (dir.includes('n')) { const nh = Math.max(280, h0 - dy); win.style.height = nh + 'px'; win.style.top = t0 + (h0 - nh) + 'px'; }
    };
    const up = () => { freezeIframes(false); document.body.classList.remove('lunix-dragging'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up); e.preventDefault();
  });
}

// ---- app content renderers ----
function renderApp(id, root) {
  if (id === 'browser') return renderBrowser(root);
  if (id === 'files') return renderFiles(root);
  if (id === 'terminal') return renderTerminal(root);
  if (id === 'memo') return renderMemo(root);
  if (id === 'agent') return renderAgent(root);
  root.classList.remove('no-padding');
  root.innerHTML = `<div class="lunix-finder-empty" style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;">
    <div><div style="font-weight:600;margin-bottom:6px;">${id.charAt(0).toUpperCase() + id.slice(1)}</div>
    <div style="opacity:.6;font-size:13px;">This app is part of the lunix desktop.</div></div></div>`;
}

function renderFiles(root) {
  // A multi-source file manager: a left rail of mounts (Workspace runtime + Local home), then the
  // current directory and an editable preview. Every mount is a provider with list/read/write, so the
  // same UI drives the Nodus workspace (via the SDK) and the local filesystem (via lunix's routes).
  const app = document.createElement('div');
  app.className = 'lunix-files-app';
  app.style.setProperty('--lunix-files-grid-template', '220px 7px minmax(200px, 1fr) 7px 320px');
  let mountId = MOUNTS[0].id, cwd = '/', entries = [], activeFile = null, content = '', dirty = false, status = '', error = '';
  const prov = () => MOUNTS.find((m) => m.id === mountId).provider();
  const parent = (p) => { const x = p.replace(/\/+$/, '').split('/'); x.pop(); return x.join('/') || '/'; };

  async function listDir(path) {
    error = ''; const p = prov();
    if (!p) { error = 'source unavailable'; entries = []; return; }
    try { const r = await p.list(path); entries = r.entries || []; cwd = r.path || path; }
    catch (e) { error = String(e.message || e); entries = []; }
  }
  async function openFile(path) { const r = await prov().read(path); activeFile = path; content = r.content != null ? r.content : '(' + (r.error || 'unreadable') + ')'; dirty = false; status = ''; }
  async function save() {
    if (!activeFile) return;
    status = 'Saving…'; paint();
    try { const r = await prov().write(activeFile, content); dirty = false; status = r.ok ? 'Saved ✓' : ('Error: ' + (r.error || '')); }
    catch (e) { status = 'Error: ' + e.message; }
    paint();
    if (status === 'Saved ✓') setTimeout(() => { status = ''; paint(); }, 1400);
  }
  async function go(path) { activeFile = null; await listDir(path); paint(); }
  async function switchMount(id) { if (id === mountId) return; mountId = id; cwd = '/'; activeFile = null; content = ''; await listDir('/'); paint(); }

  function paint() {
    app.innerHTML = '';
    const dirs = entries.filter((e) => e.type === 'dir');
    const files = entries.filter((e) => e.type === 'file');
    // left — mounts, then directories
    const aside = document.createElement('aside'); aside.className = 'lunix-files-folders';
    MOUNTS.forEach((m) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'lunix-files-folder' + (m.id === mountId ? ' selected' : '');
      b.innerHTML = `<span class="lunix-files-folder-icon">${I.files}</span><span><strong>${m.name}</strong><small>${m.sub}</small></span>`;
      b.onclick = () => switchMount(m.id);
      aside.appendChild(b);
    });
    const sep = document.createElement('div'); sep.style.cssText = 'margin:6px 12px;border-top:1px solid #ece8df;'; aside.appendChild(sep);
    const crumb = document.createElement('div'); crumb.className = 'lunix-files-folder'; crumb.style.cssText = 'cursor:default;opacity:.7;';
    crumb.innerHTML = `<span class="lunix-files-folder-icon">${I.folder}</span><span><strong>${cwd === '/' ? '/' : cwd.split('/').pop()}</strong><small>${cwd}</small></span>`;
    aside.appendChild(crumb);
    if (cwd && cwd !== '/') {
      const up = document.createElement('button'); up.type = 'button'; up.className = 'lunix-files-folder';
      up.innerHTML = `<span class="lunix-files-folder-icon">${I.folder}</span><span><strong>..</strong><small>up</small></span>`;
      up.onclick = () => go(parent(cwd));
      aside.appendChild(up);
    }
    dirs.forEach((d) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lunix-files-folder';
      b.innerHTML = `<span class="lunix-files-folder-icon">${I.folder}</span><span><strong>${d.name}</strong><small>folder</small></span>`;
      b.onclick = () => go(d.path);
      aside.appendChild(b);
    });
    const r1 = document.createElement('span'); r1.className = 'lunix-files-column-resizer';
    // middle — files (or error)
    const list = document.createElement('section'); list.className = 'lunix-files-list';
    if (error) list.innerHTML = `<div class="lunix-finder-empty" style="padding:24px;text-align:center;line-height:1.6;">${escapeHtml(error)}<br><span style="opacity:.6;font-size:12px;">${mountId === 'workspace' ? 'Start Nodus: cd Nodus-backend &amp;&amp; NODUS_WORKSPACE_RUNTIME_DRIVER=local npm run dev' : ''}</span></div>`;
    else if (!files.length) list.innerHTML = '<div class="lunix-finder-empty">No files here.</div>';
    files.forEach((f) => {
      const row = document.createElement('button'); row.type = 'button';
      row.className = 'lunix-files-file' + (f.path === activeFile ? ' selected' : '');
      row.innerHTML = `<span class="lunix-file-row-icon">${I.doc}</span><span class="lunix-file-row-main"><span class="lunix-file-row-title">${f.name}</span><span class="lunix-file-row-meta">file</span></span>`;
      row.onclick = async () => { await openFile(f.path); paint(); };
      list.appendChild(row);
    });
    const r2 = document.createElement('span'); r2.className = 'lunix-files-column-resizer';
    // right — editable preview + Save
    const prev = document.createElement('aside'); prev.className = 'lunix-files-preview';
    if (!activeFile) { prev.innerHTML = '<div class="lunix-finder-empty">Select a file.</div>'; }
    else {
      prev.style.cssText = 'display:flex;flex-direction:column;';
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #e2dfd8;font-size:12px;';
      const name = document.createElement('span'); name.style.cssText = 'flex:1;color:#6f685e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; name.textContent = activeFile + (dirty ? ' •' : '');
      const st = document.createElement('span'); st.style.color = '#17796d'; st.textContent = status;
      const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save';
      saveBtn.style.cssText = 'border:none;background:#17796d;color:#fff;border-radius:7px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;';
      saveBtn.onclick = save;
      bar.append(name, st, saveBtn);
      const ta = document.createElement('textarea'); ta.value = content; ta.spellcheck = false;
      ta.style.cssText = 'flex:1;border:none;outline:none;resize:none;background:transparent;padding:14px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#24231f;';
      ta.oninput = () => { content = ta.value; if (!dirty) { dirty = true; name.textContent = activeFile + ' •'; } };
      prev.append(bar, ta);
    }
    app.append(aside, r1, list, r2, prev);
  }

  paint(); // immediate shell, then load the default mount
  listDir('/').then(paint);
  root.appendChild(app);
}

function renderMemo(root) {
  const notes = FS.Desktop.filter((f) => f.kind === 'text');
  let active = notes[0];
  const app = document.createElement('div'); app.className = 'lunix-notes-app';
  function paint() {
    app.innerHTML = '';
    const list = document.createElement('aside'); list.className = 'lunix-notes-list';
    notes.forEach((n) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'lunix-files-file' + (n === active ? ' selected' : '');
      b.style.cssText = 'width:100%;text-align:left;';
      b.innerHTML = `<span class="lunix-file-row-main"><span class="lunix-file-row-title">${n.name}</span><span class="lunix-file-row-meta">${n.body.split('\n')[0].replace(/^#\s*/, '')}</span></span>`;
      b.onclick = () => { active = n; paint(); };
      list.appendChild(b);
    });
    const ed = document.createElement('section'); ed.className = 'lunix-note-editor';
    ed.innerHTML = `<textarea spellcheck="false" style="width:100%;height:100%;border:none;outline:none;resize:none;background:transparent;padding:22px;font:14px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#24231f;">${escapeHtml(active.body)}</textarea>`;
    app.append(list, ed);
  }
  paint();
  root.appendChild(app);
}

function renderBrowser(root) {
  // A real cloud browser, rendered as OUR UI: the backend streams the page as MJPEG into an <img>
  // sized to this window (so the page reflows to fit — no tiny scaling, no dark empty space), and we
  // forward mouse/keyboard back over CDP. The only chrome is this one cream address bar.
  root.style.position = 'relative';
  root.style.background = '#f7f5f0';
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #e2dfd8;background:#faf8f3;flex:none;">
        <button data-reload title="Reload" style="width:30px;height:30px;border:none;background:transparent;border-radius:8px;cursor:pointer;color:#6f685e;display:inline-flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v4h4"/></svg></button>
        <input data-url placeholder="Search or enter a URL" spellcheck="false"
          style="flex:1;height:32px;border:1px solid #e2dfd8;border-radius:9px;background:#fff;padding:0 14px;font-size:13px;color:#24231f;outline:none;">
        <button data-go style="height:32px;padding:0 16px;border:none;border-radius:9px;background:#17796d;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Go</button>
      </div>
      <div data-view tabindex="0" style="position:relative;flex:1;overflow:hidden;background:#fff;outline:none;cursor:default;">
        <img data-frame draggable="false" style="display:block;position:absolute;top:0;left:0;user-select:none;">
        <div data-splash style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f7f5f0;color:#6f685e;font-size:13px;">
          <div style="width:46px;height:46px;color:#17796d;">${I.browser}</div>
          <div data-msg style="font-weight:600;">Starting cloud browser…</div>
          <div style="width:160px;height:3px;border-radius:3px;background:#e2dfd8;overflow:hidden;">
            <div style="width:40%;height:100%;background:#17796d;border-radius:3px;animation:lxLoad 1s ease-in-out infinite;"></div>
          </div>
        </div>
      </div>
    </div>`;
  if (!document.getElementById('lx-load-kf')) {
    const st = document.createElement('style'); st.id = 'lx-load-kf';
    st.textContent = '@keyframes lxLoad{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}';
    document.head.appendChild(st);
  }
  const view = root.querySelector('[data-view]'), frame = root.querySelector('[data-frame]');
  const urlIn = root.querySelector('[data-url]'), splash = root.querySelector('[data-splash]'), msg = root.querySelector('[data-msg]');
  let sessionId = null;
  const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const size = () => ({ width: Math.max(360, Math.round(view.clientWidth)), height: Math.max(260, Math.round(view.clientHeight)) });
  const fit = (w, h) => { frame.style.width = w + 'px'; frame.style.height = h + 'px'; };
  const mods = (e) => (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
  const BTN = ['left', 'middle', 'right'];

  requestAnimationFrame(() => {
    const { width, height } = size();
    post('/api/browser/session', { width, height }).then((r) => r.json()).then((s) => {
      if (s.error || !s.sessionId) { msg.textContent = s.error ? 'Browser unavailable: ' + s.error : 'Could not start a session.'; return; }
      sessionId = s.sessionId; urlIn.value = s.home || '';
      fit(s.width || width, s.height || height);
      cleanup.set('browser', () => { const b = JSON.stringify({ sessionId }); if (navigator.sendBeacon) navigator.sendBeacon('/api/browser/release', new Blob([b], { type: 'application/json' })); else post('/api/browser/release', { sessionId }); });
      frame.addEventListener('load', () => { if (splash.isConnected) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); } }, { once: true });
      frame.src = '/api/browser/stream?sessionId=' + encodeURIComponent(sessionId);
    }).catch((e) => { msg.textContent = 'Browser unavailable: ' + e.message; });
  });

  // ---- input forwarding (coords are 1:1 — the remote viewport equals the <img> size) ----
  const sendMouse = (type, e, extra) => { if (sessionId) post('/api/browser/input', { sessionId, kind: 'mouse', type, x: Math.round(e.offsetX), y: Math.round(e.offsetY), modifiers: mods(e), ...extra }); };
  let lastMove = 0;
  frame.addEventListener('mousemove', (e) => { const t = performance.now(); if (t - lastMove < 35) return; lastMove = t; sendMouse('mouseMoved', e, { button: 'none' }); });
  frame.addEventListener('mousedown', (e) => { e.preventDefault(); view.focus(); sendMouse('mousePressed', e, { button: BTN[e.button] || 'left', clickCount: 1 }); });
  frame.addEventListener('mouseup', (e) => { e.preventDefault(); sendMouse('mouseReleased', e, { button: BTN[e.button] || 'left', clickCount: 1 }); });
  frame.addEventListener('contextmenu', (e) => e.preventDefault());
  view.addEventListener('wheel', (e) => { e.preventDefault(); if (sessionId) post('/api/browser/input', { sessionId, kind: 'mouse', type: 'mouseWheel', x: Math.round(e.offsetX), y: Math.round(e.offsetY), deltaX: e.deltaX, deltaY: e.deltaY, modifiers: mods(e) }); }, { passive: false });
  const sendKey = (type, e) => { if (sessionId) post('/api/browser/input', { sessionId, kind: 'key', type, key: e.key, code: e.code, text: type === 'keyDown' && e.key.length === 1 ? e.key : '', vk: e.keyCode, modifiers: mods(e) }); };
  view.addEventListener('keydown', (e) => { if (e.metaKey && e.key === 'v') return; e.preventDefault(); sendKey('keyDown', e); });
  view.addEventListener('keyup', (e) => { e.preventDefault(); sendKey('keyUp', e); });

  // ---- address bar + reload + resize ----
  const go = () => { const url = urlIn.value.trim(); if (url && sessionId) post('/api/browser/navigate', { sessionId, url }); view.focus(); };
  urlIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }); // stopPropagation: don't forward to the page
  root.querySelector('[data-go]').onclick = go;
  root.querySelector('[data-reload]').onclick = () => { if (sessionId) post('/api/browser/navigate', { sessionId, url: urlIn.value || 'https://www.google.com' }); };
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!sessionId) return; const { width, height } = size(); fit(width, height); post('/api/browser/resize', { sessionId, width, height }); }, 250); });
  ro.observe(view);
}

function renderTerminal(root) {
  // Embed the web terminal (a local service) and show a brief launch splash while it boots.
  root.style.position = 'relative';
  root.style.background = '#f7f5f0';
  const frame = document.createElement('iframe');
  frame.src = TERMINAL_URL;
  frame.setAttribute('title', 'Terminal');
  frame.style.cssText = 'width:100%;height:100%;border:none;display:block;background:#f7f5f0;';

  const splash = document.createElement('div');
  splash.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f7f5f0;color:#6f685e;font-size:13px;transition:opacity .4s;';
  splash.innerHTML = `
    <div style="width:46px;height:46px;color:#17796d;">${I.terminal}</div>
    <div style="font-weight:600;letter-spacing:.02em;">Starting Terminal…</div>
    <div style="width:160px;height:3px;border-radius:3px;background:#e2dfd8;overflow:hidden;">
      <div style="width:40%;height:100%;background:#17796d;border-radius:3px;animation:lxLoad 1s ease-in-out infinite;"></div>
    </div>`;
  if (!document.getElementById('lx-load-kf')) {
    const st = document.createElement('style'); st.id = 'lx-load-kf';
    st.textContent = '@keyframes lxLoad{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}';
    document.head.appendChild(st);
  }
  const done = () => { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); };
  frame.addEventListener('load', done);
  // Fallback: if the terminal service isn't reachable, tell the user instead of spinning forever.
  setTimeout(() => {
    if (!splash.isConnected) return;
    splash.querySelector('div:nth-child(2)').textContent = 'Terminal service not reachable on :7777';
    splash.querySelector('div:nth-child(3)').outerHTML = '<div style="opacity:.6;font-size:12px;">Start the terminal service on port 7777, then reopen.</div>';
  }, 6000);

  root.append(frame, splash);
}

// The agent runtime is the system's brain — first-class. One session is booted once and reused
// across opens (the other runtimes are resources it drives). Backed by the Nodus SDK.
let agentSession = null, agentBoot = null;

function renderAgent(root) {
  root.classList.remove('no-padding');
  root.style.background = '#fff';
  const msgs = []; // { role: 'user' | 'assistant' | 'system', text }
  let booting = true, sending = false;

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #ece8df;font-size:12px;color:#6f685e;">
        <span style="width:18px;height:18px;color:#17796d;display:inline-flex;">${I.agent}</span>
        <strong style="color:#24231f;">Agent</strong><span style="opacity:.5;">runtime · the brain</span>
        <span data-status style="margin-left:auto;color:#9e9a93;">starting…</span>
      </div>
      <div data-log style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px;"></div>
      <div style="padding:14px;border-top:1px solid #ece8df;">
        <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2dfd8;border-radius:14px;padding:8px 12px;">
          <input data-input placeholder="Message the agent…" style="flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#24231f;">
          <button data-send style="border:none;background:#17796d;color:#fff;border-radius:9px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;">Send</button>
        </div>
      </div>
    </div>`;
  const log = root.querySelector('[data-log]'), input = root.querySelector('[data-input]');
  const statusEl = root.querySelector('[data-status]');

  function bubble(m) {
    const me = m.role === 'user', sys = m.role === 'system';
    const row = document.createElement('div');
    row.style.cssText = `display:flex;gap:10px;align-items:flex-start;${me ? 'flex-direction:row-reverse;' : ''}`;
    const av = me || sys ? '' : `<span style="width:22px;height:22px;color:#17796d;flex:none;margin-top:2px;display:inline-flex;">${I.agent}</span>`;
    const bg = me ? '#17796d' : sys ? '#fff5df' : '#f6f5f2', fg = me ? '#fff' : sys ? '#9d6c25' : '#3b3832', bd = me ? '#17796d' : sys ? '#f0e2bf' : '#e2dfd8';
    row.innerHTML = `${av}<div style="background:${bg};color:${fg};border:1px solid ${bd};border-radius:14px;padding:10px 13px;max-width:78%;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">${escapeHtml(m.text)}</div>`;
    return row;
  }
  function paintLog() {
    log.innerHTML = '';
    if (!msgs.length && !booting) { const hint = document.createElement('div'); hint.style.cssText = 'margin:auto;opacity:.45;font-size:13px;text-align:center;'; hint.textContent = 'The agent runtime is the brain — ask it anything.'; log.appendChild(hint); }
    msgs.forEach((m) => log.appendChild(bubble(m)));
    log.scrollTop = log.scrollHeight;
  }
  const pushEvents = (events) => (events || []).forEach((e) => { const t = (e.payload || {}).text; if (e.eventType === 'assistant_message' && t) msgs.push({ role: 'assistant', text: t }); });

  async function boot() {
    if (!nodusClient) { statusEl.textContent = 'Nodus offline'; booting = false; msgs.push({ role: 'system', text: 'Agent runtime not reachable on :8787. Start Nodus to boot the brain.' }); return paintLog(); }
    try {
      if (!agentBoot) agentBoot = nodusClient.ensureSession({ provider: 'claude', apiKey: 'demo-key' });
      agentSession = await agentBoot;
      pushEvents((await nodusClient.sessions.events(agentSession.session.id)).events);
      statusEl.textContent = 'claude · live';
    } catch (e) { agentBoot = null; statusEl.textContent = 'error'; msgs.push({ role: 'system', text: 'Could not boot agent: ' + (e.message || e) }); }
    booting = false; paintLog();
  }
  async function send() {
    const text = input.value.trim();
    if (!text || sending || !agentSession) return;
    input.value = ''; msgs.push({ role: 'user', text }); sending = true; statusEl.textContent = 'thinking…'; paintLog();
    try { pushEvents((await nodusClient.sessions.sendMessage(agentSession.session.id, text)).events); }
    catch (e) { msgs.push({ role: 'system', text: 'error: ' + (e.message || e) }); }
    sending = false; statusEl.textContent = 'claude · live'; paintLog();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  root.querySelector('[data-send]').onclick = send;
  paintLog(); boot();
}

function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

// ---- boot ----
buildDock();
openApp(GROUP_C[0]); // open the Agent (the brain) on load — the first-class runtime
