const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /sessions\.diff\(agentSession\.session\.id\)/);
assert.match(app, /\['changes', 'Changes'\]/);
assert.match(app, /\['files', 'All Files'\]/);
assert.match(app, /\['ports', 'Ports & Services'\]/);
assert.match(app, /No workspace changes yet/);
assert.match(app, /file\.additions/);
assert.match(app, /await refreshChanges\(\)/);
console.log('agent diff panel wiring ok');
