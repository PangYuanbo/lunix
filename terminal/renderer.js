/* Warp-electron renderer: tabs + split panes + blocks + local AI + completions + Drive. */
const THEMES = {
  // Exact values from Warp's open-source default "Dark" theme (app/src/themes/default_themes.rs):
  // bg #000000, fg #ffffff, accent #19AAD8, dark_mode ANSI palette.
  warpDark: { name: 'Warp Dark', xterm: { background: '#000000', foreground: '#ffffff', cursor: '#19AAD8',
      red: '#FF8272', green: '#B4FA72', yellow: '#FEFDC2', blue: '#A5D5FE', magenta: '#FF8FFD', cyan: '#D0D1FE', white: '#F1F1F1', brightBlack: '#8E8E8E' },
    css: { bg: '#000000', bg2: '#141414', accent: '#19AAD8', border: '#222222' } },
  warpLight: { name: 'Warp Light', xterm: { background: '#fafafa', foreground: '#2d2d2d', cursor: '#16a34a' },
    css: { bg: '#fafafa', bg2: '#eee', accent: '#16a34a', border: '#ddd' } },
  dracula: { name: 'Dracula', xterm: { background: '#282a36', foreground: '#f8f8f2', cursor: '#bd93f9' },
    css: { bg: '#282a36', bg2: '#21222c', accent: '#bd93f9', border: '#44475a' } },
  nord: { name: 'Nord', xterm: { background: '#2e3440', foreground: '#d8dee9', cursor: '#88c0d0' },
    css: { bg: '#2e3440', bg2: '#3b4252', accent: '#88c0d0', border: '#434c5e' } },
  gruvbox: { name: 'Gruvbox Dark', xterm: { background: '#282828', foreground: '#ebdbb2', cursor: '#fe8019' },
    css: { bg: '#282828', bg2: '#32302f', accent: '#fabd2f', border: '#3c3836' } },
  solarizedLight: { name: 'Solarized Light', xterm: { background: '#fdf6e3', foreground: '#586e75', cursor: '#268bd2' },
    css: { bg: '#fdf6e3', bg2: '#eee8d5', accent: '#268bd2', border: '#e3ddc7' } },
  // Warm light skin (cream surface, ink text, teal accent) — pairs with a light host UI. Loaded via ?theme=sand.
  sand: { name: 'Sand', xterm: { background: '#f7f5f0', foreground: '#2b2a26', cursor: '#17796d' },
    css: { bg: '#f7f5f0', bg2: '#efece4', accent: '#17796d', border: '#e2dfd8' } },
};

let store = { settings: { theme: 'warpDark', fontSize: 13 }, workflows: [] };
const history = []; // command history (autosuggest + completions source)
const BUILTINS = ['ls -la', 'cd ', 'git status', 'git log --oneline', 'git pull', 'git push', 'npm install', 'npm run', 'docker ps', 'df -h', 'top', 'grep -rn ', 'find . -name ', 'cat ', 'tail -f ', 'curl '];

let uid = 0;
const tabs = [];      // {id, name, paneIds:[], dir:'row'|'col', el(panes container), tabEl}
const panes = new Map(); // paneId -> {id, engine, blocks, current, inputBuf, el, tabId}
let activeTab = null, activePane = null;

const host = document.getElementById('panes-host');
const tabsBar = document.getElementById('tabs');

// ---------- Pane (a single terminal) ----------
function makePane(tab) {
  const id = 'p' + (++uid);
  const el = document.createElement('div');
  el.className = 'pane';
  tab.el.appendChild(el);

  const pane = { id, blocks: [], inputBuf: '', el, tabId: tab.id };
  panes.set(id, pane);
  tab.paneIds.push(id);

  // ---- Warp block-card UI, driven by the from-scratch engine (vte parser -> Grid<Cell>). ----
  // block_view renders each command as a DOM card (cwd + command head, hover toolbar, exit chip,
  // ANSI-colored output) with a dedicated bottom prompt editor — Warp's actual UI model.
  const fs = store.settings.fontSize;
  const io = {
    spawn: (cols, rows) => window.warp.spawn(id, cols, rows),
    write: (data) => window.warp.write(id, data),
    resize: (cols, rows) => window.warp.resize(id, cols, rows),
  };
  const view = window.warpBlockView.mountBlockPane(el, io, {
    cellW: Math.max(7, Math.round(fs * 0.6)), lineH: Math.max(16, Math.round(fs * 1.54)),
    bg: hexRgb(THEMES[store.settings.theme].css.bg, [20, 21, 26]),
    // Default cell foreground = theme.foreground() (#ffffff for Dark) — color.rs PrimaryColors.
    fg: hexRgb(THEMES[store.settings.theme].xterm.foreground, [255, 255, 255]),
    onInput: (k) => trackInput(pane, k),
    onCommand: (cmd) => { if (cmd) { history.unshift(cmd); if (history.length > 500) history.pop(); } if (pane === activePane) updateStatus(); },
    onCwd: (short) => { pane.cwd = short; if (pane === activePane) document.getElementById('cwd').textContent = short; },
    onBranch: (b) => { pane.branch = b; if (pane === activePane) { const el2 = document.getElementById('sb-branch'); el2.style.display = b ? '' : 'none'; document.getElementById('branch').textContent = b || ''; } },
    onAction: (b, act, text) => blockAction(pane, act, text),
    onOpenUrl: (u) => window.warp.openExternal(u),
    onOpenFile: (f) => window.warp.openPath(f),
  });
  pane.view = view; pane.engine = view;   // .engine alias: global fan-in / focus / fit / clear
  pane.blocks = view.blocks;
  el.addEventListener('mousedown', () => focusPane(pane));
  return pane;
}

