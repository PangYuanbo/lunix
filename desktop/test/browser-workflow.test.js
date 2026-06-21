const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const sdk = fs.readFileSync(require.resolve('../nodus-sdk.js'), 'utf8');
const skill = fs.readFileSync(require.resolve('../../.agents/skills/lunix-browser-workflow/SKILL.md'), 'utf8');

assert.match(app, /LUNIX_BROWSER_OPEN/);
assert.match(app, /openBrowserUrl\(browserMatch\[1\].*true\)/);
assert.match(app, /text \+ AGENT_BROWSER_PROMPT/);
assert.match(sdk, /diff: \(sessionId\)/);
assert.match(skill, /include the localhost URL/);
console.log('Lunix browser workflow wiring ok');
