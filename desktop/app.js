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
// Runtime endpoints come from window.__LUNIX (injected by the server from its env via /config.js),
// so pointing at a real Nodus / a real user id / a hosted terminal is config, not a code edit.
const CFG = (typeof window !== 'undefined' && window.__LUNIX) || {};
const TERMINAL_URL = CFG.terminalUrl || 'http://localhost:7777/?theme=lunix&embed=1';

// Files app sources ("mounts"). Each mount is a provider with the same list/read/write shape:
//   • Workspace — the Nodus WorkspaceRuntime, via the Nodus SDK.
//   • Local     — real folders on this machine, via lunix's own /api/local routes (home-sandboxed).
const NODUS_URL = CFG.nodusUrl || 'http://localhost:8787';
const NODUS_USER = CFG.nodusUser || 'lunix-demo'; // set NODUS_USER on the server for a real Nodus user id
const IS_LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|::1|\[::1\])/.test(location.hostname);
const nodusClient = (typeof Nodus !== 'undefined') ? Nodus({ baseUrl: NODUS_URL, userId: NODUS_USER }) : null;
const workspaceClient = (typeof Nodus !== 'undefined') ? Nodus({ baseUrl: (IS_LOCAL_HOST && CFG.workspaceUrl) || (IS_LOCAL_HOST ? 'http://localhost:8787' : NODUS_URL), userId: NODUS_USER }) : null;
const localFs = {
  list: (p) => fetch('/api/local/files?path=' + encodeURIComponent(p || '/')).then((r) => r.json()),
  read: (p) => fetch('/api/local/file?path=' + encodeURIComponent(p)).then((r) => r.json()),
  write: (p, content) => fetch('/api/local/file', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: p, content }) }).then((r) => r.json()),
};
// Local FS is a desktop-only convenience (a second-class resource). On iPad / a cloud-hosted lunix
// there's no local runtime to mount, so it's only offered when lunix is served from this machine.
const MOUNTS = [
  { id: 'workspace', name: 'Workspace', sub: 'runtime', provider: () => workspaceClient && workspaceClient.workspace },
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
const desktopFilesEl = document.getElementById('desktop-files');
let zTop = 100;
const windows = new Map(); // id -> element
const cleanup = new Map(); // app id -> fn to run when its window closes (e.g. release a browser session)
let previewTarget = null;
let browserTargetUrl = '';
let filesOpenPath = '/Desktop';

function openBrowserUrl(url, internal = false) {
  if (internal) {
    browserTargetUrl = url;
    openApp(GROUP_B.find((app) => app.id === 'browser'));
    window.dispatchEvent(new CustomEvent('lunix-browser-navigate', { detail: url }));
    return;
  }
  document.querySelector('[data-browser-choice]')?.remove();
  const overlay = document.createElement('div');
  overlay.dataset.browserChoice = '';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(36,35,31,.28);display:grid;place-items:center;padding:20px;';
  overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="browser-choice-title" style="width:min(380px,100%);background:#faf8f3;border:1px solid #e2dfd8;border-radius:14px;padding:20px;box-shadow:0 20px 60px rgba(36,35,31,.2);display:flex;flex-direction:column;gap:14px;">
    <div id="browser-choice-title" style="font-weight:600;color:#24231f;">打开网址</div>
    <div data-choice-url style="font-size:12px;color:#7d776e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button data-external style="border:1px solid #d8d4cb;background:#fff;color:#24231f;border-radius:9px;padding:9px 13px;font-size:13px;cursor:pointer;">外置浏览器</button>
      <button data-internal style="border:none;background:#17796d;color:#fff;border-radius:9px;padding:9px 13px;font-size:13px;font-weight:600;cursor:pointer;">内置浏览器</button>
    </div>
  </div>`;
  overlay.querySelector('[data-choice-url]').textContent = url;
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  overlay.onkeydown = (e) => { if (e.key === 'Escape') close(); };
  overlay.querySelector('[data-external]').onclick = () => { window.open(url, '_blank', 'noopener,noreferrer'); close(); };
  overlay.querySelector('[data-internal]').onclick = () => {
    browserTargetUrl = url;
    openApp(GROUP_B.find((app) => app.id === 'browser'));
    window.dispatchEvent(new CustomEvent('lunix-browser-navigate', { detail: url }));
    close();
  };
  document.body.appendChild(overlay);
  overlay.querySelector('[data-internal]').focus();
}

document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[href]');
  if (!link || !/^https?:\/\//i.test(link.href)) return;
  e.preventDefault(); openBrowserUrl(link.href);
});

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
  if (windows.has(app.id)) { focusWin(windows.get(app.id)); return windows.get(app.id); }
  const idx = windows.size;
  const w = document.createElement('section');
  w.className = 'lunix-desktop-window active';
  w.dataset.app = app.id;
  w.setAttribute('aria-label', app.label);
  const width = app.id === 'browser' ? 1040 : app.id === 'preview' ? 900 : app.id === 'files' ? 840 : app.id === 'terminal' ? 900 : app.id === 'memo' ? 760 : app.id === 'agent' ? 760 : 620;
  const height = app.id === 'browser' ? 720 : app.id === 'preview' ? 650 : app.id === 'files' ? 560 : app.id === 'terminal' ? 600 : app.id === 'agent' ? 580 : 480;
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
  w.addEventListener('focusin', () => focusWin(w));
  w.querySelector('.close').onclick = (e) => { e.stopPropagation(); w.remove(); windows.delete(app.id); const fn = cleanup.get(app.id); if (fn) { cleanup.delete(app.id); try { fn(); } catch (_) {} } };
  makeDraggable(w, w.querySelector('.lunix-window-titlebar'));
  w.querySelectorAll('.lunix-window-resize-handle').forEach((h) => makeResizable(w, h));
  return w;
}

async function refreshDesktopFiles() {
  if (!desktopFilesEl || !workspaceClient?.workspace) return;
  desktopFilesEl.innerHTML = '<span class="lunix-desktop-files-status">Loading Desktop…</span>';
  try {
    const result = await workspaceClient.workspace.list('/Desktop');
    const entries = result.entries || [];
    desktopFilesEl.innerHTML = '';
    entries.forEach((entry) => {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'lunix-desktop-file';
      item.innerHTML = `<span>${entry.type === 'dir' ? I.folder : I.doc}</span><strong>${escapeHtml(entry.name)}</strong>`;
      item.ondblclick = () => {
        if (entry.type === 'dir') {
          filesOpenPath = entry.path || `/Desktop/${entry.name}`;
          const win = openApp(GROUP_B.find((app) => app.id === 'files'));
          renderFiles(win.querySelector('.lunix-window-content'));
        } else {
          previewTarget = { mountId: 'workspace', path: entry.path || `/Desktop/${entry.name}`, name: entry.name };
          const win = openApp(GROUP_B.find((app) => app.id === 'preview'));
          renderPreview(win.querySelector('.lunix-window-content'));
        }
      };
      desktopFilesEl.appendChild(item);
    });
    if (!entries.length) desktopFilesEl.innerHTML = '<span class="lunix-desktop-files-status">Workspace Desktop is empty · drop text files here</span>';
  } catch {
    desktopFilesEl.innerHTML = '<span class="lunix-desktop-files-status">Workspace Desktop unavailable</span>';
  }
}

if (desktopFilesEl) {
  desktopFilesEl.addEventListener('dragover', (event) => { event.preventDefault(); desktopFilesEl.classList.add('is-drop-target'); });
  desktopFilesEl.addEventListener('dragleave', () => desktopFilesEl.classList.remove('is-drop-target'));
  desktopFilesEl.addEventListener('drop', async (event) => {
    event.preventDefault(); desktopFilesEl.classList.remove('is-drop-target');
    const files = [...event.dataTransfer.files];
    for (const file of files) {
      if (file.size > 2_000_000 || !file.type.startsWith('text/') && !/\.(md|json|js|ts|tsx|jsx|css|html|csv|txt|yml|yaml)$/i.test(file.name)) continue;
      await workspaceClient.workspace.write(`/Desktop/${file.name.replaceAll('/', '-')}`, await file.text());
    }
    refreshDesktopFiles();
  });
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
  if (id === 'preview') return renderPreview(root);
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
  let mountId = MOUNTS[0].id, cwd = filesOpenPath, entries = [], activeFile = null, content = '', editing = false, dirty = false, status = '', error = '';
  const prov = () => MOUNTS.find((m) => m.id === mountId).provider();
  const parent = (p) => { const x = p.replace(/\/+$/, '').split('/'); x.pop(); return x.join('/') || '/'; };

  async function listDir(path) {
    error = ''; const p = prov();
    if (!p) { error = 'source unavailable'; entries = []; return; }
    try { const r = await p.list(path); entries = r.entries || []; cwd = r.path || path; }
    catch (e) { error = String(e.message || e); entries = []; }
  }
  async function openFile(path) { const r = await prov().read(path); content = r.content != null ? r.content : '(' + (r.error || 'unreadable') + ')'; editing = true; dirty = false; status = ''; paint(); }
  async function save() {
    if (!activeFile) return;
    status = 'Saving…'; paint();
    try { const r = await prov().write(activeFile, content); dirty = false; status = r.ok ? 'Saved ✓' : ('Error: ' + (r.error || '')); if (r.ok && activeFile.startsWith('/Desktop/')) refreshDesktopFiles(); }
    catch (e) { status = 'Error: ' + e.message; }
    paint();
    if (status === 'Saved ✓') setTimeout(() => { status = ''; paint(); }, 1400);
  }
  async function go(path) { activeFile = null; previewTarget = null; await listDir(path); paint(); }
  async function switchMount(id) { if (id === mountId) return; mountId = id; cwd = '/'; activeFile = null; previewTarget = null; content = ''; await listDir('/'); paint(); }

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
      row.onclick = () => { activeFile = f.path; content = ''; editing = false; dirty = false; previewTarget = { mountId, path: f.path, name: f.name }; paint(); const win = windows.get('preview'); if (win) renderPreview(win.querySelector('.lunix-window-content')); };
      row.ondblclick = () => openFile(f.path);
      list.appendChild(row);
    });
    const r2 = document.createElement('span'); r2.className = 'lunix-files-column-resizer';
    // right — editable preview + Save
    const prev = document.createElement('aside'); prev.className = 'lunix-files-preview';
    if (!activeFile) { prev.innerHTML = '<div class="lunix-finder-empty">Select a file.</div>'; }
    else if (!editing) { prev.innerHTML = '<div class="lunix-finder-empty">Press Space to preview.<br><small>Double-click to edit text.</small></div>'; }
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
  listDir(cwd).then(paint);
  root.appendChild(app);
}

function renderPreview(root) {
  root.style.background = '#171717';
  root.innerHTML = '';
  if (!previewTarget) { root.innerHTML = '<div class="lunix-finder-empty" style="height:100%;display:grid;place-items:center;color:#aaa;">Select a file in Files, then press Space.</div>'; return; }
  if (previewTarget.url) {
    root.style.background = '#fff';
    const frame = document.createElement('iframe');
    frame.src = previewTarget.url;
    frame.title = previewTarget.name || 'Web preview';
    frame.allow = 'clipboard-read; clipboard-write';
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#fff;';
    root.appendChild(frame);
    return;
  }
  const { mountId, path: filePath, name } = previewTarget;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const url = mountId === 'local' ? '/api/local/raw?path=' + encodeURIComponent(filePath) : null;
  const center = 'width:100%;height:100%;border:0;display:block;object-fit:contain;background:#171717;';
  const textExt = ['txt', 'csv', 'json', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml', 'yml', 'yaml', 'toml', 'ini', 'sh', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'sql', 'log'];
  if (!url) {
    if (ext === 'md' || textExt.includes(ext)) MOUNTS.find((m) => m.id === mountId).provider().read(filePath).then((r) => showText(root, r.content || '', ext === 'md'));
    else root.innerHTML = '<div class="lunix-finder-empty" style="height:100%;display:grid;place-items:center;color:#aaa;">This source needs a binary streaming endpoint to preview this file.</div>';
    return;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext)) root.innerHTML = `<img src="${url}" alt="${escapeHtml(name)}" style="${center}">`;
  else if (['mp4', 'webm', 'mov'].includes(ext)) root.innerHTML = `<video src="${url}" controls autoplay style="${center}"></video>`;
  else if (['mp3', 'wav', 'm4a'].includes(ext)) root.innerHTML = `<div style="height:100%;display:grid;place-items:center;"><audio src="${url}" controls autoplay></audio></div>`;
  else if (ext === 'md' || textExt.includes(ext)) fetch(url).then((r) => r.text()).then((text) => showText(root, text, ext === 'md'));
  else if (ext === 'pdf') root.innerHTML = `<iframe src="${url}" title="${escapeHtml(name)}" style="${center};background:white;"></iframe>`;
  else root.innerHTML = '<div class="lunix-finder-empty" style="height:100%;display:grid;place-items:center;color:#aaa;">No safe browser preview for this file type.</div>';
}

function openRuntimePreview(url, port) {
  const parsed = new URL(url, location.href);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Preview URL must use HTTP or HTTPS.');
  previewTarget = { url: parsed.href, name: port ? `Web preview on port ${port}` : 'Web preview' };
  const win = openApp(GROUP_B.find((app) => app.id === 'preview'));
  renderPreview(win.querySelector('.lunix-window-content'));
}

function showText(root, text, markdown) { root.innerHTML = markdown ? `<article class="lunix-preview-markdown">${markdownHtml(text)}</article>` : `<pre class="lunix-preview-text">${escapeHtml(text)}</pre>`; }

function markdownHtml(text) {
  const inline = (s) => escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return text.split(/\r?\n/).map((line) => {
    const h = line.match(/^(#{1,6})\s+(.+)/); if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    if (/^[-*]\s+/.test(line)) return `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    return line ? `<p>${inline(line)}</p>` : '';
  }).join('');
}

