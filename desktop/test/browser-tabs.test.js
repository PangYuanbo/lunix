const assert = require('assert');
const fs = require('fs');
const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');

assert.match(server, /Target\.setDiscoverTargets/);
assert.match(server, /Target\.targetCreated/);
assert.match(server, /Target\.targetDestroyed/);
assert.match(server, /o\.sessionId !== rec\.ps/);
console.log('browser tab switching wiring ok');