// Hex "#rrggbb" -> [r,g,b] 0-255.
function hexRgb(h, fallback) {
  if (!h || h[0] !== '#') return fallback;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Block toolbar actions (block_view supplies the resolved {cmd, out} text).
function blockAction(pane, act, text) {
  if (act === 'copy-cmd') navigator.clipboard.writeText(text.cmd || '');
  else if (act === 'copy-out') navigator.clipboard.writeText(text.out || '');
  else if (act === 'rerun') window.warp.write(pane.id, (text.cmd || '') + '\r');
  else if (act === 'save') saveWorkflow(text.cmd || '');
}

// ---------- input tracking (autosuggest) ----------
// d is the encoded key bytes from keys.js (mirrors what block_view tracks). We keep a parallel
// buffer to compute history/builtin autosuggest and feed the ghost into the block-view prompt editor.
function trackInput(pane, d) {
  if (d === '\r' || d === '\n') { pane.inputBuf = ''; pane._suggest = ''; setSuggest(''); if (pane.view) pane.view.setSuggest(''); return; }
  if (d === '\x7f') { pane.inputBuf = pane.inputBuf.slice(0, -1); }
  else if (d === '\x03' || d === '\x1b') { pane.inputBuf = ''; }
  else if (d.length === 1 && d >= ' ') { pane.inputBuf += d; }
  const buf = pane.inputBuf;
  const hit = buf ? [...history, ...BUILTINS].find((h) => h.startsWith(buf) && h !== buf) : '';
  pane._suggest = hit || '';
  if (pane.view) pane.view.setSuggest(hit || '');
  if (pane === activePane) setSuggest(hit ? `⇢ ${hit}  (⌃→ to accept)` : '');
}
function setSuggest(s) { document.getElementById('suggest').textContent = s; }
function acceptSuggest() {
  if (activePane && activePane._suggest) {
    const rest = activePane._suggest.slice(activePane.inputBuf.length);
    window.warp.write(activePane.id, rest); activePane.inputBuf = activePane._suggest;
    activePane._suggest = ''; setSuggest(''); if (activePane.view) activePane.view.setSuggest('');
  }
}

// ---------- tabs ----------
function makeTab() {
  const id = 't' + (++uid);
  const panesEl = document.createElement('div');
  panesEl.className = 'tab-panes';
  host.appendChild(panesEl);
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML = `<span class="label">shell</span><span class="x">×</span>`;
  tabsBar.appendChild(tabEl);
  const tab = { id, name: 'shell', paneIds: [], dir: 'row', el: panesEl, tabEl };
  tabs.push(tab);
  tabEl.querySelector('.label').addEventListener('click', () => switchTab(tab));
  tabEl.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
  const pane = makePane(tab);
  switchTab(tab); focusPane(pane);
  return tab;
}
function switchTab(tab) {
  activeTab = tab;
  tabs.forEach((t) => { t.el.classList.toggle('hidden', t !== tab); t.tabEl.classList.toggle('active', t === tab); });
  const p = panes.get(tab.paneIds[0]); if (p) focusPane(p);
  refit(tab);
}
function closeTab(tab) {
  tab.paneIds.forEach((pid) => { window.warp.kill(pid); panes.delete(pid); });
  tab.el.remove(); tab.tabEl.remove();
  tabs.splice(tabs.indexOf(tab), 1);
  if (tabs.length === 0) return makeTab();
  if (activeTab === tab) switchTab(tabs[tabs.length - 1]);
}
function focusPane(pane) {
  activePane = pane;
  panes.forEach((p) => p.el.classList.toggle('active', p === pane));
  pane.engine.focus();
  updateStatus();
}
function splitActive() {
  if (!activeTab) return;
  activeTab.el.classList.toggle('col', activeTab.dir === 'row' ? false : true); // keep row by default
  const pane = makePane(activeTab);
  refit(activeTab); focusPane(pane);
}
function refit(tab) { tab.paneIds.forEach((pid) => { const p = panes.get(pid); if (p && p.engine) { try { p.engine.fit(); } catch (_) {} } }); }

function updateStatus() {
  if (!activePane) return;
  document.getElementById('blockcount').textContent = `${activePane.blocks.length} block${activePane.blocks.length === 1 ? '' : 's'}`;
}

// ---------- PTY data fan-in ----------
window.warp.onData(({ id, data }) => { const p = panes.get(id); if (p && p.engine) p.engine.write(data); });
window.warp.onExit(({ id }) => { const p = panes.get(id); if (p && p.engine) p.engine.write('\r\n[process exited]\r\n'); });

// ---------- Drive / workflows ----------
function persist() { window.warp.storeSet(store); }
function saveWorkflow(cmd) {
  const name = cmd.slice(0, 40);
  store.workflows.unshift({ name, command: cmd });
  persist();
  flash(`saved workflow: ${name}`);
}
function flash(msg) { setSuggest(msg); setTimeout(() => setSuggest(''), 1800); }

// ---------- AI panel ----------
const aiEl = document.getElementById('ai');
const aiInput = document.getElementById('ai-input');
const aiOut = document.getElementById('ai-out');
function openAI() { aiEl.classList.remove('hidden'); aiInput.value = ''; aiOut.textContent = ''; aiInput.focus(); }
function closeAI() { aiEl.classList.add('hidden'); if (activePane) activePane.engine.focus(); }
aiInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') return closeAI();
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); aiOut.textContent = '…thinking';
    const r = await window.warp.aiAsk(aiInput.value);
    aiOut.textContent = r.text; document.getElementById('ai-src').textContent = r.source;
  }
});
document.getElementById('ai-insert').addEventListener('click', () => { if (activePane) window.warp.write(activePane.id, aiOut.textContent); closeAI(); });
document.getElementById('ai-run').addEventListener('click', () => { if (activePane) window.warp.write(activePane.id, aiOut.textContent + '\r'); closeAI(); });
document.getElementById('ai-save').addEventListener('click', () => { if (aiOut.textContent) saveWorkflow(aiOut.textContent); });
document.getElementById('ai-close').addEventListener('click', closeAI);

