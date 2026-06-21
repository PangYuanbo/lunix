const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /data-browser-choice/);
assert.match(app, /data-external/);
assert.match(app, /data-internal/);
assert.match(app, /place-items:start end/);
assert.match(app, /External browser/);
assert.match(app, /Built-in browser/);
assert.match(app, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/);
assert.match(app, /closest\?\.\('a\[href\]'\)/);
console.log('browser choice wiring ok');
