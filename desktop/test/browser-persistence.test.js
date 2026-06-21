const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const session = fs.readFileSync(require.resolve('../../web-api/browser/session.js'), 'utf8');
const release = fs.readFileSync(require.resolve('../../web-api/browser/release.js'), 'utf8');

assert.match(session, /lunix_browser_session/);
assert.match(session, /reused: true/);
assert.match(release, /Max-Age=0/);
assert.match(app, /data-new-session/);
assert.doesNotMatch(app, /sendBeacon\('\/api\/browser\/release'/);
console.log('browser session persistence wiring ok');