// ---------- command palette ----------
function baseActions() {
  return [
    { name: 'New tab', hint: '⌘T', run: () => makeTab() },
    { name: 'Split pane', hint: '⌘D', run: () => splitActive() },
    { name: 'Engine: warpui_core GPU (xterm-free)', hint: 'vte → Grid → GPU', run: () => flash('terminal engine: Warp own VTE parser + Grid<Cell> + WebGL2 (no xterm.js)') },
    { name: 'Ask AI', hint: '⌘I', run: () => openAI() },
    { name: 'Clear terminal', hint: '⌘L', run: () => activePane && activePane.engine.clear() },
    { name: 'Theme: Warp Dark', run: () => applyTheme('warpDark') },
    { name: 'Theme: Warp Light', run: () => applyTheme('warpLight') },
    { name: 'Theme: Dracula', run: () => applyTheme('dracula') },
    { name: 'Theme: Nord', run: () => applyTheme('nord') },
    { name: 'Theme: Gruvbox Dark', run: () => applyTheme('gruvbox') },
    { name: 'Theme: Solarized Light', run: () => applyTheme('solarizedLight') },
    { name: 'Theme: Sand', run: () => applyTheme('sand') },
    { name: 'Increase font size', hint: '⌘+', run: () => setFont(store.settings.fontSize + 1) },
    { name: 'Decrease font size', hint: '⌘-', run: () => setFont(store.settings.fontSize - 1) },
    { name: 'New worktree branch name', hint: 'warp_util', run: () => {
      const name = window.crates.worktreeBranchName(store.workflows.map((w) => w.name));
      if (activePane) window.warp.write(activePane.id, `git worktree add ../${name} -b ${name}`); } },
    { name: 'Reveal Drive folder (~/.warp-electron)', run: () => window.warp.write(activePane.id, 'open ~/.warp-electron\r') },
  ];
}
function paletteItems(q) {
  const wf = store.workflows.map((w) => ({ name: '⚡ ' + w.name, hint: 'workflow', run: () => activePane && window.warp.write(activePane.id, w.command + '\r') }));
  const hist = history.slice(0, 30).map((h) => ({ name: h, hint: 'history', run: () => activePane && window.warp.write(activePane.id, h + '\r') }));
  const all = [...baseActions(), ...wf, ...hist];
  if (!q) return all;
  // Rank with the ported fuzzy_match crate: wildcard glob if the query has * or ?, else fuzzy.
  const f = window.crates && window.crates.fuzzy;
  const wild = f && f.containsWildcards(q);
  const scored = [];
  for (const a of all) {
    const r = f ? (wild ? f.matchWildcard(a.name, q) : f.matchIndices(a.name, q))
                : (a.name.toLowerCase().includes(q.toLowerCase()) ? { score: 0 } : null);
    if (r) scored.push({ a, score: r.score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.map((s) => s.a);
}
const palette = document.getElementById('palette');
const pInput = document.getElementById('palette-input');
const pList = document.getElementById('palette-list');
let pActive = 0, pFiltered = [];
function openPalette() { palette.classList.remove('hidden'); pInput.value = ''; renderPalette(''); pInput.focus(); }
function closePalette() { palette.classList.add('hidden'); if (activePane) activePane.engine.focus(); }
function renderPalette(q) {
  pFiltered = paletteItems(q); pActive = 0;
  pList.innerHTML = pFiltered.map((a, i) => `<li data-i="${i}" class="${i === 0 ? 'active' : ''}"><span>${a.name}</span><span class="hint">${a.hint || ''}</span></li>`).join('');
  pList.querySelectorAll('li').forEach((li) => li.addEventListener('click', () => { pFiltered[+li.dataset.i].run(); closePalette(); }));
}
pInput.addEventListener('input', (e) => renderPalette(e.target.value));
pInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closePalette();
  if (e.key === 'ArrowDown') pActive = Math.min(pFiltered.length - 1, pActive + 1);
  else if (e.key === 'ArrowUp') pActive = Math.max(0, pActive - 1);
  else if (e.key === 'Enter') { if (pFiltered[pActive]) pFiltered[pActive].run(); return closePalette(); }
  else return;
  pList.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === pActive));
  const act = pList.querySelector('li.active'); if (act) act.scrollIntoView({ block: 'nearest' });
});

