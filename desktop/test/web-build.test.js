const assert = require('assert');
const fs = require('fs');
const build = fs.readFileSync(require.resolve('../../scripts/build-web.mjs'), 'utf8');

assert.match(build, /terminalUrl: '\/terminal\/\?theme=sand&embed=1'/);
assert.match(build, /\['web', 'src'\]/);
assert.doesNotMatch(build, /web-server\.js/);
console.log('safe web build wiring ok');
