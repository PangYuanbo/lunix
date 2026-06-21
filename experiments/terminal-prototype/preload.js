const { contextBridge, ipcRenderer } = require('electron');
const fuzzy = require('./src/crates/fuzzy_match');
const warpUtil = require('./src/crates/warp_util');
const inputClassifier = require('./src/crates/input_classifier');

// Expose ported Warp crates to the sandboxed renderer.
contextBridge.exposeInMainWorld('crates', {
  fuzzy: {
    matchIndices: (text, query) => fuzzy.match_indices(text, query),
    containsWildcards: (q) => fuzzy.contains_wildcards(q),
    matchWildcard: (text, pat) => fuzzy.match_wildcard_pattern_case_insensitive(text, pat),
  },
  worktreeBranchName: (existing) => warpUtil.generateWorktreeBranchName(new Set(existing || [])),
  isLikelyShellCommand: (snapshot, wordCount) => inputClassifier.is_likely_shell_command(snapshot, wordCount),
});

contextBridge.exposeInMainWorld('warp', {
  spawn: (id, cols, rows) => ipcRenderer.invoke('pty:spawn', { id, cols, rows }),
  write: (id, data) => ipcRenderer.send('pty:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  kill: (id) => ipcRenderer.send('pty:kill', { id }),
  onData: (cb) => ipcRenderer.on('pty:data', (e, m) => cb(m)),
  onExit: (cb) => ipcRenderer.on('pty:exit', (e, m) => cb(m)),
  // store + AI + drive
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openPath: (p) => ipcRenderer.send('open-path', p),
  storeGet: () => ipcRenderer.invoke('store:get'),
  storeSet: (s) => ipcRenderer.invoke('store:set', s),
  aiAsk: (prompt) => ipcRenderer.invoke('ai:ask', prompt),
});
