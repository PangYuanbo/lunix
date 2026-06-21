const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /const width = Math\.min\(desiredWidth, Math\.max\(360, innerWidth - 24\)\)/);
assert.match(app, /const height = Math\.min\(desiredHeight, Math\.max\(280, innerHeight - 76\)\)/);
assert.match(app, /innerWidth - width - 12/);
assert.match(app, /innerHeight - height - 12/);
assert.match(app, /innerWidth - win\.offsetWidth - 12/);
assert.match(app, /innerHeight - win\.offsetHeight - 12/);
console.log('desktop window bounds wiring ok');
