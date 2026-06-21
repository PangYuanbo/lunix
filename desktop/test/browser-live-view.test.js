const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const session = fs.readFileSync(require.resolve('../../web-api/browser/session.js'), 'utf8');

assert.match(app, /connectHosted\(s\.connectUrl/);
assert.match(app, /CFG\.browserRelayUrl/);
assert.match(app, /Page\.startScreencast/);
assert.match(app, /Target\.targetCreated/);
assert.match(session, /connectUrl: session\.connectUrl/);
assert.doesNotMatch(app, /debuggerFullscreenUrl|liveViewUrl/);
console.log('hosted custom Browserbase CDP wiring ok');
