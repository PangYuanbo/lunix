const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /lunix_runtime_session/);
assert.match(app, /agentSession = readRuntimeSession\(selectedAgentProvider\)/);
assert.match(app, /runtimeCookie\(provider\)/);
assert.match(app, /saveRuntimeSession\(agentSession\)/);
assert.match(app, /sessions\.events\(agentSession\.session\.id\)/);
assert.match(app, /sessions\.sync\(agentSession\.session\.id, \[\]\)/);
assert.match(app, /sessions\.start\(agentSession\.agentId\)/);
assert.match(app, /restarting runtime…/);
assert.match(app, /Saved runtime expired/);
console.log('agent workspace terminal persistence wiring ok');
