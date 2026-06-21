const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const sdk = fs.readFileSync(require.resolve('../nodus-sdk.js'), 'utf8');
const skill = fs.readFileSync(require.resolve('../../.agents/skills/lunix-browser-workflow/SKILL.md'), 'utf8');

assert.match(app, /LUNIX_BROWSER_OPEN/);
assert.match(app, /bind it to 0\.0\.0\.0 \(never 127\.0\.0\.1\)/);
assert.match(app, /localhost\|127\\\.0\\\.0\\\.1\|0\\\.0\\\.0\\\.0/);
assert.match(app, /previewTarget = \{ url: preview\.url/);
assert.match(app, /actionLabel: 'Open Preview'/);
assert.match(app, /text \+ AGENT_BROWSER_PROMPT/);
assert.match(app, /const normalizeBrowserUrl/);
assert.match(app, /nodusClient\.browser\.session\(shared, initialUrl\)/);
assert.match(app, /urlIn\.value = url/);
assert.match(sdk, /diff: \(sessionId\)/);
assert.match(skill, /report it as `http:\/\/localhost:<port>\/`/);
console.log('Lunix browser workflow wiring ok');
