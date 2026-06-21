const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');

assert.match(app, /const IS_TOUCH = .*maxTouchPoints.*pointer: coarse/);
assert.match(app, /if \(IS_TOUCH\) \(function lunixTouchSetup/);
assert.match(app, /if \(!IS_TOUCH\).*desktop web/s);
assert.match(app, /Math\.min\(desiredWidth, Math\.max\(360, innerWidth - 24\)\)/);
assert.match(html, /width=device-width, initial-scale=1/);
assert.doesNotMatch(html, /user-scalable=no|touch-action: none|position: fixed/);

console.log('touch device split wiring ok');
