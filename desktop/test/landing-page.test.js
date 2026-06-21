const assert = require('assert');
const fs = require('fs');
const page = fs.readFileSync(require.resolve('../cloud-src/src/plan-b.jsx'), 'utf8');
assert.match(page, /className="button primary app-button" href="\/app\/"/);
assert.match(page, /className="button primary" href="\/app\/"/);
assert.doesNotMatch(page, />Plan A</);
assert.doesNotMatch(page, /href="\/(?:cloud-browser|plan-b)"/);
console.log('landing page routing ok');
