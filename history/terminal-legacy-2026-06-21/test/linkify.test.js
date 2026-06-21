// Linkify URL + file detection — mirrors LINK_RE in block_view.js. The DOM wrapping is standard;
// the bit that can break is the regex (group 1 = URL, group 2 = file path; trailing punctuation).
'use strict';
const assert = require('assert');
const LINK_RE = /(https?:\/\/[^\s<>"'`)\]}\\]+)|((?<![:/\w])(?:~|\.{1,2})?\/[\w.@+-]+(?:\/[\w.@+-]+)*(?::\d+(?::\d+)?)?)/g;
// returns array of [text, kind] where kind = 'url' | 'file'
const find = (s) => { const o = []; let m; LINK_RE.lastIndex = 0; while ((m = LINK_RE.exec(s))) o.push([m[0], m[1] ? 'url' : 'file']); return o; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// URLs
ok(find('see https://warp.dev now')[0][0] === 'https://warp.dev', 'basic https');
ok(find('http://a.com/x?y=1 http://b.org').filter(x => x[1] === 'url').length === 2, 'finds both URLs');
ok(find('(https://x.io)')[0][0] === 'https://x.io', 'stops before closing paren');
ok(find('https://warp.dev/x\\aPricing')[0][0] === 'https://warp.dev/x', 'stops at backslash');
ok(find('git://nope ftp://nope').length === 0, 'only http(s) URLs (no file match either)');

// file paths
ok(find('edit /Users/aaronpang/foo.js please')[0].join() === '/Users/aaronpang/foo.js,file', 'absolute path -> file');
ok(find('see ./src/block_view.js:42 there')[0][0] === './src/block_view.js:42', 'relative path with :line');
ok(find('at ~/Desktop/warp/main.js:10:5')[0][0] === '~/Desktop/warp/main.js:10:5', 'home path with :line:col');
ok(find('plain text no link').length === 0, 'no false positive');

// URL is not misclassified as a file (group 1 wins)
ok(find('https://warp.dev/a/b')[0][1] === 'url', 'url with path stays a url, not file');

console.log(`LINKIFY PASS: ${n} assertions`);
