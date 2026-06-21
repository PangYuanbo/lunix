const assert = require('assert');
const fs = require('fs');
const bridge = fs.readFileSync(require.resolve('../web/bridge.js'), 'utf8');
const desktop = fs.readFileSync(require.resolve('../../desktop/app.js'), 'utf8');

assert.match(desktop, /searchParams\.set\('sessionId', agentSession\.session\.id\)/);
assert.match(desktop, /Connect the Agent first/);
assert.match(bridge, /new WebSocket\(nodusSocket\(\), \['tty'\]\)/);
assert.match(bridge, /send\('0' \+ data\)/);
assert.match(bridge, /columns: cols, rows/);
console.log('Nodus workspace terminal bridge ok');