document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable || !previewTarget) return;
  e.preventDefault();
  if (windows.has('preview')) windows.get('preview').querySelector('.close').click();
  else openApp(GROUP_B.find((app) => app.id === 'preview'));
});

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
        <button data-new-session title="Start a fresh browser session" style="height:32px;padding:0 12px;border:1px solid #d8d4cb;border-radius:9px;background:#fff;color:#6f685e;font-size:12px;cursor:pointer;">New session</button>
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
  let hosted = null;

  async function connectHosted(connectUrl, width, height) {
    msg.textContent = 'Connecting to cloud browser…';
    const socketUrl = CFG.browserRelayUrl ? CFG.browserRelayUrl + '?url=' + encodeURIComponent(connectUrl) : connectUrl;
    const ws = new WebSocket(socketUrl); let requestId = 0; const pending = new Map();
    let pageSession = null, pageTarget = null, targets = [], viewport = { width, height };
    const send = (method, params, targetSession) => new Promise((resolve, reject) => {
      const id = ++requestId; pending.set(id, { resolve, reject });
      const message = { id, method, params: params || {} }; if (targetSession) message.sessionId = targetSession;
      ws.send(JSON.stringify(message));
    });
    const activate = async (targetId) => {
      if (!targetId || targetId === pageTarget) return;
      const attached = await send('Target.attachToTarget', { targetId, flatten: true });
      pageSession = attached.sessionId; pageTarget = targetId; targets = targets.filter((id) => id !== targetId).concat(targetId);
      await send('Page.enable', {}, pageSession);
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false }, pageSession);
      await send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 1 }, pageSession);
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) { const request = pending.get(message.id); pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); return; }
      if (message.method === 'Page.screencastFrame' && message.sessionId === pageSession) {
        frame.src = 'data:image/jpeg;base64,' + message.params.data;
        send('Page.screencastFrameAck', { sessionId: message.params.sessionId }, pageSession).catch(() => {});
      }
      if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') activate(message.params.targetInfo.targetId).catch(() => {});
      if (message.method === 'Target.targetDestroyed') {
        targets = targets.filter((id) => id !== message.params.targetId);
        if (message.params.targetId === pageTarget) { pageTarget = null; activate(targets.at(-1)).catch(() => {}); }
      }
    };
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Browser relay timed out')), 12000); ws.onopen = () => { clearTimeout(timer); resolve(); }; ws.onerror = () => { clearTimeout(timer); reject(new Error('Browser relay failed')); }; });
    msg.textContent = 'Attaching page…';
    const found = await send('Target.getTargets'); const page = (found.targetInfos || []).find((target) => target.type === 'page');
    await activate(page?.targetId); await send('Target.setDiscoverTargets', { discover: true });
    return {
      input: (params) => send(params.method, params.params, pageSession),
      navigate: (url) => send('Page.navigate', { url: /^[a-z]+:\/\//i.test(url) ? url : 'https://' + url }, pageSession),
      resize: async (nextWidth, nextHeight) => { viewport = { width: nextWidth, height: nextHeight }; await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false }, pageSession); await send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: nextWidth, maxHeight: nextHeight, everyNthFrame: 1 }, pageSession); },
      close: () => ws.close(),
    };
  }

  requestAnimationFrame(() => {
    const { width, height } = size();
    post('/api/browser/session', { width, height, url: browserTargetUrl }).then((r) => r.json()).then((s) => {
      if (s.error || !s.sessionId) { msg.textContent = s.error ? 'Browser unavailable: ' + s.error : 'Could not start a session.'; return; }
      sessionId = s.sessionId; urlIn.value = s.home || '';
      fit(s.width || width, s.height || height);
      if (s.connectUrl) {
        connectHosted(s.connectUrl, s.width || width, s.height || height).then((client) => { hosted = client; if (splash.isConnected) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); } }).catch((e) => { msg.textContent = 'Browser unavailable: ' + e.message; });
      } else {
        frame.addEventListener('load', () => { if (splash.isConnected) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); } }, { once: true });
        frame.src = '/api/browser/stream?sessionId=' + encodeURIComponent(sessionId);
      }
    }).catch((e) => { msg.textContent = 'Browser unavailable: ' + e.message; });
  });

  // ---- input forwarding (coords are 1:1 — the remote viewport equals the <img> size) ----
  const sendMouse = (type, e, extra) => { if (!sessionId) return; const params = { type, x: Math.round(e.offsetX), y: Math.round(e.offsetY), modifiers: mods(e), ...extra }; hosted ? hosted.input({ method: 'Input.dispatchMouseEvent', params }) : post('/api/browser/input', { sessionId, kind: 'mouse', ...params }); };
  let lastMove = 0;
  frame.addEventListener('mousemove', (e) => { const t = performance.now(); if (t - lastMove < 35) return; lastMove = t; sendMouse('mouseMoved', e, { button: 'none' }); });
  frame.addEventListener('mousedown', (e) => { e.preventDefault(); view.focus(); sendMouse('mousePressed', e, { button: BTN[e.button] || 'left', clickCount: 1 }); });
  frame.addEventListener('mouseup', (e) => { e.preventDefault(); sendMouse('mouseReleased', e, { button: BTN[e.button] || 'left', clickCount: 1 }); });
  frame.addEventListener('contextmenu', (e) => e.preventDefault());
  view.addEventListener('wheel', (e) => { e.preventDefault(); if (!sessionId) return; const params = { type: 'mouseWheel', x: Math.round(e.offsetX), y: Math.round(e.offsetY), deltaX: e.deltaX, deltaY: e.deltaY, modifiers: mods(e) }; hosted ? hosted.input({ method: 'Input.dispatchMouseEvent', params }) : post('/api/browser/input', { sessionId, kind: 'mouse', ...params }); }, { passive: false });
  const sendKey = (type, e) => { if (!sessionId) return; const params = { type, key: e.key, code: e.code, text: type === 'keyDown' && e.key.length === 1 ? e.key : '', unmodifiedText: type === 'keyDown' && e.key.length === 1 ? e.key : '', windowsVirtualKeyCode: e.keyCode, nativeVirtualKeyCode: e.keyCode, modifiers: mods(e) }; hosted ? hosted.input({ method: 'Input.dispatchKeyEvent', params }) : post('/api/browser/input', { sessionId, kind: 'key', type, key: e.key, code: e.code, text: params.text, vk: e.keyCode, modifiers: params.modifiers }); };
  view.addEventListener('keydown', (e) => { if (e.metaKey && e.key === 'v') return; e.preventDefault(); sendKey('keyDown', e); });
  view.addEventListener('keyup', (e) => { e.preventDefault(); sendKey('keyUp', e); });

  // ---- address bar + reload + resize ----
  const go = () => { const url = urlIn.value.trim(); if (url && sessionId) hosted ? hosted.navigate(url) : post('/api/browser/navigate', { sessionId, url }); view.focus(); };
  const navigate = (url) => { if (!url) return; urlIn.value = url; if (sessionId) hosted ? hosted.navigate(url) : post('/api/browser/navigate', { sessionId, url }); };
  const onNavigate = (e) => navigate(e.detail);
  window.addEventListener('lunix-browser-navigate', onNavigate);
  cleanup.set('browser', () => { window.removeEventListener('lunix-browser-navigate', onNavigate); hosted?.close(); });
  urlIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }); // stopPropagation: don't forward to the page
  root.querySelector('[data-go]').onclick = go;
  root.querySelector('[data-new-session]').onclick = async () => { if (sessionId) await post('/api/browser/release', { sessionId }); windows.get('browser')?.querySelector('.close').click(); browserTargetUrl = ''; openApp(GROUP_B.find((app) => app.id === 'browser')); };
  root.querySelector('[data-reload]').onclick = () => { if (sessionId) hosted ? hosted.navigate(urlIn.value || 'https://www.google.com') : post('/api/browser/navigate', { sessionId, url: urlIn.value || 'https://www.google.com' }); };
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!sessionId) return; const { width, height } = size(); fit(width, height); hosted ? hosted.resize(width, height) : post('/api/browser/resize', { sessionId, width, height }); }, 250); });
  ro.observe(view);
}

