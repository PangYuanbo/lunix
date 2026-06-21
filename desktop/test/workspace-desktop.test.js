const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /workspaceClient\.workspace\.list\('\/Desktop'\)/);
assert.match(app, /workspaceClient\.workspace\.write\(`\/Desktop\/\$\{file\.name/);
assert.match(app, /filesOpenPath = '\/Desktop'/);
console.log('workspace Desktop wiring ok');
