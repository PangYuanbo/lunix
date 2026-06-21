const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(app, /\{ id: 'codex', name: 'Codex' \}/);
assert.match(app, /provider: selectedAgentProvider/);
assert.match(app, /showDeviceLogin/);
assert.match(app, /authSession\.deviceCode/);
assert.match(app, /data-copy/);
assert.match(app, /data-confirm/);
assert.match(app, /confirm\.onclick = async/);
assert.match(app, /completeAuth\(agentId, authSession\.id, \{\}\)/);
assert.match(app, /provider: 'codex'/);
assert.match(app, /lunix_agent_provider/);
assert.match(app, /data-switch-provider/);
assert.match(app, /selectedAgentProvider === 'claude' \? 'codex' : 'claude'/);
assert.match(app, /catch \(e\) \{ authCard\(e\.message \|\| String\(e\)\); \}/);
console.log('Codex device login wiring ok');