function renderTerminal(root) {
  // Embed the terminal UI; when an Agent session exists, its PTY is the matching Nodus workspace.
  root.style.position = 'relative';
  root.style.background = '#171a19';
  root.replaceChildren();
  if (!agentSession) {
    root.innerHTML = '<div style="height:100%;display:grid;place-items:center;text-align:center;color:#6f685e;padding:24px;"><div><strong style="display:block;color:#24231f;margin-bottom:8px;">Connect the Agent first</strong><span style="font-size:13px;">Terminal opens inside the Agent session’s workspace runtime.</span></div></div>';
    return;
  }
  const frame = document.createElement('iframe');
  const terminalUrl = new URL(TERMINAL_URL, location.href);
  terminalUrl.searchParams.set('sessionId', agentSession.session.id);
  terminalUrl.searchParams.set('nodusUrl', NODUS_URL);
  terminalUrl.searchParams.set('userId', NODUS_USER);
  frame.src = terminalUrl;
  frame.setAttribute('title', 'Terminal');
  frame.style.cssText = 'width:100%;height:100%;border:none;display:block;background:#171a19;opacity:0;transition:opacity .16s ease;';

  const splash = document.createElement('div');
  splash.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 44%,#232825 0,#171a19 48%,#131514 100%);color:#9ca49f;font-size:13px;';
  splash.innerHTML = `
    <div style="width:42px;height:42px;color:#78b5a8;filter:drop-shadow(0 8px 18px rgba(68,139,124,.2));">${I.terminal}</div>
    <div style="font-weight:550;letter-spacing:.025em;color:#d5dbd7;">Preparing workspace terminal</div>
    <div style="width:132px;height:2px;border-radius:3px;background:#303532;overflow:hidden;">
      <div style="width:38%;height:100%;background:#78b5a8;border-radius:3px;animation:lxLoad 1s ease-in-out infinite;"></div>
    </div>`;
  if (!document.getElementById('lx-load-kf')) {
    const st = document.createElement('style'); st.id = 'lx-load-kf';
    st.textContent = '@keyframes lxLoad{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}';
    document.head.appendChild(st);
  }
  const done = () => { frame.style.opacity = '1'; setTimeout(() => splash.remove(), 170); setTimeout(() => frame.contentWindow?.focus(), 180); };
  const onStatus = (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'lunix-terminal-status') return;
    if (event.data.status === 'ready') { window.removeEventListener('message', onStatus); done(); return; }
    if (event.data.status !== 'error') return;
    const detail = event.data.code === 4403 ? 'This site is not allowed to connect to the runtime.' : (event.data.message || 'Terminal runtime disconnected.');
    splash.innerHTML = `<div style="width:42px;height:42px;color:#d07c70;">${I.terminal}</div><div style="font-weight:600;color:#e5e8e6;">Terminal connection failed</div><div style="color:#aab0ac;font-size:12px;max-width:320px;text-align:center;">${escapeHtml(detail)}</div><button type="button" data-terminal-retry style="border:1px solid #414743;border-radius:8px;background:#252a27;color:#e5e8e6;padding:7px 13px;cursor:pointer;">Retry</button>`;
    splash.querySelector('[data-terminal-retry]').onclick = () => { window.removeEventListener('message', onStatus); renderTerminal(root); };
  };
  window.addEventListener('message', onStatus);
  cleanup.set('terminal', () => window.removeEventListener('message', onStatus));
  setTimeout(() => {
    if (!splash.isConnected || splash.querySelector('[data-terminal-retry]')) return;
    splash.querySelector('div:nth-child(2)').textContent = 'Still connecting to workspace runtime…';
  }, 12000);

  root.append(frame, splash);
}

