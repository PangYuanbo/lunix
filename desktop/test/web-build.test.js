const assert = require('assert');
const fs = require('fs');
const build = fs.readFileSync(require.resolve('../../scripts/build-web.mjs'), 'utf8');

assert.match(build, /build:cloud/);
assert.match(build, /terminalUrl: '\/app\/terminal\/\?theme=lunix&embed=1'/);
assert.match(build, /cloud-browser', 'plan-b\.html/);
assert.match(build, /path\.join\(out, 'app', 'index\.html'\)/);
assert.match(build, /\['web', 'dist'\]/);
assert.match(build, /web-api/);
assert.match(build, /browserRelayUrl/);
assert.match(build, /app\.js\?v=/);
assert.doesNotMatch(build, /web-server\.js/);
console.log('safe web build wiring ok');