// ---------- settings ----------
function applyTheme(key, save = true) {
  if (!THEMES[key]) key = 'warpDark';
  store.settings.theme = key; if (save) persist(); // save=false for ?theme= so it doesn't clobber the user's saved pref
  const t = THEMES[key], r = document.documentElement.style;
  r.setProperty('--bg', t.css.bg); r.setProperty('--bg-2', t.css.bg2);
  r.setProperty('--accent', t.css.accent); r.setProperty('--border', t.css.border);
  r.setProperty('--term-bg', t.css.bg);
  if (t.xterm && t.xterm.foreground) r.setProperty('--fg', t.xterm.foreground); // keep text legible across themes
}
function setFont(n) { store.settings.fontSize = Math.max(8, Math.min(28, n)); persist();
  // The engine's cell metrics are fixed per pane; new panes pick up the new size. Re-fit current panes.
  panes.forEach((p) => { if (p.engine) try { p.engine.fit(); } catch (_) {} }); }
// ---------- global shortcuts + boot ----------
document.getElementById('newtab').addEventListener('click', () => makeTab());
document.getElementById('split-btn').addEventListener('click', () => splitActive());
document.getElementById('ai-btn').addEventListener('click', openAI);
document.getElementById('palette-btn').addEventListener('click', openPalette);
window.addEventListener('resize', () => activeTab && refit(activeTab));
window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'k') { e.preventDefault(); openPalette(); }
  else if (mod && e.key === 'i') { e.preventDefault(); openAI(); }
  else if (mod && e.key === 't') { e.preventDefault(); makeTab(); }
  else if (mod && e.key === 'd') { e.preventDefault(); splitActive(); }
  else if (mod && e.key === 'l') { e.preventDefault(); activePane && activePane.engine.clear(); }
  else if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); acceptSuggest(); }
});

(async () => {
  try { store = await window.warp.storeGet() || store; } catch (_) {}
  // ?theme=<key> (e.g. a host embedding the terminal can request ?theme=sand) overrides the saved theme for this session only.
  const params = new URLSearchParams(location.search);
  const urlTheme = params.get('theme');
  if (urlTheme && THEMES[urlTheme]) applyTheme(urlTheme, false);
  else applyTheme(store.settings.theme || 'warpDark');
  // ?embed=1: host provides the window chrome — hide Warp's own title/status bars.
  if (params.get('embed') === '1') document.documentElement.classList.add('embed');
  makeTab();
})();

// test/debug hook
window.__warp = {
  get activePane() { return activePane; }, get tabs() { return tabs; }, get panes() { return panes; },
  get history() { return history; }, get store() { return store; },
  makeTab, splitActive, openPalette, openAI, applyTheme,
  write: (s) => activePane && window.warp.write(activePane.id, s),
};
