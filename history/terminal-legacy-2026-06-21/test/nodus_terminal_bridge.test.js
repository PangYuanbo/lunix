const assert = require('assert');
const fs = require('fs');
const bridge = fs.readFileSync(require.resolve('../web/bridge.js'), 'utf8');
const desktop = fs.readFileSync(require.resolve('../../desktop/app.js'), 'utf8');
const build = fs.readFileSync(require.resolve('../../scripts/build-web.mjs'), 'utf8');

assert.match(desktop, /searchParams\.set\('sessionId', agentSession\.session\.id\)/);
assert.match(desktop, /Connect the Agent first/);
assert.match(bridge, /new WebSocket\(nodusSocket\(\), \['tty'\]\)/);
assert.match(bridge, /searchParams\.set\('target', 'workspace'\)/);
assert.match(bridge, /sendNodus\(id, '0' \+ data\)/);
assert.match(bridge, /columns: cols, rows/);
assert.match(bridge, /socketQueues/);
assert.match(bridge, /lunix-terminal-status/);
assert.match(desktop, /data-terminal-retry/);
assert.match(fs.readFileSync(require.resolve('../renderer.js'), 'utf8'), /pointerdown.*focusPane\(pane\)/);
assert.match(fs.readFileSync(require.resolve('../renderer.js'), 'utf8'), /window\.addEventListener\('focus'.*engine\.focus/);
assert.match(build, /<base href="\/terminal\/">/);
console.log('Nodus workspace terminal bridge ok');