// The agent runtime is the system's brain — first-class. One session is booted once and reused
// across opens (the other runtimes are resources it drives). Backed by the Nodus SDK.
const RUNTIME_COOKIE = 'lunix_runtime_session';
const PROVIDER_COOKIE = 'lunix_agent_provider';
const readCookie = (name) => { try { const raw = document.cookie.split('; ').find((part) => part.startsWith(name + '=')); return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null; } catch { return null; } };
const writeCookie = (name, value, maxAge = 2592000) => { document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; };
const runtimeCookie = (provider) => `${RUNTIME_COOKIE}_${provider}`;
const readRuntimeSession = (provider) => { try { const raw = readCookie(runtimeCookie(provider)) || (provider === 'claude' ? readCookie(RUNTIME_COOKIE) : null); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const saveRuntimeSession = (value) => writeCookie(runtimeCookie(value.provider || 'claude'), JSON.stringify(value));
const clearRuntimeSession = (provider) => writeCookie(runtimeCookie(provider), '', 0);
let selectedAgentProvider = readCookie(PROVIDER_COOKIE) === 'codex' ? 'codex' : 'claude';
let agentSession = readRuntimeSession(selectedAgentProvider);
const agentProviderName = () => selectedAgentProvider === 'codex' ? 'Codex' : 'Claude';
const AGENT_BROWSER_PROMPT = `\n\nLunix browser workflow:\n- For a web app preview, start the server on 5173, 3000, 4173, 8000, or 8080 and include its localhost URL in your response.\n- For a website the user should open in Lunix's built-in Browser, include exactly: LUNIX_BROWSER_OPEN https://example.com\n- Do not expose cookies or tokens, and do not claim a page works unless you checked it.`;

function renderAgent(root) {
  root.classList.remove('no-padding');
  root.style.background = '#fff';
  root.style.position = 'relative';
  let booting = true, sending = false, aborted = false;
  let assistantView = null, chatSocket = null, chatReadyTimer = null, taskTimer = null, taskStartedAt = 0, lastServerFrameAt = 0, lastProgressAt = 0, reconnectAttempts = 0, socketReady = false;
  const streamText = new Map(), openedPreviews = new Set();
  let refreshChanges = async () => {};

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #ece8df;font-size:12px;color:#6f685e;">
        <span style="width:18px;height:18px;color:#17796d;display:inline-flex;">${I.agent}</span>
        <strong style="color:#24231f;">Agent</strong><span style="opacity:.5;">runtime · the brain</span>
        <button data-new-chat type="button" title="New chat" style="margin-left:auto;border:1px solid #e2dfd8;background:#fff;border-radius:7px;padding:4px 9px;color:#6f685e;font:inherit;cursor:pointer;">＋ New chat</button>
        <span data-status style="color:#9e9a93;">starting…</span>
      </div>
      <div data-log style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px;"></div>
      <div style="padding:12px 14px;border-top:1px solid #ece8df;">
        <div style="border:1px solid #e2dfd8;border-radius:14px;background:#fff;display:flex;flex-direction:column;overflow:hidden;">
          <textarea data-input rows="1" placeholder="Describe a task, or type / for commands"
            style="border:none;outline:none;resize:none;background:transparent;padding:12px 14px 4px;font-size:14px;line-height:1.5;color:#24231f;max-height:170px;font-family:inherit;"></textarea>
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px 8px;">
            <button data-model style="display:inline-flex;align-items:center;gap:6px;border:1px solid #e2dfd8;background:#faf8f3;border-radius:8px;padding:4px 10px;font-size:12px;color:#6f685e;cursor:pointer;">
              <span style="width:6px;height:6px;border-radius:50%;background:#17796d;flex:none;"></span><span data-model-name>${agentProviderName()}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <span style="flex:1;"></span>
            <button data-send title="Send (↵)" style="width:32px;height:32px;border:none;background:#17796d;color:#fff;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  const log = root.querySelector('[data-log]'), input = root.querySelector('[data-input]');
  const statusEl = root.querySelector('[data-status]');

  const mountAssistant = () => {
    if (assistantView) return assistantView;
    log.replaceChildren();
    assistantView = window.LunixAssistant?.mount(log);
    if (!assistantView) throw new Error('Assistant renderer failed to load.');
    return assistantView;
  };
  const unmountAssistant = () => { assistantView?.destroy(); assistantView = null; };
  const lockComposer = (locked, allowStop = false) => {
    input.disabled = locked;
    root.querySelector('[data-model]').disabled = locked;
    root.querySelector('[data-new-chat]').disabled = locked;
    root.querySelector('[data-send]').disabled = locked && !allowStop;
    root.querySelector('[data-send]').style.opacity = locked && !allowStop ? '.45' : '1';
    input.parentElement.style.opacity = locked ? '.65' : '1';
    input.placeholder = locked ? (allowStop ? 'Agent is processing the current task…' : 'Please wait…') : 'Describe a task, or type / for commands';
  };
  const showLoading = (title, detail) => { mountAssistant().setLoading({ title, detail }); lockComposer(true); root.setAttribute('aria-busy', 'true'); };
  const hideLoading = () => { mountAssistant().setLoading(null); lockComposer(sending, sending); root.removeAttribute('aria-busy'); };
  const elapsedLabel = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const clearTaskState = () => { clearInterval(taskTimer); taskTimer = null; mountAssistant().setTask(null); };
  const stopTask = async () => {
    if (!sending || !agentSession) return;
    aborted = true; statusEl.textContent = 'stopping…'; clearTaskState(); mountAssistant().setBusy(false); showLoading('Stopping the agent', 'Saving the workspace and shutting down the runtime…');
    try { await nodusClient.sessions.pause(agentSession.session.id); clearRuntimeSession(selectedAgentProvider); agentSession = null; closeChat(); authCard('Task stopped. Connect again to start a fresh runtime.'); }
    catch (error) {
      aborted = false; statusEl.textContent = 'stop failed'; mountAssistant().setBusy(true); hideLoading();
      taskTimer = setInterval(updateTaskState, 1000);
      mountAssistant().setTask({ title: 'Could not stop the agent', detail: error.message || String(error), tone: 'warning', actions: true, elapsed: elapsedLabel(Date.now() - taskStartedAt), onReconnect: reconnectTask, onStop: stopTask });
    }
  };
  const reconnectTask = () => {
    if (!sending || !agentSession) return;
    reconnectAttempts += 1; statusEl.textContent = 'reconnecting…'; lastServerFrameAt = Date.now(); connectChat(); updateTaskState();
  };
  const updateTaskState = () => {
    if (!sending) return clearTaskState();
    const now = Date.now(), elapsed = now - taskStartedAt, connectionSilent = now - lastServerFrameAt, progressSilent = now - lastProgressAt;
    let title = 'Agent is working', detail = 'The current task is still running.', tone = 'working', actions = false;
    if (elapsed < 8000) detail = 'Understanding the request and preparing the workspace…';
    else if (elapsed < 30000) detail = 'Working in the runtime. Complex tasks can take a little while…';
    else detail = 'Still running. You can safely wait or stop the task.';
    if (progressSilent >= 30000) { title = 'No recent output'; detail = connectionSilent < 10000 ? 'The service is connected, but the agent has not produced new output for 30 seconds.' : 'No server update has arrived recently.'; tone = 'warning'; actions = true; }
    if (progressSilent >= 90000) { title = 'Agent may be stalled'; detail = connectionSilent < 10000 ? 'The service is online, but the runtime has produced no new output for 90 seconds.' : 'The connection and runtime may be unavailable.'; tone = 'warning'; actions = true; }
    mountAssistant().setTask({ title, detail, tone, actions, elapsed: elapsedLabel(elapsed), onReconnect: reconnectTask, onStop: stopTask });
  };
  const startTaskState = () => { taskStartedAt = lastServerFrameAt = lastProgressAt = Date.now(); reconnectAttempts = 0; clearInterval(taskTimer); taskTimer = setInterval(updateTaskState, 1000); updateTaskState(); };
  const statusMessage = (title, detail, tone = 'info') => ({
    id: `status-${Date.now()}-${Math.random()}`, role: 'system',
    parts: [{ type: 'data-status', data: { title, detail, tone } }],
  });
  async function openAssistantLinks(text, key = text) {
    if (!text || openedPreviews.has(key)) return;
    openedPreviews.add(key);
    const browserMatch = text.match(/LUNIX_BROWSER_OPEN\s+(https?:\/\/\S+)/i);
    if (browserMatch) openBrowserUrl(browserMatch[1].replace(/[),.;]+$/, ''), true);
    const match = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1):([0-9]{2,5})/i);
    if (!match || !agentSession) return;
    try {
      const preview = await nodusClient.sessions.preview(agentSession.session.id, Number(match[1]));
      mountAssistant().add({ id: `preview-${key}`, role: 'system', parts: [{ type: 'data-status', data: { title: 'Preview ready', detail: `Port ${preview.port} is available.`, tone: 'success', actionLabel: 'Open preview', onAction: () => openRuntimePreview(preview.url, preview.port) } }] });
      openRuntimePreview(preview.url, preview.port);
    } catch (error) { mountAssistant().add(statusMessage('Preview unavailable', error.message || String(error), 'warning')); }
  }
  async function pushEvents(events, replace = false) {
    const items = events || [];
    const view = mountAssistant();
    if (replace) view.setEvents(items);
    else window.LunixAssistant.eventsToUIMessages(items).forEach(view.add);
    for (const e of items) {
      const text = (e.payload || {}).text;
      if (e.eventType !== 'assistant_message' || !text) continue;
      await openAssistantLinks(text, e.id || e.uuid || e.sourceUuid || text);
    }
  }

  function closeChat() {
    socketReady = false;
    clearTimeout(chatReadyTimer); chatReadyTimer = null;
    if (chatSocket) { chatSocket.onclose = null; chatSocket.close(); chatSocket = null; }
  }
  function finishTurn() {
    sending = false; setRunning(false); mountAssistant().setBusy(false);
    clearTaskState();
    hideLoading();
    if (!aborted) statusEl.textContent = `${selectedAgentProvider} · live`;
    refreshDesktopFiles(); refreshChanges();
  }
  function connectChat() {
    closeChat();
    if (!agentSession) return;
    const sessionId = agentSession.session.id;
    chatSocket = nodusClient.sessions.chatSocket(sessionId);
    chatReadyTimer = setTimeout(() => {
      if (socketReady) return;
      statusEl.textContent = 'connection timed out';
      if (sending) mountAssistant().setTask({ title: 'Connection timed out', detail: 'Lunix cannot confirm the task state. Reconnect or stop the runtime.', tone: 'warning', actions: true, elapsed: elapsedLabel(Date.now() - taskStartedAt), onReconnect: reconnectTask, onStop: stopTask });
      else { mountAssistant().add(statusMessage('Connection timed out', 'The agent did not become ready. Try New chat again.', 'warning')); hideLoading(); }
    }, 15000);
    chatSocket.onopen = () => { chatSocket?.send(JSON.stringify({ type: 'ping' })); };
    chatSocket.onmessage = async (event) => {
      let frame; try { frame = JSON.parse(event.data); } catch { return; }
      lastServerFrameAt = Date.now();
      if (frame.type === 'ready') { clearTimeout(chatReadyTimer); chatReadyTimer = null; socketReady = true; statusEl.textContent = `${selectedAgentProvider} · live`; hideLoading(); return; }
      if (frame.type === 'status') { mountAssistant().setBusy(Boolean(frame.busy)); if (frame.busy) { lockComposer(true, true); if (frame.activity) mountAssistant().setTask({ title: 'Agent is working', detail: frame.activity, tone: 'working', actions: false, elapsed: elapsedLabel(Date.now() - taskStartedAt), onReconnect: reconnectTask, onStop: stopTask }); } else if (sending) finishTurn(); return; }
      if (frame.type === 'delta') {
        if (aborted || frame.preview) return;
        lastProgressAt = Date.now();
        const value = frame.text || `${streamText.get(frame.uuid) || ''}${frame.delta || ''}`;
        streamText.set(frame.uuid, value); mountAssistant().stream(frame.uuid, value, frame.preview); return;
      }
      if (frame.type === 'done') {
        lastProgressAt = Date.now();
        const value = frame.text || streamText.get(frame.uuid) || '';
        streamText.delete(frame.uuid);
        if (!aborted) { mountAssistant().finish(frame.uuid, value); await openAssistantLinks(value, frame.uuid); }
        return;
      }
      if (frame.type === 'turn_done') { finishTurn(); return; }
      if (frame.type === 'error') {
        mountAssistant().add(statusMessage('Agent error', frame.error || frame.message || 'The runtime reported an error.', 'warning'));
        finishTurn();
      }
    };
    chatSocket.onclose = () => {
      socketReady = false;
      if (sending && !aborted) {
        if (reconnectAttempts < 1) { reconnectAttempts += 1; statusEl.textContent = 'reconnecting…'; setTimeout(() => sending && connectChat(), 1000); }
        else { statusEl.textContent = 'connection lost'; mountAssistant().setTask({ title: 'Connection lost', detail: 'The task may still be running, but Lunix cannot receive updates.', tone: 'warning', actions: true, elapsed: elapsedLabel(Date.now() - taskStartedAt), onReconnect: reconnectTask, onStop: stopTask }); }
      }
      else { statusEl.textContent = 'disconnected'; mountAssistant().add(statusMessage('Agent disconnected', 'Start a new chat to reconnect.', 'warning')); hideLoading(); }
    };
  }
  async function newChat() {
    if (!agentSession || sending) return;
    const button = root.querySelector('[data-new-chat]');
    showLoading('Starting a new chat', 'Preparing a fresh workspace conversation…'); statusEl.textContent = 'starting new chat…'; closeChat();
    try {
      const started = await nodusClient.sessions.start(agentSession.agentId);
      agentSession = { agentId: agentSession.agentId, provider: selectedAgentProvider, session: started.session };
      saveRuntimeSession(agentSession); streamText.clear(); openedPreviews.clear(); mountAssistant().setMessages([]); connectChat(); await refreshChanges();
    } catch (error) {
      mountAssistant().add(statusMessage('Could not start a new chat', error.message || String(error), 'warning'));
      statusEl.textContent = 'reconnecting…'; showLoading('Reconnecting to your chat', 'The new chat failed, so the previous session is being restored…'); connectChat();
    }
  }
  root.querySelector('[data-new-chat]').onclick = newChat;

  function authCard(errMsg) {
    booting = false; statusEl.textContent = 'not connected';
    lockComposer(true);
    unmountAssistant(); closeChat();
    log.innerHTML = '';
    const card = document.createElement('div');
    card.style.cssText = 'margin:auto;max-width:340px;text-align:center;display:flex;flex-direction:column;gap:12px;';
    card.innerHTML = `
      <div style="width:34px;height:34px;color:#17796d;margin:0 auto;display:flex;">${I.agent}</div>
      <div style="font-weight:600;color:#24231f;">Connect ${agentProviderName()}</div>
      <div style="font-size:12px;color:#9e9a93;line-height:1.5;">${selectedAgentProvider === 'codex' ? 'Sign in with your ChatGPT subscription using a device code.' : 'Sign in with your Claude subscription using the built-in or external browser.'} No API key is stored in lunix.</div>
      <button data-connect style="border:none;background:#17796d;color:#fff;border-radius:9px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">Sign in with ${agentProviderName()}</button>
      <div data-err style="color:#b65347;font-size:12px;min-height:14px;">${errMsg ? escapeHtml(errMsg) : ''}</div>`;
    log.appendChild(card);
    const err = card.querySelector('[data-err]');
    const connect = async () => {
      const button = card.querySelector('[data-connect]'); button.disabled = true; button.textContent = 'Starting secure login…'; err.textContent = '';
      try {
        const created = await nodusClient.agents.create({ provider: selectedAgentProvider });
        const started = await nodusClient.agents.startAuth(created.agent.id, { authMethod: 'subscription' });
        if (selectedAgentProvider === 'codex') showDeviceLogin(created.agent.id, started.authSession);
        else showAuthCode(created.agent.id, started.authSession);
      } catch (e) { button.disabled = false; button.textContent = `Sign in with ${agentProviderName()}`; err.textContent = e.message || e; }
    };
    card.querySelector('[data-connect]').onclick = connect;
  }

  function showDeviceLogin(agentId, authSession) {
    lockComposer(true);
    unmountAssistant(); closeChat();
    statusEl.textContent = 'waiting for device login'; log.innerHTML = '';
    const card = document.createElement('div'); card.style.cssText = 'margin:auto;max-width:360px;text-align:center;display:flex;flex-direction:column;gap:12px;';
    card.innerHTML = `<div style="font-weight:600;color:#24231f;">Sign in to Codex</div><div style="font-size:12px;color:#9e9a93;line-height:1.5;">Open the login page and enter this device code.</div><div style="border:1px solid #d7d2c8;background:#faf8f3;border-radius:9px;padding:12px;font:600 20px ui-monospace,monospace;letter-spacing:.08em;color:#24231f;">${escapeHtml(authSession.deviceCode || 'Open login')}</div><button data-copy style="border:1px solid #d7d2c8;background:#fff;color:#24231f;border-radius:9px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">Copy device code</button><button data-open style="border:none;background:#17796d;color:#fff;border-radius:9px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">Open ChatGPT login</button><button data-confirm style="border:1px solid #17796d;background:#fff;color:#17796d;border-radius:9px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">I’ve completed login</button><div data-status style="font-size:12px;color:#9e9a93;min-height:18px;">Complete login, then confirm here.</div><div data-err style="color:#b65347;font-size:12px;min-height:14px;"></div>`;
    log.appendChild(card);
    const state = card.querySelector('[data-status]'), err = card.querySelector('[data-err]'), confirm = card.querySelector('[data-confirm]');
    card.querySelector('[data-copy]').onclick = async (event) => { await navigator.clipboard?.writeText(authSession.deviceCode || ''); event.currentTarget.textContent = 'Copied'; };
    const open = () => openBrowserUrl(authSession.authUrl); card.querySelector('[data-open]').onclick = open; open();
    confirm.onclick = async () => {
      confirm.disabled = true; confirm.textContent = 'Checking login…'; state.textContent = 'Verifying approval…'; err.textContent = '';
      const deadline = Date.now() + 15 * 60 * 1000;
      try {
        while (Date.now() < deadline) {
          const result = await nodusClient.agents.completeAuth(agentId, authSession.id, {});
          if (result.status === 'healthy') {
            state.textContent = 'Starting Agent…';
            const session = await nodusClient.sessions.start(agentId);
            agentSession = { agentId, provider: 'codex', session: session.session }; saveRuntimeSession(agentSession);
            booting = false; statusEl.textContent = 'starting agent…'; mountAssistant().setMessages([]); showLoading('Starting Codex', 'Connecting the new session…'); connectChat(); return;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error('Device login timed out. Please start again.');
      } catch (e) { authCard(e.message || String(e)); }
    };
  }

  function showAuthCode(agentId, authSession) {
    lockComposer(true);
    unmountAssistant(); closeChat();
    statusEl.textContent = 'waiting for login'; log.innerHTML = '';
    const card = document.createElement('div'); card.style.cssText = 'margin:auto;max-width:360px;text-align:center;display:flex;flex-direction:column;gap:12px;';
    card.innerHTML = `<div style="font-weight:600;color:#24231f;">Finish signing in</div><div style="font-size:12px;color:#9e9a93;line-height:1.5;">Choose the built-in or external browser for Claude’s real login page. After login, paste the authorization code here.</div><button data-open style="border:1px solid #e2dfd8;background:#fff;border-radius:9px;padding:8px;font-size:13px;cursor:pointer;">Open login</button><input data-code placeholder="Paste authorization code" autocomplete="off" style="border:1px solid #e2dfd8;border-radius:9px;padding:9px 12px;font-size:13px;outline:none;"><button data-finish style="border:none;background:#17796d;color:#fff;border-radius:9px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">Finish login</button><div data-err style="color:#b65347;font-size:12px;min-height:14px;"></div>`;
    log.appendChild(card);
    const code = card.querySelector('[data-code]'), finish = card.querySelector('[data-finish]'), err = card.querySelector('[data-err]');
    const open = () => openBrowserUrl(authSession.authUrl); card.querySelector('[data-open]').onclick = open; open();
    const complete = async () => {
      if (!code.value.trim()) { err.textContent = 'Paste the authorization code.'; return; }
      finish.disabled = true; finish.textContent = 'Verifying login…'; err.textContent = '';
      const startedAt = Date.now();
      const timer = setInterval(() => { finish.textContent = `Verifying login… ${Math.floor((Date.now() - startedAt) / 1000)}s`; }, 1000);
      try {
        let result = await nodusClient.agents.completeAuth(agentId, authSession.id, { providerCode: code.value.trim() });
        const deadline = Date.now() + 4 * 60 * 1000;
        while (result.status === 'completing' && Date.now() < deadline) result = await nodusClient.agents.completeAuth(agentId, authSession.id, { providerCode: code.value.trim() });
        if (result.status !== 'healthy') throw new Error('Login timed out. Please start again.');
        clearInterval(timer); finish.textContent = 'Starting Agent…';
        const session = await nodusClient.sessions.start(agentId); agentSession = { agentId, provider: 'claude', session: session.session }; saveRuntimeSession(agentSession); booting = false; statusEl.textContent = 'starting agent…'; mountAssistant().setMessages([]); showLoading('Starting Claude', 'Connecting the new session…'); connectChat();
      } catch (e) { clearInterval(timer); finish.disabled = false; finish.textContent = 'Finish login'; err.textContent = e.message || e; }
    };
    finish.onclick = complete; code.addEventListener('keydown', (e) => { if (e.key === 'Enter') complete(); }); code.focus();
  }

  async function boot() {
    showLoading('Loading your conversation', 'Restoring messages and reconnecting to the agent…');
    if (!nodusClient) { statusEl.textContent = 'runtime offline'; booting = false; mountAssistant().setMessages([statusMessage('Runtime offline', 'Agent runtime not reachable on :8787. Start it with npm run dev.', 'warning')]); hideLoading(); return; }
    if (!agentSession) return authCard();
    statusEl.textContent = 'restoring…';
    try {
      const restored = await nodusClient.sessions.events(agentSession.session.id);
      await pushEvents(restored.events, true);
      await nodusClient.sessions.sync(agentSession.session.id, []);
      selectedAgentProvider = agentSession.provider || selectedAgentProvider; modelName.textContent = agentProviderName(); booting = false; statusEl.textContent = `${selectedAgentProvider} · live`; connectChat(); await refreshChanges();
    } catch (error) {
      try {
        statusEl.textContent = 'restarting runtime…';
        showLoading('Restarting the agent', 'The saved runtime expired. Starting a replacement…');
        const restarted = await nodusClient.sessions.start(agentSession.agentId);
        agentSession = { agentId: agentSession.agentId, session: restarted.session };
        agentSession.provider = selectedAgentProvider; saveRuntimeSession(agentSession); booting = false; statusEl.textContent = `${selectedAgentProvider} · live`; mountAssistant().setMessages([]); connectChat();
      } catch (restartError) {
        clearRuntimeSession(selectedAgentProvider); agentSession = null; authCard('Saved runtime expired. Connect again.');
      }
    }
  }
  async function send() {
    const text = input.value.trim();
    if (!text || sending || !agentSession) return;
    input.value = ''; autoGrow(); mountAssistant().addUser(`user-${Date.now()}`, text); sending = true; aborted = false; setRunning(true); lockComposer(true, true); mountAssistant().setBusy(true); startTaskState(); statusEl.textContent = 'thinking…';
    try {
      if (!socketReady || chatSocket?.readyState !== WebSocket.OPEN) throw new Error('Agent connection is not ready.');
      chatSocket.send(JSON.stringify({ type: 'send', text: text + AGENT_BROWSER_PROMPT }));
    } catch (e) {
      if (!aborted) { if (/not found|not live|unavailable|ended/i.test(e.message || e)) { clearRuntimeSession(selectedAgentProvider); agentSession = null; } mountAssistant().add(statusMessage('Agent error', e.message || String(e), 'warning')); }
      finishTurn();
    }
  }
  const autoGrow = () => { input.style.height = 'auto'; input.style.height = Math.min(170, input.scrollHeight) + 'px'; };
  input.addEventListener('input', autoGrow);
  // Enter sends; Shift+Enter inserts a newline (task-composer behavior).
  // running / Stop state — the send button becomes Stop while a turn is in flight
  const sendBtn = root.querySelector('[data-send]');
  const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const STOP = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
  const setRunning = (on) => { sendBtn.innerHTML = on ? STOP : ARROW; sendBtn.title = on ? 'Stop' : 'Send (↵)'; sendBtn.style.background = on ? '#b65347' : '#17796d'; };
  sendBtn.onclick = () => { if (sending) stopTask(); else send(); };

  // model selector dropdown
  const modelBtn = root.querySelector('[data-model]'), modelName = root.querySelector('[data-model-name]');
  let modelMenu = null;
  const closeModel = () => { if (modelMenu) { modelMenu.remove(); modelMenu = null; } };
  modelBtn.onclick = (e) => {
    e.stopPropagation(); if (modelMenu) return closeModel();
    modelMenu = document.createElement('div');
    modelMenu.style.cssText = 'position:absolute;z-index:30;background:#fff;border:1px solid #e2dfd8;border-radius:10px;box-shadow:0 10px 30px -12px rgba(43,42,40,.3);padding:4px;min-width:160px;';
    [{ id: 'claude', name: 'Claude' }, { id: 'codex', name: 'Codex' }].forEach((provider) => {
      const m = provider.name;
      const it = document.createElement('button'); it.textContent = m;
      it.style.cssText = `display:block;width:100%;text-align:left;border:none;background:${modelName.textContent === m ? '#eef5f2' : 'transparent'};border-radius:7px;padding:7px 10px;font-size:13px;color:#3b3832;cursor:pointer;`;
      it.onclick = () => {
        selectedAgentProvider = provider.id; writeCookie(PROVIDER_COOKIE, provider.id); agentSession = readRuntimeSession(provider.id);
        modelName.textContent = m; closeModel(); mountAssistant().setMessages([]); booting = true; boot();
      };
      modelMenu.appendChild(it);
    });
    root.appendChild(modelMenu);
    const r = modelBtn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    modelMenu.style.left = (r.left - rr.left) + 'px';
    modelMenu.style.top = (r.top - rr.top - modelMenu.offsetHeight - 6) + 'px';
  };
  document.addEventListener('click', closeModel);

  // slash-command palette — type "/" for commands
  const SLASH = [
    { cmd: '/clear', desc: 'Clear the conversation', run: () => mountAssistant().setMessages([]) },
    { cmd: '/explain', desc: 'Explain this repository', fill: 'Explain this repository and how it is structured.' },
    { cmd: '/fix', desc: 'Fix a failing test', fill: 'Find a failing test and fix it.' },
    { cmd: '/tests', desc: 'Add tests', fill: 'Add tests for the most important module.' },
  ];
  let slashMenu = null, slashIdx = 0, slashItems = [];
  const closeSlash = () => { if (slashMenu) { slashMenu.remove(); slashMenu = null; slashItems = []; } };
  const pickSlash = (c) => { closeSlash(); if (c.run) { input.value = ''; autoGrow(); c.run(); } else { input.value = c.fill; autoGrow(); input.focus(); } };
  const updateSlash = () => {
    const v = input.value;
    if (!v.startsWith('/')) return closeSlash();
    slashItems = SLASH.filter((c) => c.cmd.slice(1).startsWith(v.slice(1).toLowerCase()));
    if (!slashItems.length) return closeSlash();
    slashIdx = Math.min(slashIdx, slashItems.length - 1);
    if (!slashMenu) { slashMenu = document.createElement('div'); slashMenu.style.cssText = 'position:absolute;z-index:30;left:14px;right:14px;background:#fff;border:1px solid #e2dfd8;border-radius:10px;box-shadow:0 10px 30px -12px rgba(43,42,40,.3);padding:4px;'; root.appendChild(slashMenu); }
    slashMenu.innerHTML = '';
    slashItems.forEach((c, i) => {
      const it = document.createElement('button');
      it.style.cssText = `display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:none;background:${i === slashIdx ? '#eef5f2' : 'transparent'};border-radius:7px;padding:7px 10px;font-size:13px;cursor:pointer;`;
      it.innerHTML = `<span style="color:#17796d;font-weight:600;font-family:ui-monospace,monospace;">${c.cmd}</span><span style="color:#9e9a93;">${c.desc}</span>`;
      it.onmousedown = (e) => { e.preventDefault(); pickSlash(c); };
      slashMenu.appendChild(it);
    });
    const rr = root.getBoundingClientRect(), cb = input.getBoundingClientRect();
    slashMenu.style.top = (cb.top - rr.top - slashMenu.offsetHeight - 8) + 'px';
  };
  input.addEventListener('input', updateSlash);
  input.addEventListener('keydown', (e) => {
    if (slashMenu && slashItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); slashIdx = (slashIdx + 1) % slashItems.length; updateSlash(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); slashIdx = (slashIdx - 1 + slashItems.length) % slashItems.length; updateSlash(); return; }
      if (e.key === 'Enter') { e.preventDefault(); pickSlash(slashItems[slashIdx]); return; }
      if (e.key === 'Escape') { closeSlash(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // Ona-style working view: chat on the left, workspace changes and runtime tools on the right.
  (function buildPanel() {
    const mainCol = root.firstElementChild;
    mainCol.style.flex = '1'; mainCol.style.minWidth = '0';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;height:100%;';
    root.appendChild(row); row.appendChild(mainCol);
    const panel = document.createElement('aside');
    panel.className = 'lunix-agent-workspace';
    panel.innerHTML = `
      <section class="lunix-agent-workspace-main">
        <div class="lunix-agent-workspace-tabs" data-tabs></div>
        <div class="lunix-agent-workspace-tools"><input data-change-search placeholder="Search files…"><button type="button">Uncommitted⌄</button></div>
        <div class="lunix-agent-workspace-body" data-pbody></div>
      </section>
      <section class="lunix-agent-runtime-tools">
        <div class="lunix-agent-runtime-tabs" data-runtime-tabs></div>
        <div class="lunix-agent-runtime-body" data-runtime-body></div>
      </section>`;
    row.appendChild(panel);
    const tabsBar = panel.querySelector('[data-tabs]'), pbody = panel.querySelector('[data-pbody]');
    const runtimeTabsBar = panel.querySelector('[data-runtime-tabs]'), runtimeBody = panel.querySelector('[data-runtime-body]');
    const search = panel.querySelector('[data-change-search]');
    let open = true, tab = 'changes', runtimeTab = 'ports', termFrame = null, changeData = { status: '', patch: '' }, selectedPath = '';
    const tabs = {};
    [['changes', 'Changes'], ['files', 'All Files'], ['comments', 'Comments']].forEach(([id, label]) => { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { tab = id; renderTab(); }; tabs[id] = button; tabsBar.appendChild(button); });
    const runtimeTabs = {};
    [['ports', 'Ports & Services'], ['tasks', 'Tasks'], ['terminal', 'Terminal']].forEach(([id, label]) => { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { runtimeTab = id; renderRuntime(); }; runtimeTabs[id] = button; runtimeTabsBar.appendChild(button); });
    const parseChanges = ({ status = '', patch = '' }) => {
      const statusByPath = new Map(status.split('\n').filter(Boolean).map((line) => [line.slice(3).replace(/^.* -> /, ''), line.slice(0, 2).trim() || 'M']));
      const files = [];
      for (const chunk of patch.split(/(?=^diff --git )/m).filter((part) => part.startsWith('diff --git '))) {
        const match = chunk.match(/^diff --git a\/(.+?) b\/(.+)$/m); if (!match) continue;
        const path = match[2]; let additions = 0, deletions = 0;
        chunk.split('\n').forEach((line) => { if (line.startsWith('+') && !line.startsWith('+++')) additions++; else if (line.startsWith('-') && !line.startsWith('---')) deletions++; });
        files.push({ path, status: statusByPath.get(path) || 'M', additions, deletions, patch: chunk });
      }
      for (const [path, statusCode] of statusByPath) if (!files.some((file) => file.path === path)) files.push({ path, status: statusCode, additions: 0, deletions: 0, patch: '' });
      return files;
    };
    function renderTab() {
      Object.entries(tabs).forEach(([id, button]) => button.classList.toggle('active', id === tab));
      panel.querySelector('.lunix-agent-workspace-tools').style.display = tab === 'changes' ? '' : 'none';
      if (tab === 'files') { pbody.innerHTML = '<div class="lunix-agent-workspace-empty"><span style="width:34px;height:34px;display:inline-flex;">'+I.folder+'</span><strong>Browse workspace files</strong><button type="button" data-open-files>Open Files</button></div>'; pbody.querySelector('[data-open-files]').onclick = () => openApp(GROUP_B.find((app) => app.id === 'files')); return; }
      if (tab === 'comments') { pbody.innerHTML = '<div class="lunix-agent-workspace-empty">No comments yet.</div>'; return; }
      const query = search.value.trim().toLowerCase();
      const files = parseChanges(changeData).filter((file) => !query || file.path.toLowerCase().includes(query));
      if (!files.length) { pbody.innerHTML = '<div style="height:100%;display:grid;place-items:center;color:#9e9a93;font-size:13px;text-align:center;padding:20px;">No workspace changes yet.</div>'; return; }
      if (!selectedPath || !files.some((file) => file.path === selectedPath)) selectedPath = files[0].path;
      const selected = files.find((file) => file.path === selectedPath);
      const view = document.createElement('div'); view.className = 'lunix-agent-changes-view';
      const list = document.createElement('div'); list.className = 'lunix-agent-change-list';
      files.forEach((file) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = file.path === selectedPath ? 'active' : '';
        button.innerHTML = `<span style="width:16px;height:16px;color:#7a746b;display:inline-flex;">${I.doc}</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(file.path)}</span><span style="color:#27815f;">+${file.additions}</span><span style="color:#b65347;">−${file.deletions}</span>`;
        button.onclick = () => { selectedPath = file.path; renderTab(); }; list.appendChild(button);
      });
      const code = document.createElement('pre'); code.className = 'lunix-agent-diff';
      code.textContent = selected.patch || `${selected.status} ${selected.path}`;
      view.append(list, code); pbody.replaceChildren(view);
    }
    function renderRuntime() {
      Object.entries(runtimeTabs).forEach(([id, button]) => button.classList.toggle('active', id === runtimeTab));
      if (runtimeTab === 'terminal') {
        if (!termFrame && agentSession) { const url = new URL(TERMINAL_URL, location.href); url.searchParams.set('sessionId', agentSession.session.id); url.searchParams.set('nodusUrl', NODUS_URL); url.searchParams.set('userId', NODUS_USER); termFrame = document.createElement('iframe'); termFrame.src = url; termFrame.title = 'Workspace Terminal'; }
        runtimeBody.replaceChildren(termFrame || Object.assign(document.createElement('div'), { className: 'lunix-agent-runtime-empty', textContent: 'Connect the Agent first.' })); return;
      }
      runtimeBody.innerHTML = runtimeTab === 'tasks' ? '<div class="lunix-agent-runtime-empty">No active tasks</div>' : '<div class="lunix-agent-ports"><div><strong>Ports</strong><button type="button">＋ Add port</button></div><p>No open ports</p></div>';
    }
    refreshChanges = async () => {
      if (!agentSession || !nodusClient?.sessions?.diff) return;
      try { changeData = await nodusClient.sessions.diff(agentSession.session.id); if (open && tab === 'changes') renderTab(); }
      catch (_) { changeData = { status: '', patch: '' }; if (open && tab === 'changes') renderTab(); }
    };
    const toggle = document.createElement('button');
    toggle.title = 'Changes'; toggle.style.cssText = 'border:none;background:transparent;color:#9e9a93;cursor:pointer;display:inline-flex;padding:3px;border-radius:6px;margin-left:8px;flex:none;';
    toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></svg>';
    toggle.onclick = () => { open = !open; panel.classList.toggle('closed', !open); toggle.style.color = open ? '#17796d' : '#9e9a93'; if (open) { renderTab(); renderRuntime(); refreshChanges(); } };
    mainCol.firstElementChild.appendChild(toggle); // drop the toggle into the header
    search.addEventListener('input', renderTab);
    renderTab(); renderRuntime(); refreshChanges();
  })();
  cleanup.set('agent', () => { clearTaskState(); closeChat(); unmountAssistant(); document.removeEventListener('click', closeModel); });
  mountAssistant(); boot();
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---- boot ----
buildDock();
const placeWindow = (win, left, top, width, height) => { win.style.left = `${innerWidth * left}px`; win.style.top = `${innerHeight * top}px`; win.style.width = `${innerWidth * width}px`; win.style.height = `${innerHeight * height}px`; };
const filesWindow = openApp(GROUP_B.find((app) => app.id === 'files'));
placeWindow(filesWindow, .29, .42, .42, .39);
const agentWindow = openApp(GROUP_C[0]);
placeWindow(agentWindow, .035, .07, .93, .82);
const previewWindow = openApp(GROUP_B.find((app) => app.id === 'preview'));
placeWindow(previewWindow, .55, .20, .43, .58);
focusWin(agentWindow);
refreshDesktopFiles();
window.addEventListener('focus', refreshDesktopFiles);
