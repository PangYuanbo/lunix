const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const session = fs.readFileSync(require.resolve('../../web-api/browser/session.js'), 'utf8');

assert.match(app, /s\.liveViewUrl/);
assert.match(app, /api\/browser\/debug/);
assert.match(session, /debuggerFullscreenUrl/);
console.log('Browserbase live view wiring ok');
