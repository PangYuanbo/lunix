// CLI agent detection — mirrors app/src/terminal/cli_agent.rs CLIAgent::detect semantics.
'use strict';
const assert = require('assert');
const { detect, firstCommandWord, onDarkBg } = require('../src/crates/warp_terminal/cli_agent');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const lum = (h) => 0.2126 * parseInt(h.slice(1,3),16) + 0.7152 * parseInt(h.slice(3,5),16) + 0.0722 * parseInt(h.slice(5,7),16);

ok(detect('claude').name === 'Claude Code', 'claude -> Claude Code');
ok(detect('claude').color === '#D97757', 'claude brand = CLAUDE_ORANGE');
ok(detect('codex').name === 'Codex', 'codex -> Codex');
ok(detect('gemini').name === 'Gemini', 'gemini -> Gemini');
ok(detect('claude --resume').key === 'claude', 'args after agent ignored');
ok(detect('FOO=1 BAR=2 claude').key === 'claude', 'leading env assignments skipped');
ok(detect('/usr/local/bin/claude').key === 'claude', 'path prefix stripped');
ok(detect('vibe-acp').key === 'vibe', 'vibe-acp -> Mistral Vibe');
ok(detect('ls -la') === null, 'plain command not an agent');
ok(detect('') === null, 'empty command -> null');
ok(detect('git commit') === null, 'git is not an agent');
ok(firstCommandWord('A=1 claude x') === 'claude', 'firstCommandWord skips env');

// contrast adjustment: dark brands get lightened to be visible on #000; light brands stay light
ok(lum(onDarkBg('#000000')) >= 90, 'Codex black lightened for dark bg -> ' + onDarkBg('#000000'));
ok(lum(onDarkBg('#101010')) >= 90, 'Goose near-black lightened -> ' + onDarkBg('#101010'));
ok(onDarkBg('#FFFFFF') === '#ffffff', 'white brand unchanged');
ok(detect('codex').display !== '#000000', 'codex display color is not invisible black');
ok(detect('claude').display === detect('claude').color || lum(detect('claude').display) >= 96, 'claude orange already visible');

console.log(`CLI AGENT PASS: ${n} assertions`);
