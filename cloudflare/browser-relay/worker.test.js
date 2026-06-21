const assert = require('assert');
const fs = require('fs');
const worker = fs.readFileSync(require.resolve('./worker.js'), 'utf8');

assert.match(worker, /endsWith\('\.browserbase\.com'\)/);
assert.match(worker, /new WebSocketPair/);
assert.match(worker, /new WebSocket\(url\.href\)/);
console.log('Browserbase relay guard ok');
