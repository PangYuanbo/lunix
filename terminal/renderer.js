import { WTerm } from '@wterm/dom';
import '@wterm/dom/css';

const tabs = [];
const panes = new Map();
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
let activeTab;
let activePane;
let nextId = 0;

if (embedded) document.body.classList.add('embedded');
if (params.get('theme') === 'sand') document.body.classList.add('theme-sand');

const tabsEl = document.getElementById('tabs');
const host = document.getElementById('panes-host');
const status = document.getElementById('status');

function setStatus(text, state = '') {
  status.textContent = text;
  status.dataset.state = state;
}

function focusPane(pane) {
  if (!pane) return;
  activePane = pane;
  for (const item of panes.values()) item.el.classList.toggle('active', item === pane);
  pane.term?.focus();
}

async function createPane(tab) {
  const id = `p${++nextId}`;
  const el = document.createElement('div');
  el.className = 'terminal-pane';
  tab.el.appendChild(el);

  const pane = { id, el, tab, term: null, ready: false, painted: false, pending: [] };
  panes.set(id, pane);
  tab.panes.push(pane);

  const term = new WTerm(el, {
    autoResize: true,
    cursorBlink: true,
    onData: (data) => window.warp.write(id, data),
    onResize: (cols, rows) => window.warp.resize(id, cols, rows),
    onTitle: (title) => { if (title) tab.label.textContent = title; },
  });
  pane.term = term;

  try {
    await window.warp.spawn(id, 80, 24);
    await term.init();
    pane.ready = true;
    for (const data of pane.pending.splice(0)) writePane(pane, data);
    window.warp.resize(id, term.cols, term.rows);
    focusPane(pane);
    setStatus('connected', 'ready');
  } catch (error) {
    term.write(`\r\nUnable to start terminal: ${error?.message || error}\r\n`);
    setStatus('connection failed', 'error');
  }
  return pane;
}

function switchTab(tab) {
  activeTab = tab;
  for (const item of tabs) {
    item.el.hidden = item !== tab;
    item.button.classList.toggle('active', item === tab);
  }
  focusPane(tab.panes.at(-1));
}

function closeTab(tab) {
  for (const pane of tab.panes) {
    window.warp.kill(pane.id);
    pane.term?.destroy();
    panes.delete(pane.id);
  }
  tab.el.remove();
  tab.button.remove();
  tabs.splice(tabs.indexOf(tab), 1);
  if (!tabs.length) createTab();
  else if (activeTab === tab) switchTab(tabs.at(-1));
}

function createTab() {
  const tab = { panes: [] };
  tab.el = document.createElement('div');
  tab.el.className = 'tab-panes';
  host.appendChild(tab.el);

  tab.button = document.createElement('button');
  tab.button.className = 'tab';
  tab.label = document.createElement('span');
  tab.label.textContent = `Terminal ${tabs.length + 1}`;
  const close = document.createElement('span');
  close.className = 'tab-close';
  close.textContent = '×';
  close.addEventListener('click', (event) => { event.stopPropagation(); closeTab(tab); });
  tab.button.append(tab.label, close);
  tab.button.addEventListener('click', () => switchTab(tab));
  tabsEl.appendChild(tab.button);
  tabs.push(tab);
  switchTab(tab);
  createPane(tab);
  return tab;
}

function splitActive() {
  if (!activeTab) return;
  activeTab.el.classList.add('split');
  createPane(activeTab);
}

function writePane(pane, data) {
  if (!pane.ready) { pane.pending.push(data); return; }
  pane.term.write(data);
  if (pane.painted) return;
  pane.painted = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.parent.postMessage({ type: 'lunix-terminal-status', status: 'ready' }, location.origin);
  }));
}

window.warp.onData(({ id, data }) => { const pane = panes.get(id); if (pane) writePane(pane, data); });
window.warp.onExit(({ id, exitCode }) => {
  const pane = panes.get(id);
  pane?.term?.write(`\r\n[process exited${exitCode == null ? '' : ` ${exitCode}`}]\r\n`);
  setStatus('disconnected', 'error');
});

window.addEventListener('focus', () => activePane?.term?.focus());
window.addEventListener('beforeunload', () => {
  for (const pane of panes.values()) window.warp.kill(pane.id);
});
window.addEventListener('keydown', (event) => {
  if (!event.metaKey) return;
  if (event.key === 't') { event.preventDefault(); createTab(); }
  if (event.key === 'd') { event.preventDefault(); splitActive(); }
  if (event.key === 'w') { event.preventDefault(); closeTab(activeTab); }
});

document.getElementById('newtab').addEventListener('click', createTab);
document.getElementById('split').addEventListener('click', splitActive);
createTab();
