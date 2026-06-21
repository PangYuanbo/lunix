// Unit tests for the ported crates — assertions translated 1:1 from the Warp Rust test files
// (crates/fuzzy_match/src/fuzzy_tests.rs, crates/string-offset/src/lib_tests.rs).
const assert = require('assert');
const fz = require('../src/crates/fuzzy_match');
const so = require('../src/crates/string-offset');
const nl = require('../src/crates/natural_language_detection');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

// ---- fuzzy_match::fuzzy_tests ----
ok(fz.contains_wildcards('*.rs')); ok(fz.contains_wildcards('file?.txt')); ok(fz.contains_wildcards('*test*'));
ok(!fz.contains_wildcards('normal_file.rs')); ok(!fz.contains_wildcards('test'));

ok(fz.match_wildcard_pattern('button.rs', '*.rs'), 'star suffix');
ok(fz.match_wildcard_pattern('button.rs', '*.rs').score > 0);
ok(fz.match_wildcard_pattern('button.rs', '*.rs').matched_indices.length > 0);
ok(fz.match_wildcard_pattern('button.rs', 'butto?.rs'), 'question mark');
ok(fz.match_wildcard_pattern('button.rs', '*.py') === null, 'no match *.py');
ok(fz.match_wildcard_pattern_case_insensitive('Button.RS', '*.rs'), 'case insensitive');
ok(fz.match_wildcard_pattern('/src/ui/button.rs', '*/ui/*.rs'), 'complex pattern');
ok(fz.match_wildcard_pattern('/src/components/button.rs', '/src/components/button.rs'), 'exact');
ok(fz.match_wildcard_pattern('test.file', 'test.file'), 'literal dot exact');
ok(fz.match_wildcard_pattern('testXfile', 'test.file') === null, 'literal dot must not match X');
ok(fz.match_wildcard_pattern_case_insensitive('/src/ui/button.rs', 'ui/*'), 'ui/* substring');
ok(fz.match_wildcard_pattern('src/ui/button.rs', 'src/*'));
ok(fz.match_wildcard_pattern('ui/button.rs', 'ui/*'));
ok(fz.match_wildcard_pattern('/src/ui/button.rs', 'ui/*'));
ok(fz.match_wildcard_pattern('button.rs', '*.r'), 'partial suffix *.r');
ok(fz.match_wildcard_pattern('component.tsx', '*.t'));
ok(fz.match_wildcard_pattern('test.js', '*.'));
ok(fz.match_wildcard_pattern('button.rs', '*.py') === null);
ok(fz.match_wildcard_pattern_case_insensitive('/src/ui/button.rs', 'ui/*.rs'));
ok(fz.match_wildcard_pattern_case_insensitive('/src/ui/button.rs', 'ui/*.r'));
ok(fz.match_wildcard_pattern_case_insensitive('/src/ui/button.rs', 'ui/*.'));

// traditional fuzzy: "abc" vs "ace" matches indices 0,2,4 (from test_simple_fuzzy_match_indices)
const fm = fz.match_indices('abcde', 'ace');
ok(fm && fm.matched_indices.length === 3 && fm.score > 0, 'subsequence fuzzy works');

// ---- string-offset::lib_tests (CharCounter over multibyte text) ----
{
  const text = 'abc🔥abc☄️abc😬';
  const counter = new so.CharCounter(text);
  const enc = new TextEncoder();
  // byte positions of each "abc" occurrence
  let byte = 0; const starts = [];
  // compute byte offsets where "abc" begins
  for (let i = 0; i < text.length; ) {
    if (text.startsWith('abc', i)) starts.push(byte);
    const cp = text.codePointAt(i); const ch = String.fromCodePoint(cp);
    byte += enc.encode(ch).length; i += ch.length;
  }
  const got = starts.map((b) => [b, counter.charOffset(b)]);
  eq(got, [[0, 0], [7, 4], [16, 9]], 'CharCounter maps byte->char offsets like Rust doctest');
}

// ---- natural_language_detection pure functions ----
ok(nl.check_if_token_has_shell_syntax('ls/foo') === true);
ok(nl.check_if_token_has_shell_syntax('hello') === false);
ok(nl.check_if_token_has_shell_syntax('two words') === false, 'multi-token short-circuits');
ok(nl.wrapped_in_quotes('"hi"') === true);
ok(nl.wrapped_in_quotes("'hi'") === true);
ok(nl.wrapped_in_quotes('hi') === false);
eq(nl.token_preprocessing("Can't"), 'can', "can't special case");
eq(nl.token_preprocessing("he's"), 'he', 'contraction strip');
eq(nl.token_preprocessing("HELLO"), 'hello', 'lowercase');
// score: with a dictionary, NL words counted; shell-syntax tokens penalized
const dict = (w, db) => (db === 'English' && ['how', 'do', 'i', 'list', 'file'].includes(w));
ok(nl.natural_language_words_score(['how', 'do', 'i', 'list'], false, { isWord: dict }) === 4, 'NL score counts dictionary words');

// ---- input_classifier (util_tests.rs, v1 production heuristic) ----
const ic = require('../src/crates/input_classifier');
// Build a tokens snapshot: whitespace split, token_index by position, descriptions on given indices.
function snap(text, describedIdxs = []) {
  const toks = text.split(/\s+/).filter(Boolean).map((t, i) => ({
    token: t, token_index: i, token_description: describedIdxs.includes(i) ? 'desc' : null,
  }));
  return { parsed_tokens: toks };
}
// InputType enum
eq(ic.inputTypeFromStr('ai'), ic.InputType.AI);
eq(ic.inputTypeFromStr('SHELL'), ic.InputType.Shell);
ok(ic.inputTypeIsAi(ic.InputType.AI) && !ic.inputTypeIsAi(ic.InputType.Shell));
// one-off helpers
ok(ic.is_one_off_shell_command_keyword('sudo') && ic.is_one_off_shell_command_keyword('claude'));
ok(ic.is_agent_follow_up_input('do it') && !ic.is_agent_follow_up_input('nope'));
ok(ic.is_prefix_of_natural_language_word('exp'), 'prefix of "explain"');
// one-off keyword short-circuits (descriptions cleared) -> shell
{ const s = snap('sudo apt update'); ok(ic.is_likely_shell_command(s, s.parsed_tokens.length), 'sudo short-circuit'); }
{ const s = snap('echo hello world'); ok(ic.is_likely_shell_command(s, s.parsed_tokens.length), 'echo short-circuit'); }
// first token described + short input -> shell
ok(ic.is_likely_shell_command(snap('cargo --version', [0]), 2), 'first-token cmd short input');
// no descriptions -> not shell (v1)
{ const s = snap('install --foo=bar baz'); ok(!ic.is_likely_shell_command(s, s.parsed_tokens.length), 'no-desc not shell'); }
// majority described -> shell
{ const s = snap('cargo build --release --workspace --all-features', [0, 1, 2, 3, 4]);
  ok(ic.is_likely_shell_command(s, s.parsed_tokens.length), 'majority described shell'); }
// shell-syntax tokens vote shell under v1 (only first described)
{ const s = snap('git --foo=bar /path/to/file --baz', [0]);
  ok(ic.is_likely_shell_command(s, s.parsed_tokens.length), 'shell-syntax votes shell v1'); }

// ---- channel_versions (channel_versions_tests.rs) ----
const cv = require('../src/crates/channel_versions');
{
  const v = cv.parseVersion('v0.2023.05.15.08.04.stable_01');
  eq(v.major, 0, 'major parsed');
  eq(v.date.getTime(), Date.UTC(2023, 4, 15, 8, 4, 0), 'date parsed (%Y.%m.%d.%H.%M)');
  eq(v.patch, 1, 'patch parsed');
}
// major comparison
ok(cv.compareVersions(cv.parseVersion('v1.2023.05.15.08.04.stable_01'), cv.parseVersion('v0.2023.05.15.08.04.stable_01')) > 0, 'major compare');
// date comparison
ok(cv.compareVersions(cv.parseVersion('v0.2023.05.22.08.04.stable_00'), cv.parseVersion('v0.2023.05.15.08.04.stable_01')) > 0, 'date compare');
// patch comparison
ok(cv.compareVersions(cv.parseVersion('v0.2023.05.15.08.04.stable_01'), cv.parseVersion('v0.2023.05.15.08.04.stable_00')) > 0, 'patch compare');
// ignores unknown channels (beta/canary) when reading stable
{
  const json = JSON.stringify({
    beta: { version: 'v0.2024.01.30.16.52.beta_00' },
    canary: { version: 'v0.2022.09.29.08.08.canary_00' },
    dev: { version: 'v0.2024.01.30.20.34.dev_00' },
    preview: { version: 'v0.2024.01.30.20.34.preview_00' },
    stable: { version: 'v0.2024.01.16.16.31.stable_01' },
  });
  eq(cv.parseChannelVersions(json).stable.version_info().version, 'v0.2024.01.16.16.31.stable_01', 'ignores unknown channels');
}

// ---- command (wsl_tests.rs) — exec-check injected to model temp-dir layouts ----
const cmd = require('../src/crates/command');
const D = require('path').delimiter;
// known_bare_name
eq(cmd.known_bare_name('git'), 'git'); eq(cmd.known_bare_name('gh'), 'gh');
eq(cmd.known_bare_name('/usr/bin/git'), null); eq(cmd.known_bare_name('./git'), null); eq(cmd.known_bare_name('bin/git'), null);
eq(cmd.known_bare_name('ls'), null); eq(cmd.known_bare_name('python'), null); eq(cmd.known_bare_name(''), null);
// resolver: picks first linux path under WSL, skipping /mnt
{
  const has = (p) => p === '/home/linux/git';
  eq(cmd.resolve_binary_in_wsl_safe_path('git', ['/mnt/c/Program Files/Git/cmd', '/home/linux'].join(D), true, has),
     '/home/linux/git', 'picks first linux path, skips /mnt under WSL');
}
// not WSL: /mnt is just another dir, first match wins
{
  const has = (p) => p === '/mnt/a/git' || p === '/other/git';
  eq(cmd.resolve_binary_in_wsl_safe_path('git', ['/mnt/a', '/other'].join(D), false, has), '/mnt/a/git', 'not-WSL picks first match');
}
// only /mnt has git under WSL -> none
eq(cmd.resolve_binary_in_wsl_safe_path('git', ['/mnt/c/Program Files/Git/cmd', '/mnt/c/Windows/System32'].join(D), true, () => true), null, 'only /mnt -> none');
// walks past empty + /mnt to land on real dir
{
  const has = (p) => p === '/home/.local/bin/git';
  eq(cmd.resolve_binary_in_wsl_safe_path('git', ['/empty', '/mnt/c/Program Files/Git/cmd', '/home/.local/bin'].join(D), true, has),
     '/home/.local/bin/git', 'walks past empty and /mnt');
}
// empty PATH env
eq(cmd.resolve_binary_in_wsl_safe_path('git', null, true), null);
eq(cmd.resolve_binary_in_wsl_safe_path('git', null, false), null);

// ---- warp_util::worktree_names (worktree_names_tests.rs) ----
const wt = require('../src/crates/warp_util');
const WS = wt.WORDS;
// deterministic output with seeded rng
{ const a = wt.generateUniqueName(new Set(), wt.seededRng(42));
  const b = wt.generateUniqueName(new Set(), wt.seededRng(42));
  eq(a, b, 'same seed -> same name'); }
// format: starts with a word, ends with a word, distinct
{ const name = wt.generateUniqueName(new Set(), wt.seededRng(1));
  const wordSet = new Set(WS);
  const pre = [...wordSet].find((w) => name.startsWith(w) && name.length > w.length && name[w.length] === '-');
  const suf = [...wordSet].find((w) => name.endsWith(w) && name.length > w.length && name[name.length - w.length - 1] === '-');
  ok(pre, 'starts with a WORDS word: ' + name); ok(suf, 'ends with a WORDS word: ' + name); ok(pre !== suf, 'two distinct words'); }
// words are distinct (never "x-x") across many seeds
{ let okAll = true; for (let seed = 0; seed < 100; seed++) {
    const name = wt.generateUniqueName(new Set(), wt.seededRng(seed));
    for (const w of WS) if (name === `${w}-${w}`) okAll = false;
  } ok(okAll, 'never repeats a word'); }
// avoids existing branches
{ const first = wt.generateUniqueName(new Set(), wt.seededRng(7));
  const existing = new Set([first]);
  const second = wt.generateUniqueName(existing, wt.seededRng(7));
  ok(second !== first, 'avoids first name'); ok(!existing.has(second), 'second not in existing'); }
// escalates to >=3 words when 2-word space exhausted
{ const existing = new Set();
  for (let i = 0; i < WS.length; i++) for (let j = 0; j < WS.length; j++) if (i !== j) existing.add(`${WS[i]}-${WS[j]}`);
  const name = wt.generateUniqueName(existing, wt.seededRng(99));
  let remaining = name, wordCount = 0;
  while (remaining.length) {
    const matched = WS.filter((w) => remaining.startsWith(w)).sort((a, b) => b.length - a.length)[0];
    ok(matched, 'segment in WORDS: ' + remaining); if (!matched) break;
    wordCount++; remaining = remaining.slice(matched.length);
    if (remaining.startsWith('-')) remaining = remaining.slice(1);
  }
  ok(wordCount >= 3, `>=3 words when 2-word space exhausted, got ${wordCount} in ${name}`); }
// all words are valid git branch components
for (const w of WS) {
  ok(w.length > 0 && !w.startsWith('-') && !w.endsWith('-') && !w.includes('..') && !w.includes(' ')
     && /^[a-z-]+$/.test(w), 'valid git branch component: ' + w);
}
// no duplicates
ok(new Set(WS).size === WS.length, 'WORDS has no duplicates');

// ---- warp_util::standardized_path (standardized_path_tests.rs) ----
const SP = require('../src/crates/warp_util').StandardizedPath;
eq(SP.tryNew('/home/user/project').asStr(), '/home/user/project'); ok(SP.tryNew('/home/user/project').isUnix());
{ const p = SP.tryNew('C:\\Users\\user\\project'); eq(p.asStr(), 'C:\\Users\\user\\project'); ok(p.isWindows()); }
eq(SP.tryNew('/home/user/./project/../project/src').asStr(), '/home/user/project/src', 'normalizes . and ..');
{ let threw = false; try { SP.tryNew('relative/path'); } catch { threw = true; } ok(threw, 'rejects relative'); }
eq(SP.tryFromLocal('/tmp/test').asStr(), '/tmp/test');
{ let threw = false; try { SP.tryFromLocal('relative'); } catch { threw = true; } ok(threw, 'try_from_local rejects relative'); }
{ const p = SP.fromLocalCanonicalized(require('os').tmpdir()); ok(p.asStr().length > 0 && p.isUnix(), 'canonicalized existing'); }
{ let threw = false; try { SP.fromLocalCanonicalized('/nonexistent_path_xyz_123'); } catch { threw = true; } ok(threw, 'canonicalized nonexistent errors'); }
eq(SP.tryNew('/home/user/file.rs').fileName(), 'file.rs');
eq(SP.tryNew('/home/user/file.rs').extension(), 'rs');
eq(SP.tryNew('/home/user/file.rs').parent().asStr(), '/home/user');
{ const p = SP.tryNew('/home/user/project/src'); ok(p.startsWith(SP.tryNew('/home/user/project'))); ok(!p.startsWith(SP.tryNew('/other'))); }
eq(SP.tryNew('/home/user/project/src/main.rs').stripPrefix(SP.tryNew('/home/user/project')), 'src/main.rs');
eq(SP.tryNew('/home/user/project').stripPrefix(SP.tryNew('/home/user/project')), '');
// component-aware: /repo must not strip from /repository
{ const base = SP.tryNew('/repo'), sib = SP.tryNew('/repository/foo.rs');
  ok(!sib.startsWith(base)); eq(sib.stripPrefix(base), null, 'whole-component strip only');
  const nb = SP.tryNew('/home/user'), ns = SP.tryNew('/home/username/x');
  ok(!ns.startsWith(nb)); eq(ns.stripPrefix(nb), null); }
eq(SP.tryNew('/home/user').join('project/src').asStr(), '/home/user/project/src');
ok(SP.tryNew('/home/user').toLocalPath() === '/home/user', 'to_local_path unix on unix');
eq(`${SP.tryNew('/home/user/project')}`, '/home/user/project', 'display');
// serde roundtrip
{ const p = SP.tryNew('/home/user/project'); const json = JSON.stringify(p); eq(json, '"/home/user/project"');
  eq(SP.tryNew(JSON.parse(json)).asStr(), '/home/user/project'); }
// equality
ok(SP.tryNew('/home/user').equals(SP.tryNew('/home/user')), 'equality');

// ---- warp_util::file_type (file_type_tests.rs) ----
const ft = require('../src/crates/warp_util');
// common text files
['main.rs','script.py','app.js','component.tsx','Main.java','header.h','script.sh',
 'index.html','styles.css','component.vue','config.json','settings.yaml','Cargo.toml',
 '.gitignore','.env','README.md','docs.txt','manual.rst','Dockerfile','Makefile','build.gradle',
 'README','LICENSE'].forEach((f) => ok(ft.is_text_file(f), 'text: ' + f));
// binary files
['image.png','photo.jpg','icon.ico','program.exe','app.dmg','archive.zip','package.tar.gz',
 'data.7z','video.mp4','audio.mp3','sound.wav','document.pdf','spreadsheet.xlsx','presentation.pptx']
 .forEach((f) => ok(!ft.is_text_file(f), 'not text: ' + f));
// edge cases
ok(!ft.is_text_file(''), 'empty');
ok(ft.is_text_file('backup.tar.gz.txt') && ft.is_text_file('config.local.json'), 'multi-ext');
ok(ft.is_text_file('Component.TSX') && ft.is_text_file('README.MD'), 'mixed case');
ok(ft.is_text_file('/path/to/file.rs') && ft.is_text_file('..\\windows\\path\\file.py'), 'path separators');
ok(ft.is_text_file('script.fish') && ft.is_text_file('data.graphql') && ft.is_text_file('schema.proto'), 'unusual text');
// development extensions
ok(ft.is_development_text_extension('rs') && ft.is_development_text_extension('py')
   && ft.is_development_text_extension('dockerfile') && ft.is_development_text_extension('yaml'), 'dev exts');
ok(!ft.is_development_text_extension('png') && !ft.is_development_text_extension('exe') && !ft.is_development_text_extension('zip'), 'non-dev exts');
// extensionless
ok(ft.is_extensionless_text_file('README') && ft.is_extensionless_text_file('LICENSE')
   && ft.is_extensionless_text_file('Dockerfile') && ft.is_extensionless_text_file('.gitignore') && ft.is_extensionless_text_file('.env'), 'extensionless text');
ok(!ft.is_extensionless_text_file('binary') && !ft.is_extensionless_text_file('unknown') && !ft.is_extensionless_text_file('data'), 'extensionless non-text');

// ---- sum_tree (lib_tests.rs: test_extend_and_push_tree, test_update_last) ----
const st = require('../src/crates/sum_tree');
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
// test_extend_and_push_tree
{
  const t1 = st.newU8Tree(); t1.extend(range(0, 20));
  const t2 = st.newU8Tree(); t2.extend(range(50, 100));
  t1.pushTree(t2);
  eq(t1.items(), range(0, 20).concat(range(50, 100)), 'extend + push_tree preserves order');
}
// summary == sum of items; extent count == length (structural invariants)
{
  const t = st.newU8Tree(); const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  t.extend(data);
  eq(t.summary().sum, data.reduce((a, b) => a + b, 0), 'summary.sum == sum of items');
  eq(t.summary().count, data.length, 'summary.count == item count');
  eq(t.extent(st.dimCount).v, data.length, 'extent<Count> == length');
  eq(t.extent(st.dimSum).v, data.reduce((a, b) => a + b, 0), 'extent<Sum> == total');
  eq(t.items(), data, 'items round-trip across splits');
  eq(t.last(), 5); eq(t.first(), 3);
  ok(t.summary().contains_even === true, 'contains_even aggregates');
}
// build-by-push equals build-by-extend
{
  const data = range(0, 30);
  const a = st.newU8Tree(); a.extend(data);
  const b = st.newU8Tree(); for (const x of data) b.push(x);
  eq(a.items(), b.items(), 'push and extend yield identical sequences');
}
// test_update_last
{
  const t = st.newU8Tree(); t.extend([1]);
  t.updateLast((items, i) => { items[i] += 1; });
  eq(t.summary().sum, 2, 'update_last bumps sum to 2');
  t.extend([2, 0, 0, 4]);
  eq(t.summary().sum, 8, 'sum after extend == 8');
  t.updateLast((items, i) => { items[i] = 0; });
  eq(t.summary().sum, 4, 'sum after zeroing last == 4');
}

// ---- settings_value (lib_tests.rs) ----
const sv = require('../src/crates/settings_value');
// duration_round_trip
{ const d = sv.duration.fromSecs(30); const fv = sv.duration.to_file_value(d);
  eq(fv, 30, 'duration -> integer seconds'); eq(sv.duration.from_file_value(fv), d, 'duration round-trip'); }
// vec_recursive
{ const c = sv.vecOf(sv.number); const fv = c.to_file_value([10, 20]);
  eq(fv, [10, 20]); eq(c.from_file_value(fv), [10, 20], 'vec round-trip'); }
// option_some / option_none
{ const c = sv.optionOf(sv.number);
  eq(c.to_file_value(5), 5); eq(c.from_file_value(5), 5, 'option some');
  eq(c.to_file_value(null), null); eq(c.from_file_value(null), null, 'option none -> null'); }
// bool / string passthrough
eq(sv.bool.to_file_value(true), true); eq(sv.bool.from_file_value(false), false);
eq(sv.string.to_file_value('hello'), 'hello'); eq(sv.string.from_file_value('hello'), 'hello');
// hashmap_round_trip
{ const c = sv.hashMapOf(sv.string, sv.number);
  const m = new Map([['key', 42]]); const fv = c.to_file_value(m);
  eq(fv.key, 42, 'hashmap object key'); eq(c.from_file_value(fv), m, 'hashmap round-trip'); }

// ---- markdown_parser::weight (weight.rs — behavior derived 1:1 from the Rust source) ----
const mp = require('../src/crates/markdown_parser');
const W = mp.CustomWeight;
// is_at_least_bold: Bold/ExtraBold/Black true, lighter false
ok(mp.isAtLeastBold(W.Bold) && mp.isAtLeastBold(W.ExtraBold) && mp.isAtLeastBold(W.Black), 'bold+ is at least bold');
ok(!mp.isAtLeastBold(W.Thin) && !mp.isAtLeastBold(W.Medium) && !mp.isAtLeastBold(W.Semibold), 'lighter is not bold');
// merge_weights: first.or(second)
eq(mp.mergeWeights(W.Thin, W.Black), W.Thin, 'outer (first) weight wins');
eq(mp.mergeWeights(null, W.Bold), W.Bold, 'falls back to second');
eq(mp.mergeWeights(null, null), null, 'both none -> none');
// sequence order preserved (Thin -> Black)
eq(mp.WEIGHT_SEQUENCE.length, 8); eq(mp.WEIGHT_SEQUENCE[0], 'Thin'); eq(mp.WEIGHT_SEQUENCE[7], 'Black');

// ---- field_mask (behavior derived 1:1 from apply_path in lib.rs) ----
const fmask = require('../src/crates/field_mask');
// update single field
eq(fmask.FieldMaskOperation.update({ a: 1, b: 2 }, { a: 9, b: 8 }, ['a']).apply(), { a: 9, b: 2 }, 'update masked field only');
// append string field
eq(fmask.FieldMaskOperation.append({ s: 'foo' }, { s: 'bar' }, ['s']).apply(), { s: 'foobar' }, 'append concatenates strings');
// append non-string throws
{ let threw = false; try { fmask.FieldMaskOperation.append({ s: 1 }, { s: 2 }, ['s']).apply(); } catch { threw = true; } ok(threw, 'append non-string errors'); }
// unknown field is a no-op
eq(fmask.FieldMaskOperation.update({ a: 1 }, { a: 2, z: 3 }, ['z']).apply(), { a: 1 }, 'unknown field no-op');
// nested message path
eq(fmask.FieldMaskOperation.update({ m: { x: 1, y: 2 } }, { m: { x: 9, y: 8 } }, ['m.x']).apply(), { m: { x: 9, y: 2 } }, 'nested path');
// repeated (list of messages) same length
eq(fmask.FieldMaskOperation.update({ l: [{ x: 1 }, { x: 2 }] }, { l: [{ x: 9 }, { x: 8 }] }, ['l.x']).apply(), { l: [{ x: 9 }, { x: 8 }] }, 'list elementwise');
// list length mismatch throws
{ let threw = false; try { fmask.FieldMaskOperation.update({ l: [{ x: 1 }] }, { l: [{ x: 9 }, { x: 8 }] }, ['l.x']).apply(); } catch { threw = true; } ok(threw, 'list length mismatch errors'); }
// original destination is not mutated
{ const dest = { a: 1 }; fmask.FieldMaskOperation.update(dest, { a: 2 }, ['a']).apply(); eq(dest.a, 1, 'apply does not mutate source destination'); }

// ---- warp_util::content_version (content_version_tests.rs) ----
const CV = require('../src/crates/warp_util').ContentVersion;
{ CV.new(); ok(true, 'create version'); }                                   // test_create_version
{ const v1 = CV.new(); const v2 = v1; ok(v1.equals(v2), 'copy equals'); }    // test_versions_equal
{ const v1 = CV.new(); const v2 = CV.new(); ok(!v1.equals(v2), 'distinct new() differ'); } // test_versions_not_equal
eq(CV.fromRaw(42).asU64(), 42, 'from_raw roundtrip');                         // test_from_raw_roundtrip
ok(CV.fromRaw(7).equals(CV.fromRaw(7)), 'from_raw preserves equality');       // test_from_raw_preserves_equality
{ const v = CV.fromRaw(100); eq(v.asU64(), 100); eq(v.asI32(), 100); }        // test_as_u64_matches_as_i32

// ---- warp_util::on_cancel (on_cancel_tests.rs) ----
const oc = require('../src/crates/warp_util');
(async () => {
  // test_ready_future_doesnt_call_callback: completes normally -> callback not called
  { let called = false; await oc.withOnCancel(async () => {}, () => { called = true; }); ok(!called, 'ready future does not call on_cancel'); }
  // test_aborted_future_calls_callback: aborted before completion -> callback called, rejects Aborted
  { let called = false; const ctrl = new AbortController(); ctrl.abort();
    let result; try { await oc.withOnCancel(async () => {}, () => { called = true; }, ctrl.signal); } catch (e) { result = e; }
    eq(result, oc.Aborted, 'aborted future rejects with Aborted'); ok(called, 'aborted future calls on_cancel'); }

  // ---- input_classifier::parser (parser_tests.rs) ----
  const pq = require('../src/crates/input_classifier').parseQueryIntoTokens;
  eq(pq('This is a question?'), ['This', 'is', 'a', 'question']);
  eq(pq("No I can't!"), ['No', 'I', "can't"]);
  eq(pq('A quote "Inside quote"'), ['A', 'quote', '"Inside quote"']);
  eq(pq('A quote "Inside \' quote"'), ['A', 'quote', '"Inside \' quote"']);
  eq(pq('A quote "Inside \'something\' quote"'), ['A', 'quote', '"Inside \'something\' quote"']);
  eq(pq('Empty quote ""!?!'), ['Empty', 'quote']);
  eq(pq('www.google.com'), ['www.google.com']);
  eq(pq('Command `mockery --name example_interface`'), ['Command', '`mockery --name example_interface`']);

  // ---- input_classifier::heuristic_classifier (mod_tests.rs) ----
  // The real NL dictionary (30k words) isn't shipped; a controlled dict drives the decision logic.
  const H = require('../src/crates/input_classifier').heuristic;
  const snap = (text, desc = []) => ({
    buffer_text: text,
    parsed_tokens: text.split(/\s+/).filter(Boolean).map((t, i) => ({ token: t, token_index: i, token_description: desc.includes(i) ? 'desc' : null })),
  });
  const DICT = new Set(['fix', 'this', 'what', 'went', 'wrong']);
  const deps = { isWord: (w, db) => db === 'English' && DICT.has(w), stem: (w) => w };
  // echo hello -> Shell via ShellHeuristic (echo is a one-off shell keyword)
  { const d = H.detectInputType(snap('echo hello'), { current_input_type: 'Shell' }, deps);
    eq(d.input_type, 'Shell'); eq(d.source, 'ShellHeuristic'); }
  // explain -> AI via one-off NL allowlist (single token)
  { const d = H.detectInputType(snap('explain'), { current_input_type: 'Shell' }, deps);
    eq(d.input_type, 'AI'); eq(d.source, 'NaturalLanguageOneOffAllowlist'); }
  // fix this -> AI via fallback NL heuristic
  { const d = H.detectInputType(snap('fix this'), { current_input_type: 'Shell' }, deps);
    eq(d.input_type, 'AI'); eq(d.source, 'InputClassifierFallbackHeuristic'); }
  // cargo --version (first token a known command) -> Shell
  { const d = H.detectInputType(snap('cargo --version', [0]), { current_input_type: 'AI' }, deps);
    eq(d.input_type, 'Shell', 'cargo --version is shell'); }
  // What went wrong? (punctuated NL) -> AI
  { const d = H.detectInputType(snap('What went wrong?', [0]), { current_input_type: 'Shell' }, deps);
    eq(d.input_type, 'AI', 'punctuated NL is AI'); }

  // ---- warp_completer::meta (meta_tests.rs + documented Span behaviors) ----
  const wc = require('../src/crates/warp_completer');
  const { Span, spanned, spannedUnknown } = wc;
  // knows_distances
  eq(spanned('warp', Span.new(0, 4)).span.distance(), 4, 'warp span distance');
  eq(spannedUnknown('').span.distance(), 0, 'empty span distance');
  // construction + accessors
  { const s = Span.new(2, 7); eq(s.start, 2); eq(s.end, 7); eq(s.distance(), 5); }
  eq(Span.forChar(3).toRange(), { start: 3, end: 4 }, 'for_char');
  ok(Span.unknown().isEmpty() && new Span(5, 5).isEmpty(), 'is_empty');
  ok(!Span.new(0, 4).isEmpty(), 'non-empty');
  eq(Span.new(0, 2).until(Span.new(5, 9)).toRange(), { start: 0, end: 9 }, 'until');
  eq(Span.new(2, 5).skip(1).toRange(), { start: 3, end: 5 }, 'skip');
  eq(Span.new(0, 4).slice('warpdev'), 'warp', 'slice');
  // PartialEq<usize> compares the span length
  ok(Span.new(0, 4).eqLen(4) && !Span.new(0, 4).eqLen(3), 'eq vs length');
  // from_list spans first..last
  { const items = [spanned('a', Span.new(0, 1)), spanned('b', Span.new(2, 3)), spanned('c', Span.new(4, 5))];
    const wrapped = items.map((it) => ({ span: () => it.span }));
    eq(Span.fromList(wrapped).toRange(), { start: 0, end: 5 }, 'from_list'); }
  // end < start throws
  { let threw = false; try { Span.new(5, 2); } catch { threw = true; } ok(threw, 'end<start rejected'); }
  // map preserves span
  { const m = spanned('x', Span.new(1, 2)).map((v) => v + 'y'); eq(m.item, 'xy'); eq(m.span.toRange(), { start: 1, end: 2 }, 'map keeps span'); }

  // ---- warp_completer::lexer (lexer_tests.rs) ----
  const lx = require('../src/crates/warp_completer');
  const { Tok: K, EscapeChar: EC, tokenize } = lx;
  const sp = (start, end) => ({ start, end });
  // test_lexer
  {
    const source = "ls | rm -rf || touch 'hello.txt' &\ncat \"Hello $(ls -la)\" && echo `ps \\`;  {echo Goodbye\u{1F600}}";
    const items = tokenize(source, EC.Backslash, false).map((t) => t.item);
    eq(items, [
      K.Literal('ls'), K.Whitespace(' '), K.Pipe, K.Whitespace(' '), K.Literal('rm'), K.Whitespace(' '), K.Literal('-rf'),
      K.Whitespace(' '), K.LogicalOr, K.Whitespace(' '), K.Literal('touch'), K.Whitespace(' '), K.SingleQuote,
      K.Literal('hello.txt'), K.SingleQuote, K.Whitespace(' '), K.Ampersand, K.Newline, K.Literal('cat'), K.Whitespace(' '),
      K.DoubleQuote, K.Literal('Hello'), K.Whitespace(' '), K.Dollar, K.OpenParen, K.Literal('ls'), K.Whitespace(' '),
      K.Literal('-la'), K.CloseParen, K.DoubleQuote, K.Whitespace(' '), K.LogicalAnd, K.Whitespace(' '), K.Literal('echo'),
      K.Whitespace(' '), K.Backtick, K.Literal('ps'), K.Whitespace(' '), K.EscapeChar('\\'), K.Backtick, K.Semicolon,
      K.Whitespace('  '), K.OpenCurly, K.Literal('echo'), K.Whitespace(' '), K.Literal('Goodbye\u{1F600}'), K.CloseCurly,
    ], 'test_lexer items');
  }
  // test_spans (byte offsets; 😀 is 4 bytes)
  {
    const source = "ls -la && echo Hello' World'$(cat  \u{1F600}.txt";
    const spans = tokenize(source, EC.Backslash, false).map((t) => t.span);
    eq(spans, [sp(0, 2), sp(2, 3), sp(3, 6), sp(6, 7), sp(7, 9), sp(9, 10), sp(10, 14), sp(14, 15), sp(15, 20),
      sp(20, 21), sp(21, 22), sp(22, 27), sp(27, 28), sp(28, 29), sp(29, 30), sp(30, 33), sp(33, 35), sp(35, 43)], 'test_spans');
  }
  // test_escaped_tokens
  {
    const items = tokenize('\\\\\\||\\&&\\\\&&||', EC.Backslash, false).map((t) => t.item);
    eq(items, [K.EscapeChar('\\'), K.EscapeChar('\\'), K.EscapeChar('\\'), K.Pipe, K.Pipe, K.EscapeChar('\\'),
      K.Ampersand, K.Ampersand, K.EscapeChar('\\'), K.EscapeChar('\\'), K.LogicalAnd, K.LogicalOr], 'test_escaped_tokens');
  }
  // test_escaped_token_spans
  {
    const spans = tokenize('\\\\\\||\\&&\\\\&&||', EC.Backslash, false).map((t) => t.span);
    eq(spans, [sp(0, 1), sp(1, 2), sp(2, 3), sp(3, 4), sp(4, 5), sp(5, 6), sp(6, 7), sp(7, 8), sp(8, 9), sp(9, 10), sp(10, 12), sp(12, 14)], 'test_escaped_token_spans');
  }
  // test_multiple_whitespace
  eq(tokenize(' \t  |\t  ', EC.Backslash, false).map((t) => t.item), [K.Whitespace(' \t  '), K.Pipe, K.Whitespace('\t  ')], 'multiple_whitespace');
  // test_backtick_escape_char
  {
    const source = '& "$HOME\\Downloads\\Warp` Setup.exe" /SP- /SILENT `t`';
    const got = tokenize(source, EC.Backtick, false).map((t) => [t.item, t.span]);
    eq(got, [
      [K.Ampersand, sp(0, 1)], [K.Whitespace(' '), sp(1, 2)], [K.DoubleQuote, sp(2, 3)], [K.Dollar, sp(3, 4)],
      [K.Literal('HOME\\Downloads\\Warp'), sp(4, 23)], [K.EscapeChar('`'), sp(23, 24)], [K.Whitespace(' '), sp(24, 25)],
      [K.Literal('Setup.exe'), sp(25, 34)], [K.DoubleQuote, sp(34, 35)], [K.Whitespace(' '), sp(35, 36)],
      [K.Literal('/SP-'), sp(36, 40)], [K.Whitespace(' '), sp(40, 41)], [K.Literal('/SILENT'), sp(41, 48)],
      [K.Whitespace(' '), sp(48, 49)], [K.EscapeChar('`'), sp(49, 50)], [K.Literal('t'), sp(50, 51)], [K.EscapeChar('`'), sp(51, 52)],
    ], 'test_backtick_escape_char');
  }
  // test_single_quote_as_literals
  {
    const got = tokenize("I'd like to edit app/src", EC.Backslash, true).map((t) => [t.item, t.span]);
    eq(got, [[K.Literal("I'd"), sp(0, 3)], [K.Whitespace(' '), sp(3, 4)], [K.Literal('like'), sp(4, 8)], [K.Whitespace(' '), sp(8, 9)],
      [K.Literal('to'), sp(9, 11)], [K.Whitespace(' '), sp(11, 12)], [K.Literal('edit'), sp(12, 16)], [K.Whitespace(' '), sp(16, 17)],
      [K.Literal('app/src'), sp(17, 24)]], 'test_single_quote_as_literals');
  }

  // ---- warp_completer simple parser (parser_tests.rs) ----
  const P = require('../src/crates/warp_completer').parser;
  const EB = P.EscapeChar.Backslash;
  const { Part: PP, Command: CC, spanned: spP } = P;
  // test_parse_open_subshell
  eq(P.parseCommandOf('cat "Hello $(ls -la', EB), spP(CC([
    spP(PP.Literal('cat'), [0, 3]),
    spP(PP.Concatenated([
      spP(PP.Literal('Hello '), [4, 11]),
      spP(PP.OpenSubshell([spP(CC([spP(PP.Literal('ls'), [13, 15]), spP(PP.Literal('-la'), [16, 19])]), [13, 19])]), [11, 19]),
    ]), [4, 19]),
  ]), [0, 19]), 'parse_open_subshell');
  // test_parse_nested_command
  eq(P.parseCommandOf('cat "Hello $(ls -la)"', EB), spP(CC([
    spP(PP.Literal('cat'), [0, 3]),
    spP(PP.Concatenated([
      spP(PP.Literal('Hello '), [4, 11]),
      spP(PP.ClosedSubshell([spP(CC([spP(PP.Literal('ls'), [13, 15]), spP(PP.Literal('-la'), [16, 19])]), [13, 19])]), [11, 20]),
    ]), [4, 21]),
  ]), [0, 21]), 'parse_nested_command');
  // test_backslash_before_command (retained) / in_command (dropped)
  eq(P.parseCommandOf('\\ls', EB), spP(CC([spP(PP.Literal('\\ls'), [0, 3])]), [0, 3]), 'backslash before command');
  eq(P.parseCommandOf('ls \\-la', EB), spP(CC([spP(PP.Literal('ls'), [0, 2]), spP(PP.Literal('-la'), [3, 7])]), [0, 7]), 'backslash in command');
  // test_decompose_command (compare as sets, ordering-independent)
  const asSet = (xs) => new Set(xs);
  for (const [input, expected] of [
    ['ls', ['ls']], ['$(ls)', ['ls']], ['ls -la', ['ls -la']], ['ls && cat', ['ls', 'cat']],
    ['ls $(foo | echo)', ['foo', 'echo', 'foo | echo', 'ls $(foo | echo)']],
  ]) eq(asSet(P.decomposeCommand(input, EB)[0]), asSet(expected), 'decompose ' + input);
  // test_command_without_leading_env_vars
  eq(P.commandWithoutLeadingEnvVars('X=1 rm -rf target', EB), 'rm -rf target');
  eq(P.commandWithoutLeadingEnvVars('X=1 Y=2 curl https://example.com', EB), 'curl https://example.com');
  eq(P.commandWithoutLeadingEnvVars('rm -rf target', EB), 'rm -rf target');
  eq(P.commandWithoutLeadingEnvVars('X=1', EB), null);
  // test_contains_redirection
  for (const [cmd, expect] of [
    ['ls < "file.txt < tmp"', true], ['echo $(ls > file.txt)', true], ['ls >> file.txt', true], ['ls < file.txt', true],
    ['foo arg1 arg2 > file.txt', true], ['foo && ls > file.txt', true], ['echo "hello world" > output.txt', true],
    ['echo "5>4"', false], ['echo "This message -> shows direction"', false], ['print("Value must be > 0 and < 100")', false],
  ]) eq(P.newParser(cmd, EB).parse().containsRedirection, expect, 'redirection ' + cmd);
  // test_top_level_command
  eq(P.topLevelCommand('PAGER=0 git log', EB), 'git');
  eq(P.topLevelCommand('PAGER= git log', EB), 'git');
  eq(P.topLevelCommand('ls && git status', EB), 'ls');
  eq(P.topLevelCommand('$(git status)', EB), null);

  // ---- warp_completer::matchers (matchers_tests.rs) ----
  const M = require('../src/crates/warp_completer').matchers;
  const mt = M.matchTypeForCaseInsensitive;
  // test_match_type_for_case_insensitive
  eq(mt('git', 'git'), M.Match.Exact(true));
  eq(mt('gIt', 'git'), M.Match.Exact(false));
  eq(mt('abc', 'abcdef'), M.Match.Prefix(true));
  eq(mt('aBc', 'abcdef'), M.Match.Prefix(false));
  eq(mt('abc', 'def'), null);
  // test_get_match_type_case_sensitive
  const gmt = (s, p, f) => M.getMatchType(s, p, f);
  eq(gmt(M.MatchStrategy.CaseSensitive, 'git', 'GIT'), null);
  eq(gmt(M.MatchStrategy.CaseSensitive, 'git', 'git'), M.Match.Exact(true));
  eq(gmt(M.MatchStrategy.CaseSensitive, 'AsDs', 'AsDss'), M.Match.Prefix(true));
  eq(gmt(M.MatchStrategy.CaseSensitive, 'Asds', 'asds'), null);
  // test_get_match_type_case_insensitive
  eq(gmt(M.MatchStrategy.CaseInsensitive, 'git', 'GIT'), M.Match.Exact(false));
  eq(gmt(M.MatchStrategy.CaseInsensitive, 'AsDs', 'asdss'), M.Match.Prefix(false));
  eq(gmt(M.MatchStrategy.CaseInsensitive, 'Asd', 'ads'), null);
  // test_get_match_type_fuzzy
  eq(gmt(M.MatchStrategy.Fuzzy, 'git', 'GIT'), M.Match.Exact(false));
  eq(gmt(M.MatchStrategy.Fuzzy, 'AsDs', 'asdss'), M.Match.Prefix(false));
  { const r = gmt(M.MatchStrategy.Fuzzy, 'abc', 'aabac'); ok(r && r.k === 'Fuzzy', 'fuzzy match'); }
  eq(gmt(M.MatchStrategy.Fuzzy, 'abc', 'xyz'), null);

  // ---- jsonrpc envelope + server-request ack/error (service.rs message layer) ----
  const J = require('../src/crates/jsonrpc');
  // Request/Notification: params skipped when null
  eq(J.buildRequest(7, 'foo', { a: 1 }), { jsonrpc: '2.0', id: 7, method: 'foo', params: { a: 1 } });
  eq(J.buildRequest(7, 'foo', null), { jsonrpc: '2.0', id: 7, method: 'foo' }, 'null params skipped');
  eq(J.buildNotification('ping', null), { jsonrpc: '2.0', method: 'ping' });
  // envelope parsing/validation
  eq(J.parseAnyRequest('{"jsonrpc":"2.0","method":"m","id":3}'), { jsonrpc: '2.0', method: 'm', params: null, id: 3 });
  eq(J.parseAnyRequest('{"method":"m"}'), null, 'request needs integer id');
  eq(J.parseAnyNotification('{"jsonrpc":"2.0","method":"n"}'), { jsonrpc: '2.0', method: 'n', params: null });
  eq(J.parseAnyNotification('{"jsonrpc":"2.0","method":"n","id":1}'), null, 'notification has no id');
  ok(J.parseAnyResponse('{"jsonrpc":"2.0","result":5,"id":2}') !== null, 'response with result');
  eq(J.parseAnyResponse('{"jsonrpc":"2.0","id":2}'), null, 'response needs result or error');
  // ack-allowlist -> result null
  eq(J.serverRequestResponse({ method: 'client/registerCapability', id: 9 }, -32601),
    { response: { jsonrpc: '2.0', id: 9, result: null }, shouldAck: true }, 'ack method');
  // other method -> not-implemented error
  eq(J.serverRequestResponse({ method: 'workspace/configuration', id: 4 }, -32601),
    { response: { jsonrpc: '2.0', id: 4, error: { code: -32601, message: 'Method workspace/configuration not implemented' } }, shouldAck: false }, 'error method');

  // ---- ipc wire framing (protocol.rs send_message/receive_message) ----
  const IPC = require('../src/crates/ipc');
  // frame = [8-byte BE length][payload]
  {
    const payload = Buffer.from('hello');
    const framed = IPC.frameMessage(payload);
    eq(framed.length, 8 + 5, 'frame length = header + payload');
    eq(Number(framed.readBigUInt64BE(0)), 5, 'BE length header');
    eq(framed.subarray(8).toString(), 'hello', 'payload follows header');
  }
  // round-trip
  {
    const parsed = IPC.parseFrame(IPC.frameMessage(Buffer.from('world!')));
    eq(parsed.payload.toString(), 'world!', 'parseFrame recovers payload');
    eq(parsed.rest.length, 0, 'no trailing bytes');
  }
  // partial frame -> null until complete
  eq(IPC.parseFrame(Buffer.from([0, 0, 0])), null, 'incomplete header -> null');
  {
    const framed = IPC.frameMessage(Buffer.from('abcd'));
    eq(IPC.parseFrame(framed.subarray(0, 8 + 2)), null, 'incomplete payload -> null');
  }
  // two concatenated frames: parse first, rest holds the second
  {
    const two = Buffer.concat([IPC.frameMessage(Buffer.from('AA')), IPC.frameMessage(Buffer.from('BBB'))]);
    const first = IPC.parseFrame(two);
    eq(first.payload.toString(), 'AA');
    eq(IPC.parseFrame(first.rest).payload.toString(), 'BBB', 'second frame in rest');
  }
  // message shapes
  eq(IPC.Response.success('req-1', 'svc', Buffer.from('x')).k, 'Success');
  eq(IPC.Response.failure('req-1', 'boom'), { k: 'Failure', request_id: 'req-1', error_message: 'boom' });
  eq(IPC.newRequest('id-1', 'svc', Buffer.from('p')).service_id, 'svc');

  // ---- settings::toml_path (toml_path_tests.rs) ----
  const S = require('../src/crates/settings');
  eq(S.tomlPathStorageKey('font_name'), 'font_name', 'storage_key single');
  eq(S.tomlPathStorageKey('font.font_name'), 'font_name', 'storage_key two');
  eq(S.tomlPathStorageKey('appearance.text.font_name'), 'font_name', 'storage_key three');
  eq(S.tomlPathHierarchy('font_name'), null, 'hierarchy single -> none');
  eq(S.tomlPathHierarchy('font.font_name'), 'font', 'hierarchy two');
  eq(S.tomlPathHierarchy('appearance.text.font_name'), 'appearance.text', 'hierarchy three');
  // const-eval checks from the Rust source
  eq(S.tomlPathStorageKey('a.b.c'), 'c'); eq(S.tomlPathStorageKey('key'), 'key');

  // ---- warp_completer signatures/v2 lookup (lookup_tests.rs) ----
  const SG = require('../src/crates/warp_completer').signatures;
  const reg = (cmd) => { const r = SG.CommandRegistry.new(); r.registerSignature(SG.CommandSignature(cmd)); return r; };
  const sub = (name, args = []) => SG.Command({ name, arguments: args });
  const arg = (name, optional = false) => SG.Argument({ name, optional });
  const withOptions = (options) => SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand')], options });
  const valuedOpt = () => SG.Opt({ name: ['-n', '--name'], arguments: [arg('value')] });
  const gm = SG.getMatchingSignatureForInput, gtk = SG.getMatchingSignatureForTokenizedInput;
  // root command
  { const [s, i] = gm('test_command ', reg(SG.Command({ name: 'test_command' }))); eq(s.name, 'test_command'); eq(i, 0); }
  // root with argument
  { const [s, i] = gm('test_command some_arg_value ', reg(SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand')], arguments: [arg('arg1')] }))); eq(s.name, 'test_command'); eq(i, 0); }
  // subcommand
  { const [s, i] = gm('test_command test_subcommand ', reg(SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand')], arguments: [arg('arg1')] }))); eq(s.name, 'test_subcommand'); eq(i, 1); }
  // subcommand with argument
  { const cmd = SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand1', [arg('a')]), sub('test_subcommand2', [arg('a')])], arguments: [arg('test_command_arg')] });
    const [s, i] = gm('test_command test_subcommand1 some_arg_value ', reg(cmd)); eq(s.name, 'test_subcommand1'); eq(i, 1); }
  // no trailing whitespace -> parent
  { const [s, i] = gm('test_command test_subcommand', reg(SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand')], arguments: [arg('arg1')] }))); eq(s.name, 'test_command'); eq(i, 0); }
  // tokenized + trailing
  { const cmd = SG.Command({ name: 'test_command', subcommands: [sub('test_subcommand1', [arg('a')]), sub('test_subcommand2', [arg('a')])], arguments: [arg('x')] });
    const [s, i] = gtk(['test_command', 'test_subcommand1', 'some_arg_value'], true, reg(cmd)); eq(s.name, 'test_subcommand1'); eq(i, 1); }
  // skip valued flag before subcommand
  { const [s, i] = gtk(['test_command', '-n', 'val', 'test_subcommand'], true, reg(withOptions([valuedOpt()]))); eq(s.name, 'test_subcommand'); eq(i, 3); }
  // skip two valued flags
  { const opts = [SG.Opt({ name: ['--context'], arguments: [arg('context')] }), valuedOpt()];
    const [s, i] = gtk(['test_command', '--context', 'staging', '-n', 'project1', 'test_subcommand'], true, reg(withOptions(opts))); eq(s.name, 'test_subcommand'); eq(i, 5); }
  // switch flag (no args)
  { const [s, i] = gtk(['test_command', '--verbose', 'test_subcommand'], true, reg(withOptions([SG.Opt({ name: ['--verbose'], arguments: [] })]))); eq(s.name, 'test_subcommand'); eq(i, 2); }
  // valued flag at end, no value -> no panic, parent
  { const [s, i] = gtk(['test_command', '-n'], true, reg(withOptions([valuedOpt()]))); eq(s.name, 'test_command'); eq(i, 0); }
  // unrecognized flag skipped
  { const [s, i] = gtk(['test_command', '--unknown-flag', 'test_subcommand'], true, reg(withOptions([]))); eq(s.name, 'test_subcommand'); eq(i, 2); }
  // flag arg consumes token matching subcommand name
  { const [s, i] = gtk(['test_command', '-n', 'test_subcommand', 'extra'], true, reg(withOptions([valuedOpt()]))); eq(s.name, 'test_command'); eq(i, 0); }
  // only flags, no subcommand
  { const [s, i] = gtk(['test_command', '-n', 'val'], true, reg(withOptions([valuedOpt()]))); eq(s.name, 'test_command'); eq(i, 0); }
  // optional flag arg not consumed
  { const opt = SG.Opt({ name: ['--output'], arguments: [arg('format'), arg('extra', true)] });
    const [s, i] = gtk(['test_command', '--output', 'json', 'test_subcommand'], true, reg(withOptions([opt]))); eq(s.name, 'test_subcommand'); eq(i, 3); }

  // ---- warp_util::local_or_remote_path (local_or_remote_path_tests.rs, unix variants) ----
  const WU = require('../src/crates/warp_util');
  const { LocalOrRemotePath: LRP, RemotePath: RP, HostId: HID, StandardizedPath: SPth } = WU;
  const hostId = () => HID.new('test-host');
  // local helpers
  {
    const lf = '/repo/file.txt';
    const p = LRP.Local(lf);
    eq(p.displayName(), 'file.txt');
    ok(p.pathComponent().equals(SPth.fromLocalAbsoluteUnchecked(lf)), 'local path_component');
    eq(p.displayPath(), lf);
    eq(p.toLocalPath(), lf);
  }
  // remote helpers
  {
    const p = LRP.Remote(RP.new(hostId(), SPth.tryNew('/tmp/repo/file.txt')));
    eq(p.displayName(), 'file.txt');
    ok(p.pathComponent().equals(SPth.tryNew('/tmp/repo/file.txt')), 'remote path_component');
    eq(p.displayPath(), '/tmp/repo/file.txt');
    eq(p.toLocalPath(), null);
  }
  // is_local / is_remote
  {
    const local = LRP.Local('/repo');
    const remote = LRP.Remote(RP.new(hostId(), SPth.tryNew('/tmp/repo')));
    ok(local.isLocal() && !local.isRemote() && !remote.isLocal() && remote.isRemote(), 'classify variants');
  }
  // join preserves host for remote
  {
    const local = LRP.Local('/repo');
    const remote = LRP.Remote(RP.new(hostId(), SPth.tryNew('/repo')));
    ok(local.join('src/foo.rs').pathComponent().equals(SPth.fromLocalAbsoluteUnchecked('/repo/src/foo.rs')), 'local join');
    ok(local.join('src/foo.rs').isLocal());
    const rj = remote.join('src/foo.rs');
    ok(rj.pathComponent().equals(SPth.tryNew('/repo/src/foo.rs')) && rj.isRemote(), 'remote join');
    ok(rj.asRemote().host_id.equals(hostId()), 'join preserves host');
  }
  // join with absolute replaces prefix
  {
    const local = LRP.Local('/repo');
    const remote = LRP.Remote(RP.new(hostId(), SPth.tryNew('/some/repo')));
    ok(local.join('/server/repo/src/foo.rs').pathComponent().equals(SPth.fromLocalAbsoluteUnchecked('/server/repo/src/foo.rs')), 'local abs join');
    ok(remote.join('/server/repo/src/foo.rs').pathComponent().equals(SPth.tryNew('/server/repo/src/foo.rs')), 'remote abs join');
  }
  // strip_repo_prefix local/local
  {
    const repo = LRP.Local('/repo');
    eq(repo.strip_repo_prefix(LRP.Local('/repo/src/foo.rs')), 'src/foo.rs', 'strip inside');
    eq(repo.strip_repo_prefix(LRP.Local('/server/repo/src/foo.rs')), null, 'strip outside');
  }
  // strip_repo_prefix requires same host
  {
    const a = HID.new('host-a'), b = HID.new('host-b');
    const repoA = LRP.Remote(RP.new(a, SPth.tryNew('/repo')));
    eq(repoA.strip_repo_prefix(LRP.Remote(RP.new(HID.new('host-a'), SPth.tryNew('/repo/src/foo.rs')))), 'src/foo.rs', 'same host strip');
    eq(repoA.strip_repo_prefix(LRP.Remote(RP.new(b, SPth.tryNew('/repo/src/foo.rs')))), null, 'cross-host rejected');
    eq(repoA.strip_repo_prefix(LRP.Local('/repo/src/foo.rs')), null, 'local-vs-remote rejected');
  }
  // strip_repo_prefix rejects sibling dirs (/repository vs /repo)
  {
    const host = HID.new('host');
    const repo = LRP.Remote(RP.new(host, SPth.tryNew('/repo')));
    eq(repo.strip_repo_prefix(LRP.Remote(RP.new(HID.new('host'), SPth.tryNew('/repository/src/foo.rs')))), null, 'sibling dir not inside repo');
  }

  // ---- warp_util::path (path_tests.rs, unix variants) ----
  const PU = require('../src/crates/warp_util').pathUtil;
  // user_friendly_path
  eq(PU.userFriendlyPath('/Users/blue', '/Users/blue'), '~');
  eq(PU.userFriendlyPath('/Users/blue/warp', '/Users/blue'), '~/warp');
  eq(PU.userFriendlyPath('/Users/admin/warp', '/Users/blue'), '/Users/admin/warp');
  // to_relative_path
  eq(PU.toRelativePath(false, '/Users/john/projects/app/src/main.rs', '/Users/john/projects'), 'app/src/main.rs');
  eq(PU.toRelativePath(false, '/Users/john/projects', '/Users/john/projects'), '.');
  eq(PU.toRelativePath(false, '/Users/john', '/Users/john/projects'), '..');
  eq(PU.toRelativePath(false, '/Users', '/Users/john/projects'), '../..');
  eq(PU.toRelativePath(false, '/Users/john/documents/file.txt', '/Users/john/projects'), '../documents/file.txt');
  eq(PU.toRelativePath(false, '/var/log/system.log', '/'), 'var/log/system.log');
  eq(PU.toRelativePath(false, '/home/user/file.txt', '/home'), 'user/file.txt');
  // posix escape
  const PX = PU.ShellFamily.Posix, PS = PU.ShellFamily.PowerShell;
  eq(PU.escape(PX, '~/test_dir/library% 1$2'), '\\~/test_dir/library%\\ 1\\$2');
  eq(PU.escape(PX, 'あい'), 'あい');
  eq(PU.escape(PX, 'abc \n \t'), 'abc\\ \\\n\\ \\\t');
  eq(PU.escape(PX, ''), "''");
  eq(PU.escape(PX, "foo '\"' bar"), "foo\\ \\'\\\"\\'\\ bar");
  // powershell escape
  eq(PU.escape(PS, '~/test_dir/library% 1$2'), '~/test_dir/library%` 1`$2');
  eq(PU.escape(PS, 'abc \n \t'), 'abc` `\n` `\t');
  eq(PU.escape(PS, "foo '\"' bar"), "foo` `'`\"`'` bar");
  // posix unescape
  eq(PU.unescape(PX, 'my\\ file.txt'), 'my file.txt');
  eq(PU.unescape(PX, 'path/to/my\\ file\\ \\(1\\).txt'), 'path/to/my file (1).txt');
  eq(PU.unescape(PX, 'simple.txt'), 'simple.txt');
  eq(PU.unescape(PX, 'trailing\\'), 'trailing\\');
  { const orig = "hello world $HOME 'quotes'"; eq(PU.unescape(PX, PU.escape(PX, orig)), orig, 'posix roundtrip'); }
  // powershell unescape
  eq(PU.unescape(PS, 'my` file.txt'), 'my file.txt');
  eq(PU.unescape(PS, 'path` `$var'), 'path $var');
  { const orig = 'hello world $HOME'; eq(PU.unescape(PS, PU.escape(PS, orig)), orig, 'powershell roundtrip'); }
  // normalize_relative_path_for_glob
  eq(PU.normalizeRelativePathForGlob('app/src/main.rs'), 'app/src/main.rs');
  eq(PU.normalizeRelativePathForGlob('./app/src/main.rs'), 'app/src/main.rs');
  eq(PU.normalizeRelativePathForGlob('../app/src/main.rs'), 'app/src/main.rs');
  eq(PU.normalizeRelativePathForGlob('..'), '');
  eq(PU.normalizeRelativePathForGlob(''), '');
  // is_posix_portable_pathname
  ok(PU.isPosixPortablePathname('a/b-c/d_e.txt'), 'portable name');
  ok(!PU.isPosixPortablePathname('a/b c'), 'space not portable');
  // common_path
  eq(PU.commonPath(['/foo/bar/baz', '/foo/bar/quux', '/foo/bar/quuux']), '/foo/bar', 'common path');
  eq(PU.commonPath(['/foo/bar', '/baz/qux']), null, 'no common path');

  // ---- repo_metadata::file_tree_update flatten (file_tree_update_tests.rs) ----
  const RM = require('../src/crates/repo_metadata');
  const SPx = require('../src/crates/warp_util').StandardizedPath;
  const stdp = (p) => SPx.fromLocalAbsoluteUnchecked(p);
  const rmFile = (p) => RM.Entry.File(RM.FileMetadata({ path: stdp(p), extension: (p.match(/\.([^.\/]+)$/) || [])[1] || null, ignored: false }));
  const rmDir = (p, children) => RM.Entry.Directory(RM.DirectoryEntry({ path: stdp(p), children, ignored: false, loaded: true }));
  const ignoredFile = (p) => RM.Entry.File(RM.FileMetadata({ path: stdp(p), extension: null, ignored: true }));
  // flatten_single_file
  { const md = RM.flattenEntryMetadata(rmFile('/repo/src/main.rs'));
    eq(md.length, 1); ok(md[0].kind === 'File' && md[0].path.equals(stdp('/repo/src/main.rs')), 'single file'); }
  // flatten_directory depth-first pre-order
  {
    const entry = rmDir('/repo/src', [
      rmDir('/repo/src/components', [rmFile('/repo/src/components/button.rs'), rmFile('/repo/src/components/modal.rs')]),
      rmFile('/repo/src/main.rs'),
    ]);
    const md = RM.flattenEntryMetadata(entry);
    eq(md.length, 5, 'depth-first count');
    ok(md[0].kind === 'Directory' && md[0].path.equals(stdp('/repo/src')), 'm0 dir src');
    ok(md[1].kind === 'Directory' && md[1].path.equals(stdp('/repo/src/components')), 'm1 dir components');
    ok(md[2].kind === 'File' && md[2].path.equals(stdp('/repo/src/components/button.rs')), 'm2 button');
    ok(md[3].kind === 'File' && md[3].path.equals(stdp('/repo/src/components/modal.rs')), 'm3 modal');
    ok(md[4].kind === 'File' && md[4].path.equals(stdp('/repo/src/main.rs')), 'm4 main');
  }
  // flatten_preserves_ignored_flag
  { const md = RM.flattenEntryMetadata(rmDir('/repo', [ignoredFile('/repo/secret.env')]));
    eq(md.length, 2); ok(md[1].kind === 'File' && md[1].ignored === true, 'ignored flag preserved'); }

  // ---- repo_metadata::standing_queries (standing_queries_tests.rs) ----
  const SQ = require('../src/crates/repo_metadata').standingQueries;
  const SPq = require('../src/crates/warp_util').StandardizedPath;
  const os = require('os'), pth = require('path');
  const repoPath = (p) => pth.join(os.tmpdir(), 'repo_metadata_standing_queries_tests', p);
  const standardized = (p) => SPq.fromLocalAbsoluteUnchecked(p);
  const defs = () => { const d = new SQ.StandingQueryDefinitions(); d.setProjectSkillProviderPaths(['.agents/skills']); return d; };
  const hasContent = (list, c) => list.some((x) => x.path.equals(c.path) && x.is_directory === c.is_directory);
  // records_provider_skill_files_and_project_rules
  {
    const d = defs(); const results = new SQ.StandingQueryResults();
    const provider = repoPath('.agents/skills'), skill = repoPath('.agents/skills/review/SKILL.md');
    const rootRule = repoPath('WARP.md'), nestedRule = repoPath('packages/api/AGENTS.md');
    results.recordPath(provider, true, d); results.recordPath(skill, false, d);
    results.recordPath(rootRule, false, d); results.recordPath(nestedRule, false, d);
    ok(hasContent(results.projectSkills(), SQ.StandingQueryContent.directory(standardized(provider))), 'provider dir recorded');
    ok(hasContent(results.projectSkills(), SQ.StandingQueryContent.file(standardized(skill))), 'skill file recorded');
    ok(hasContent(results.projectRules(), SQ.StandingQueryContent.file(standardized(rootRule))), 'root rule recorded');
    ok(hasContent(results.projectRules(), SQ.StandingQueryContent.file(standardized(nestedRule))), 'nested rule recorded');
  }
  // replacing_removed_direct_skill_child_can_reupsert_provider_for_hydration
  {
    const d = defs();
    const providerPath = repoPath('.agents/skills'), skillPath = repoPath('.agents/skills/review/SKILL.md'), removedDir = repoPath('.agents/skills/review');
    const provider = SQ.StandingQueryContent.directory(standardized(providerPath));
    const skill = SQ.StandingQueryContent.file(standardized(skillPath));
    const results = new SQ.StandingQueryResults();
    results.insertProjectSkill(provider); results.insertProjectSkill(skill);
    const discovered = new SQ.StandingQueryResults();
    discovered.recordDirectProjectSkillProviderChildChange(removedDir, d);
    const delta = results.replaceSubtrees([standardized(removedDir)], discovered);
    eq(delta.removed_project_skills.length, 1); ok(delta.removed_project_skills[0].path.equals(skill.path), 'removed skill');
    eq(delta.upserted_project_skills.length, 1); ok(delta.upserted_project_skills[0].path.equals(provider.path), 'upserted provider');
    ok(hasContent(results.projectSkills(), provider), 'provider retained');
    ok(!results.projectSkills().some((c) => c.path.equals(skill.path)), 'skill removed');
  }
  // support_file_beneath_skill_does_not_synthesize_provider_update
  {
    const d = defs(); const results = new SQ.StandingQueryResults();
    results.recordPath(repoPath('.agents/skills/review/README.md'), false, d);
    eq(results.projectSkills().length, 0, 'support file does not record a skill');
  }

  // ---- ai::changed_files (changed_files_tests.rs) ----
  const { ChangedFiles } = require('../src/crates/ai');
  const mk = (del = [], ups = []) => { const c = new ChangedFiles(); del.forEach((p) => c.deletions.add(p)); ups.forEach((p) => c.upsertions.add(p)); return c; };
  const setEq = (s, arr) => { eq(s.size, arr.length); arr.forEach((x) => ok(s.has(x), 'has ' + x)); };
  // basic non-conflicting merge
  { const a = mk(['a'], ['b']); a.mergeSubsequent(mk(['c'], ['d'])); setEq(a.deletions, ['a', 'c']); setEq(a.upsertions, ['b', 'd']); }
  // delete then upsert
  { const a = mk(['file1'], []); a.mergeSubsequent(mk([], ['file1'])); setEq(a.deletions, []); setEq(a.upsertions, ['file1']); }
  // upsert then delete
  { const a = mk([], ['file1']); a.mergeSubsequent(mk(['file1'], [])); setEq(a.upsertions, []); setEq(a.deletions, ['file1']); }
  // delete then delete
  { const a = mk(['file1'], []); a.mergeSubsequent(mk(['file1'], [])); setEq(a.deletions, ['file1']); setEq(a.upsertions, []); }
  // upsert then upsert
  { const a = mk([], ['file1']); a.mergeSubsequent(mk([], ['file1'])); setEq(a.upsertions, ['file1']); setEq(a.deletions, []); }
  // empty merges
  { const a = mk(['file2'], ['file1']); a.mergeSubsequent(mk()); setEq(a.upsertions, ['file1']); setEq(a.deletions, ['file2']); }
  { const a = mk(); a.mergeSubsequent(mk(['file4'], ['file3'])); setEq(a.upsertions, ['file3']); setEq(a.deletions, ['file4']); }
  // multiple sequential merges
  { const a = mk(['b'], ['a']); a.mergeSubsequent(mk(['a', 'c'], ['b'])); setEq(a.upsertions, ['b']); setEq(a.deletions, ['a', 'c']);
    a.mergeSubsequent(mk(['d'], ['c'])); setEq(a.upsertions, ['b', 'c']); setEq(a.deletions, ['a', 'd']); }
  // rename then delete
  { const a = mk(['a'], ['b']); a.mergeSubsequent(mk(['b'], [])); setEq(a.deletions, ['a', 'b']); setEq(a.upsertions, []); }
  // upsert then rename
  { const a = mk([], ['a']); a.mergeSubsequent(mk(['a'], ['b'])); setEq(a.deletions, ['a']); setEq(a.upsertions, ['b']); }
  // rename then rename
  { const a = mk(['a'], ['b']); a.mergeSubsequent(mk(['b'], ['c'])); setEq(a.deletions, ['a', 'b']); setEq(a.upsertions, ['c']); }

  // ---- ai::search_shaping (search_shaping_tests.rs) ----
  const SS = require('../src/crates/ai').searchShaping;
  const CH = SS.ContentHash;
  const meta = (p, range, startLine, endLine) => ({ absolute_path: p, location: { start_line: startLine, end_line: endLine, byte_range: range } });
  const frag = (content, p, range) => ({ content, content_hash: CH.fromContent(content), location: { absolute_path: p, byte_range: range } });
  const br = (start, end) => ({ start, end });
  // builds_fragments_from_exact_byte_ranges
  {
    const p = '/repo/src/lib.rs', content = 'before\nneedle\nπ-after', fc = 'needle';
    const start = Buffer.from(content, 'utf8').indexOf(Buffer.from(fc)), end = start + Buffer.byteLength(fc);
    const hash = CH.fromContent(fc);
    const r = SS.buildFragmentsFromFileContents([[hash, meta(p, br(start, end), 2, 2)]], new Map([[p, content]]));
    eq(r.fail_to_read.length, 0); eq(r.successfully_read.length, 1);
    eq(r.successfully_read[0].content, fc); eq(r.successfully_read[0].content_hash, hash); eq(r.successfully_read[0].location.absolute_path, p);
  }
  // rejects_invalid_hashes_and_byte_ranges (π is 2 bytes at 3..5; range 4..5 splits it)
  {
    const p = '/repo/src/lib.rs', content = 'abcπdef';
    const r = SS.buildFragmentsFromFileContents([
      [CH.fromContent('not abc'), meta(p, br(0, 3), 1, 1)],
      [CH.fromContent('π'), meta(p, br(4, 5), 1, 1)],
    ], new Map([[p, content]]));
    eq(r.successfully_read.length, 0); eq(r.fail_to_read.length, 2); eq(r.fail_to_read_path, [p]);
  }
  // shapes_fragments_into_merged_context_locations
  {
    const p = '/repo/src/lib.rs';
    const fa = frag('a', p, br(0, 1)), fb = frag('b', p, br(2, 3));
    const metaByHash = new Map([[fa.content_hash, [meta(p, br(0, 1), 10, 12)]], [fb.content_hash, [meta(p, br(2, 3), 15, 17)]]]);
    const r = SS.fragmentsToContextLocations([fa, fb], (h) => metaByHash.get(h) || null, 2);
    eq(r.length, 1); eq(r[0].kind, 'Fragment'); eq(r[0].path, p); eq(r[0].line_ranges, [[8, 20]], 'merged context range');
  }
  // falls_back_to_whole_file_when_metadata_is_missing
  {
    const p = '/repo/src/lib.rs';
    const r = SS.fragmentsToContextLocations([frag('a', p, br(0, 1))], () => null, 2);
    eq(r.length, 1); eq(r[0], { kind: 'WholeFile', path: p }, 'whole-file fallback');
  }

  // ---- ai::skills/parser (parser_tests.rs) ----
  const SP2 = require('../src/crates/ai').skillsParser;
  const pm = SP2.parseMarkdownContent;
  // without front matter
  { const c = '# Hello World\n\nThis is just markdown content without front matter.\n';
    const r = pm(c); eq(Object.keys(r.front_matter).length, 0); eq(r.content, c); eq(r.line_range, null); }
  // empty front matter (---\n---) doesn't match -> no front matter
  { const c = '---\n---\n\n# Content\n'; const r = pm(c); eq(Object.keys(r.front_matter).length, 0); eq(r.content, c); }
  // CRLF
  { const c = '---\r\nname: test-skill\r\ndescription: Test description\r\n---\r\n\r\n# Content\r\n';
    const r = pm(c); eq(Object.keys(r.front_matter).length, 2); eq(r.front_matter.name, 'test-skill');
    eq(r.front_matter.description, 'Test description'); eq(r.content, c); eq(r.line_range, [5, 7]); }
  // trailing spaces after delimiters
  { const c = '---   \nname: test-skill\ndescription: Test description\n---  \t \n\n# Content\n';
    const r = pm(c); eq(r.front_matter.name, 'test-skill'); eq(r.front_matter.description, 'Test description'); }
  // extra blank lines in front matter
  { const c = '---\n\nname: test-skill\ndescription: Test description\n\n---\n\n# Content\n';
    const r = pm(c); eq(Object.keys(r.front_matter).length, 2); eq(r.front_matter.name, 'test-skill'); ok(r.content.includes('# Content')); }
  // mixed CRLF and extra whitespace
  { const c = '---  \r\n\r\nname: test-skill\r\ndescription: Test description\r\n\r\n---\t\r\n\r\n# Content\r\n';
    const r = pm(c); eq(r.front_matter.name, 'test-skill'); eq(r.front_matter.description, 'Test description'); }
  // tabs and spaces
  { const c = '---\t  \t\nname: test-skill\ndescription: Test description\n--- \t\n\n# Content\n';
    const r = pm(c); eq(r.front_matter.name, 'test-skill'); }
  // CRLF without proper front matter
  { const c = '# Hello World\r\n\r\nThis is just markdown content.\r\n';
    const r = pm(c); eq(Object.keys(r.front_matter).length, 0); eq(r.content, c); }
  // leading whitespace before front matter -> line_range 7..9
  { const c = '\n\n---\nname: test-skill\ndescription: Test description\n---\n\n# Content\n';
    const r = pm(c); eq(r.front_matter.name, 'test-skill'); eq(r.front_matter.description, 'Test description'); eq(r.line_range, [7, 9]); }
  // spaces and newlines before front matter
  { const c = '  \n\t\n---\nname: test-skill\ndescription: Test description\n---\n\n# Content\n';
    const r = pm(c); eq(r.front_matter.name, 'test-skill'); }
  // content includes front matter + line_range 5..9
  { const c = '---\nname: my-skill\ndescription: My skill description\n---\n\n# My Skill\n\nThis is the skill content.\n';
    const r = pm(c); eq(Object.keys(r.front_matter).length, 2); eq(r.front_matter.name, 'my-skill');
    eq(r.front_matter.description, 'My skill description'); eq(r.content, c); eq(r.line_range, [5, 9]); }

  // ---- ai::chunker/naive (naive_tests.rs) ----
  const CK = require('../src/crates/ai').chunkerNaive;
  const linesArr = (s) => { const p = s.split('\n'); if (p[p.length - 1] === '') p.pop(); return p; };
  // test_chunker (one line per chunk)
  {
    const code = "This is some text content\nthat should be chunked\nusing the naive chunker\nbecause the language isn't recognized.";
    const frags = CK.chunkCode(code, 'test_file.xyz', 10000, 1);
    const lines = linesArr(code);
    eq(frags.length, lines.length, 'one fragment per line');
    lines.forEach((line, idx) => { eq(frags[idx].content, line); eq(frags[idx].start_line, idx); eq(frags[idx].end_line, idx); });
  }
  // test_chunker_large_chunk (all lines in one fragment)
  {
    const code = "This is some text content\nthat should be chunked\nusing the naive chunker\nbecause the language isn't recognized.";
    const frags = CK.chunkCode(code, 'test_file.xyz', 10000, 100);
    eq(frags.length, 1); eq(frags[0].content, code); eq(frags[0].start_line, 0); eq(frags[0].end_line, linesArr(code).length - 1);
  }
  // test_chunker_max_bytes (over-long last line split + coalesce)
  {
    const code = 'line1\nline2\nline3\nline4abcdefghijklmnopqrstuvwxyz';
    const maxBytes = 25;
    const frags = CK.chunkCode(code, 'test_file.xyz', maxBytes, 1000);
    ok(frags.length > 1, 'multiple chunks');
    frags.forEach((f) => ok(Buffer.byteLength(f.content.trim()) <= maxBytes, 'within byte limit'));
    eq(frags[0].content, 'line1\nline2\nline3', 'coalesced leading lines');
    eq(frags[1].content, 'line4abcdefghijklmnopqrst', 'first split of long line');
    eq(frags[2].content, 'uvwxyz', 'second split of long line');
    eq(frags.map((f) => f.content).join('').replace(/\n/g, ''), code.replace(/\n/g, ''), 'reassembles');
  }
  // test_utf8_emoji_chunking (byte boundaries respected through 4-byte emoji)
  {
    const code = 'Hello 🦀 Rust\nWorld 🌍 Test\n🚀 Rocket 🎯 Target';
    const maxBytes = 15;
    const frags = CK.chunkCode(code, 'test_emoji.txt', maxBytes, 1000);
    ok(frags.length > 1, 'multiple emoji chunks');
    frags.forEach((f) => { ok(Buffer.byteLength(f.content) <= maxBytes, 'emoji chunk within limit'); ok(!f.content.includes('�'), 'valid UTF-8 (no replacement char)'); });
    eq(frags.map((f) => f.content).join('').replace(/\n/g, ''), code.replace(/\n/g, ''), 'emoji reassembles');
  }

  // ---- editor::render/model/offset_map (offset_map_tests.rs, pure cases) ----
  const ED = require('../src/crates/editor');
  const run = (content_start, frame_start, length) => ED.SelectableTextRun({ content_start, frame_start, length });
  // test_offset_map_basic
  {
    const map = ED.OffsetMap.new([run(12, 0, 10)]);
    eq(map.toContent(4), 16, 'content adjusted by content_start');
    eq(map.toContent(12), 22, 'clamp to run bounds');
  }
  // test_offset_map_placeholders
  {
    const map = ED.OffsetMap.new([run(0, 0, 0), run(1, 6, 8), run(10, 24, 4)]);
    eq(map.toContent(2), 0); eq(map.toContent(4), 1);
    eq(map.toFrame(0), 0); eq(map.toFrame(1), 6);
    eq(map.toContent(7), 2); eq(map.toFrame(2), 7);
    eq(map.toContent(16), 9); eq(map.toContent(20), 10);
    eq(map.toFrame(9), 14); eq(map.toFrame(10), 24);
    eq(map.toContent(28), 14); eq(map.toContent(50), 14); eq(map.toFrame(14), 28);
  }

  // ---- vim::matching_brackets (matching_brackets_tests.rs) ----
  const VIM = require('../src/crates/vim');
  const fmb = (buf, ch, off) => VIM.vimFindMatchingBracket(buf, VIM.BracketChar.fromChar(ch), off);
  eq(fmb('', '(', 0), null);
  eq(fmb('foo(bar)baz', '(', 3), 7);
  eq(fmb('foo(bar)baz', ')', 7), 3);
  eq(fmb('foo(bar)baz', '(', 8), null);
  eq(fmb('foo[bar]baz', '(', 3), null);
  eq(fmb('foo(bar(hello) world)baz', '(', 3), 20, 'nested forward');
  eq(fmb('foo(bar(hello) world)baz', ')', 20), 3, 'nested backward');
  eq(fmb('foo(bar(h[(])llo) world)baz', '(', 3), 23, 'mixed-bracket nesting');
  eq(fmb('function foo() {\necho hello world\necho hi\n}\nfoo', '{', 15), 42, 'curly across newlines');
  eq(fmb('function foo() {\necho hello world\necho hi\n}\nfoo', '}', 42), 15, 'curly backward across newlines');

  // ---- vim::paragraph_iterator (paragraph_iterator_tests.rs) ----
  const vps = VIM.findPreviousParagraphStart, vne = VIM.findNextParagraphEnd;
  // single paragraph: none both directions
  { const t = 'p1 line1\np1 line2\np1 line3'; const pos = t.indexOf('line2');
    eq(vps(t, pos), null); eq(vne(t, pos), null); }
  // single paragraph surrounded
  { const t = '\n\n\np1 line1\np1 line2\np1 line3\n\n\n'; const pos = t.indexOf('line2');
    const goalEnd = t.indexOf('line3') + 'line3'.length + 1;
    eq(vps(t, pos), 2); eq(vne(t, pos), goalEnd); }
  // next none in last paragraph, previous goes up
  { const t = 'p1\n\np2'; const p2 = t.indexOf('p2');
    eq(vps(t, p2), p2 - 1); eq(vps(t, p2 + 1), p2 - 1); eq(vne(t, p2), null); }
  // previous none in first paragraph, next goes down
  { const t = 'p1\n\np2'; const p1 = t.indexOf('p1');
    eq(vps(t, p1), null); eq(vne(t, p1), p1 + 'p1'.length + 1); eq(vne(t, p1 + 1), p1 + 'p1'.length + 1); }
  // three paragraphs, lots of newlines, middle para
  { const t = 'p1\n\n\n\n' + 'p2\n\n\n\n' + 'p3'; const p2 = t.indexOf('p2');
    eq(vps(t, p2), p2 - 1); eq(vne(t, p2), p2 + 'p2'.length + 1); }
  // cursor in middle of newline patch (quad+ runs)
  { const t = 'p1\n\n\n\n\n\n' + 'p2\n\n\n\n\n\n' + 'p3';
    const between12 = 'p1'.length + 3; const p2 = t.indexOf('p2'); const between23 = p2 + 'p2'.length + 3;
    eq(vps(t, between12), null); eq(vne(t, between12), p2 + 'p2'.length + 1);
    eq(vps(t, between23), p2 - 1); eq(vne(t, between23), null); }

  // ---- vim::find_char (behavior from the documented f/F/t/T diagram in find_char.rs) ----
  const vfc = VIM.vimFindCharOnLine;
  const motion = (direction, destination, c, is_repetition = false) => ({ direction, destination, is_repetition, c });
  const D = VIM.Direction, FC = VIM.FindCharDestination;
  // line "abcdefgh", cursor on 'd' (column 3)
  const line = 'abcdefgh';
  eq(vfc(line, 3, motion(D.Forward, FC.AtChar, 'f'), 1, false), 5, 'f -> lands on f (col 5)');
  eq(vfc(line, 3, motion(D.Backward, FC.AtChar, 'b'), 1, false), 1, 'F -> lands on b (col 1)');
  eq(vfc(line, 3, motion(D.Forward, FC.BeforeChar, 'f'), 1, false), 4, 't -> lands before f (col 4)');
  eq(vfc(line, 3, motion(D.Backward, FC.BeforeChar, 'b'), 1, false), 2, 'T -> lands after b (col 2)');
  // not found -> null
  eq(vfc(line, 3, motion(D.Forward, FC.AtChar, 'z'), 1, false), null, 'missing char -> none');
  // occurrence count: "aXbXcX", cursor col 0, 2nd 'X' forward
  eq(vfc('aXbXcX', 0, motion(D.Forward, FC.AtChar, 'X'), 2, false), 3, '2nd X forward (col 3)');
  // keep_selection adds 1 when moving forward
  eq(vfc(line, 3, motion(D.Forward, FC.AtChar, 'f'), 1, true), 6, 'f with keepSelection includes match');

  // ---- vim::word_iterator (word_iterator_tests.rs) ----
  const WI = VIM.wordIterator;
  const LINE = "impl<'a, T: TextBuffer + ?Sized + 'a>   Iterator for WordBoundariesVim";
  const wit = (off, dir, bound, type_) => WI.vimWordIteratorFromOffset(off, LINE, dir, bound, type_);
  const Dr = WI.Direction, Wb = WI.WordBound, Wt = WI.WordType;
  // test_word_forward_heads (w)
  eq(wit(0, Dr.Forward, Wb.Start, Wt.Default),
    [4, 6, 7, 9, 10, 12, 23, 25, 26, 32, 34, 35, 36, 40, 49, 53, 70], 'w from 0');
  eq(wit(15, Dr.Forward, Wb.Start, Wt.Default)[0], 23, 'w from 15');
  eq(wit(43, Dr.Forward, Wb.Start, Wt.Default)[0], 49, 'w from 43');
  eq(wit(38, Dr.Forward, Wb.Start, Wt.Default)[0], 40, 'w from 38');
  eq(wit(69, Dr.Forward, Wb.Start, Wt.Default), [70], 'w from 69');
  // test_word_forward_heads_including_symbols (W)
  eq(wit(0, Dr.Forward, Wb.Start, Wt.BigWord),
    [9, 12, 23, 25, 32, 34, 40, 49, 53, 70], 'W from 0');
  // test_word_backward_heads (ge)
  eq(wit(69, Dr.Backward, Wb.End, Wt.Default),
    [51, 47, 36, 35, 34, 32, 30, 25, 23, 21, 10, 9, 7, 6, 5, 3, 0], 'ge from 69');
  eq(wit(15, Dr.Backward, Wb.End, Wt.Default)[0], 10, 'ge from 15');
  eq(wit(43, Dr.Backward, Wb.End, Wt.Default)[0], 36, 'ge from 43');
  eq(wit(38, Dr.Backward, Wb.End, Wt.Default)[0], 36, 'ge from 38');
  eq(wit(0, Dr.Backward, Wb.End, Wt.Default), [0], 'ge from 0');

  // ---- vim::text_objects/quote (quote_tests.rs) ----
  const QT = VIM.quoteTextObject;
  const rng = (s, e) => ({ start: s, end: e });
  const aq = (buf, off, q) => QT.vimAQuote(buf, off, q);
  const iq = (buf, off, q) => QT.vimInnerQuote(buf, off, q);
  const Q = QT.QuoteType;
  // test_a_quote
  eq(aq('', 0, Q.Single), null);
  eq(aq("'foo'", 1, Q.Single), rng(0, 5)); eq(aq("'foo'", 0, Q.Single), rng(0, 5)); eq(aq("'foo'", 4, Q.Single), rng(0, 5));
  eq(aq("'foo'", 1, Q.Double), null);
  eq(aq("'foo'  ", 5, Q.Single), null);
  eq(aq("foo  'foo' ", 0, Q.Single), rng(5, 10));
  eq(aq('foo  "" ', 0, Q.Double), rng(5, 7));
  { const line = "  'foo'  'bar' 'baz";
    for (let i = 0; i <= 6; i++) eq(aq(line, i, Q.Single), rng(2, 7), 'a-quote ' + i);
    for (let i = 7; i <= 8; i++) eq(aq(line, i, Q.Single), rng(6, 10), 'a-quote ' + i);
    for (let i = 9; i <= 13; i++) eq(aq(line, i, Q.Single), rng(9, 14), 'a-quote ' + i);
    eq(aq(line, 14, Q.Single), rng(13, 16));
    for (let i = 15; i <= 18; i++) eq(aq(line, i, Q.Single), null, 'a-quote none ' + i); }
  // test_inner_quote
  eq(iq('', 0, Q.Single), null);
  eq(iq('`foo`', 1, Q.Backtick), rng(1, 4)); eq(iq('`foo`', 0, Q.Backtick), rng(1, 4));
  eq(iq("'foo'", 4, Q.Single), rng(1, 4));
  eq(iq("'foo'", 1, Q.Double), null);
  eq(iq("'foo'  ", 5, Q.Single), null);
  eq(iq("foo  'foo' ", 0, Q.Single), rng(6, 9));
  eq(iq('foo  "" ', 0, Q.Double), rng(6, 6));
  { const line = "  'foo'  'bar' 'baz";
    for (let i = 0; i <= 6; i++) eq(iq(line, i, Q.Single), rng(3, 6), 'inner-quote ' + i);
    for (let i = 7; i <= 8; i++) eq(iq(line, i, Q.Single), rng(7, 9), 'inner-quote ' + i);
    for (let i = 9; i <= 13; i++) eq(iq(line, i, Q.Single), rng(10, 13), 'inner-quote ' + i);
    eq(iq(line, 14, Q.Single), rng(14, 15));
    for (let i = 15; i <= 18; i++) eq(iq(line, i, Q.Single), null, 'inner-quote none ' + i); }

  // ---- vim::text_objects/paragraph (paragraph_tests.rs) ----
  const PTO = VIM.paragraphTextObject;
  const ip = (t, o) => PTO.vimInnerParagraph(t, o);
  const ap = (t, o) => PTO.vimAParagraph(t, o);
  const rg = (s, e) => ({ start: s, end: e });
  // empty buffer
  eq(ip('', 0), rg(0, 0)); eq(ip('', 1), null);
  eq(ap('', 0), rg(0, 0)); eq(ap('', 1), null);
  // single paragraph: ip/ap span the whole text on every non-newline char
  { const t = 'foo bar\nnext line\n'; const L = t.length;
    [...t].forEach((ch, i) => { if (ch !== '\n') { eq(ip(t, i), rg(0, L), 'ip single ' + i); eq(ap(t, i), rg(0, L), 'ap single ' + i); } }); }
  // two paragraphs (inner)
  { const t = 'first line\nof first para\n\nsecond para line\n'; const blank = t.indexOf('\n\n'); const s2 = blank + 2; const L = t.length;
    [...t].forEach((ch, i) => { if (i < blank && ch !== '\n') eq(ip(t, i), rg(0, blank), 'ip2a ' + i); });
    [...t].forEach((ch, i) => { if (i >= s2 && ch !== '\n') eq(ip(t, i), rg(s2, L), 'ip2b ' + i); }); }
  // three paragraphs (inner)
  { const t = 'first\n\nsecond\n\nthird\n'; const fb = t.indexOf('\n\n'); const sb = t.indexOf('\n\n', fb + 1); const s2 = fb + 2; const s3 = sb + 2; const L = t.length;
    [...t].forEach((ch, i) => { if (i < fb && ch !== '\n') eq(ip(t, i), rg(0, fb), 'ip3a ' + i); });
    [...t].forEach((ch, i) => { if (i >= s2 && i < sb && ch !== '\n') eq(ip(t, i), rg(s2, sb), 'ip3b ' + i); });
    [...t].forEach((ch, i) => { if (i >= s3 && ch !== '\n') eq(ip(t, i), rg(s3, L), 'ip3c ' + i); }); }
  // two paragraphs (a)
  { const t = 'first line\nof first para\n\nsecond para line\n'; const blank = t.indexOf('\n\n'); const s2 = blank + 2; const L = t.length;
    [...t].forEach((ch, i) => { if (i < blank && ch !== '\n') eq(ap(t, i), rg(0, blank + 1), 'ap2a ' + i); });
    [...t].forEach((ch, i) => { if (i >= s2 && ch !== '\n') eq(ap(t, i), rg(blank + 1, L), 'ap2b ' + i); }); }
  // three paragraphs (a)
  { const t = 'first\n\nsecond\n\nthird\n'; const fb = t.indexOf('\n\n'); const sb = t.indexOf('\n\n', fb + 1); const s2 = fb + 2; const s3 = sb + 2; const L = t.length;
    [...t].forEach((ch, i) => { if (i < fb && ch !== '\n') eq(ap(t, i), rg(0, fb + 1), 'ap3a ' + i); });
    [...t].forEach((ch, i) => { if (i >= s2 && i < sb && ch !== '\n') eq(ap(t, i), rg(s2, sb + 1), 'ap3b ' + i); });
    [...t].forEach((ch, i) => { if (i >= s3 && ch !== '\n') eq(ap(t, i), rg(sb + 1, L), 'ap3c ' + i); }); }
  // blank lines
  { const t = 'first\n\n\nsecond\n'; for (let o = 5; o <= 7; o++) eq(ip(t, o), rg(6, 7), 'ip blank ' + o); }
  { const t = 'first\n\n\nsecond\n'; for (let o = 5; o <= 7; o++) eq(ap(t, o), rg(6, t.length), 'ap blank ' + o); }
  // many trailing blank lines
  { const t = 'first\n\n\nsecond\n\n\n\n\nthird';
    for (let o = 0; o <= 4; o++) eq(ap(t, o), rg(0, 7), 'ap trail-a ' + o);
    for (let o = 8; o <= 13; o++) eq(ap(t, o), rg(8, 18), 'ap trail-b ' + o);
    for (let o = 19; o <= 23; o++) eq(ap(t, o), rg(15, 24), 'ap trail-c ' + o); }
  // lines with spaces count as content
  { const t = 'first\n\n    \nsecond'; eq(ap(t, 3), rg(0, 6), 'ap spaces a'); eq(ap(t, 14), rg(6, 18), 'ap spaces b'); }

  // ---- vim::text_objects/word (word_tests.rs, inner-word cases) ----
  const WTO = VIM.wordTextObject;
  const wdef = WI.WordType.Default;
  const iw = (t, o) => WTO.vimInnerWord(t, o, wdef);
  const wrg = (s, e) => ({ start: s, end: e });
  eq(iw('', 0), null);
  eq(iw('foo', 0), wrg(0, 3));
  eq(iw('foo<<?>>', 4), wrg(3, 8), 'symbols run');
  { const line = "impl<'a, T: TextBuffer + ?Sized + 'a>   Iterator for WordBoundariesVim {";
    for (let i = 0; i <= 3; i++) eq(iw(line, i), wrg(0, 4), 'iw ' + i);
    for (let i = 4; i <= 5; i++) eq(iw(line, i), wrg(4, 6), 'iw ' + i);
    eq(iw(line, 6), wrg(6, 7)); eq(iw(line, 7), wrg(7, 8)); eq(iw(line, 8), wrg(8, 9));
    eq(iw(line, 9), wrg(9, 10)); eq(iw(line, 10), wrg(10, 11));
    for (let i = 12; i <= 21; i++) eq(iw(line, i), wrg(12, 22), 'iw ' + i);
    eq(iw(line, 22), wrg(22, 23)); eq(iw(line, 23), wrg(23, 24));
    for (let i = 26; i <= 30; i++) eq(iw(line, i), wrg(26, 31), 'iw ' + i);
    for (let i = 37; i <= 39; i++) eq(iw(line, i), wrg(37, 40), 'iw ws ' + i);
    for (let i = 40; i <= 47; i++) eq(iw(line, i), wrg(40, 48), 'iw ' + i); }

  // ---- vim::text_objects/word: vim_a_word (word_tests.rs) ----
  const awd = (t, o) => WTO.vimAWord(t, o, wdef);
  eq(awd('', 0), null);
  eq(awd('foo', 0), wrg(0, 3));
  eq(awd('  foo', 0), wrg(0, 5)); eq(awd('  foo', 1), wrg(0, 5)); eq(awd('  foo', 3), wrg(0, 5));
  eq(awd('foo ', 1), wrg(0, 4), 'include trailing ws');
  eq(awd('foo  ', 1), wrg(0, 5));
  eq(awd('foo  ', 3), wrg(3, 5), 'cursor in ws -> ws+next');
  { const line = 'impl<T>  Thing<T> { fn foo(&self,foo   :&Foo, a:i32) {{{';
    for (let i = 0; i <= 3; i++) eq(awd(line, i), wrg(0, 4), 'aw ' + i);
    eq(awd(line, 4), wrg(4, 5)); }

  // ---- vim::text_objects/block (block_tests.rs) ----
  const BTO = VIM.blockTextObject;
  // Faithful port of the `unindent` crate (dtolnay) so the BLOCK offsets match the Rust test.
  const countSpaces = (line) => { for (let i = 0; i < line.length; i++) { if (line[i] !== ' ' && line[i] !== '\t') return i; } return null; };
  function unindent(s) {
    const ignoreFirst = s.startsWith('\n') || s.startsWith('\r\n');
    const lines = s.split('\n');
    let min = Infinity;
    for (let i = 1; i < lines.length; i++) { const c = countSpaces(lines[i]); if (c !== null) min = Math.min(min, c); }
    if (min === Infinity) min = 0;
    let out = '';
    for (let i = 0; i < lines.length; i++) {
      if (i > 1 || (i === 1 && !ignoreFirst)) out += '\n';
      if (i === 0) out += lines[i];
      else if (lines[i].length > min) out += lines[i].slice(min);
    }
    return out;
  }
  const BLOCK_RAW = [
    'match BracketChar::try_from(c) {',
    '        Ok(bracket) => todo!(),',
    '        Err(_) => {',
    '            let end_offset = vim_find_matching_bracket(',
    '                buffer,',
    '                BracketChar {',
    '                    end: BracketEnd::Opening,',
    '                    kind: bracket_kind,',
    '                },',
    '                offset,',
    '            )?;',
    '            let start_offset = vim_find_matching_bracket(',
    '                buffer,',
    '                BracketChar {',
    '                    end: BracketEnd::Closing,',
    '                    kind: bracket_kind,',
    '                },',
    '                end_offset,',
    '            )?;',
    '            Some(start_offset..end_offset)',
    '        }',
    '    }',
  ].join('\n');
  const block = unindent(BLOCK_RAW);
  const PAREN = 'Parenthesis', CURLY = 'CurlyBrace';
  const brg = (s, e) => ({ start: s, end: e });
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  // test_vim_a_block
  for (const i of range(27, 29)) eq(BTO.vimABlock(block, i, PAREN), brg(27, 30), 'a-block paren ' + i);
  for (const i of [...range(31, 74), ...range(573, 574)]) eq(BTO.vimABlock(block, i, CURLY), brg(31, 575), 'a-block curly-outer ' + i);
  for (const i of [...range(75, 172), ...range(266, 397), ...range(491, 572)]) eq(BTO.vimABlock(block, i, CURLY), brg(75, 573), 'a-block curly-mid ' + i);
  for (const i of range(173, 265)) eq(BTO.vimABlock(block, i, CURLY), brg(173, 266), 'a-block curly-inner1 ' + i);
  for (const i of range(398, 490)) eq(BTO.vimABlock(block, i, CURLY), brg(398, 491), 'a-block curly-inner2 ' + i);
  for (const i of range(39, 47)) eq(BTO.vimABlock(block, i, PAREN), brg(39, 48), 'a-block paren2 ' + i);
  for (const i of range(57, 58)) eq(BTO.vimABlock(block, i, PAREN), brg(57, 59), 'a-block paren3 ' + i);
  // test_vim_inner_block (false = `d`, true = `c`)
  for (const i of range(27, 29)) { eq(BTO.vimInnerBlock(block, i, PAREN, false), brg(28, 29)); eq(BTO.vimInnerBlock(block, i, PAREN, true), brg(28, 29)); }
  for (const i of [...range(31, 74), ...range(573, 574)]) { eq(BTO.vimInnerBlock(block, i, CURLY, false), brg(32, 573)); eq(BTO.vimInnerBlock(block, i, CURLY, true), brg(33, 573)); }
  for (const i of [...range(75, 172), ...range(266, 397), ...range(491, 572)]) { eq(BTO.vimInnerBlock(block, i, CURLY, false), brg(76, 567)); eq(BTO.vimInnerBlock(block, i, CURLY, true), brg(77, 567)); }
  for (const i of range(173, 265)) { eq(BTO.vimInnerBlock(block, i, CURLY, false), brg(174, 252)); eq(BTO.vimInnerBlock(block, i, CURLY, true), brg(175, 252)); }
  for (const i of range(398, 490)) { eq(BTO.vimInnerBlock(block, i, CURLY, false), brg(399, 477)); eq(BTO.vimInnerBlock(block, i, CURLY, true), brg(400, 477)); }
  for (const i of range(39, 47)) { eq(BTO.vimInnerBlock(block, i, PAREN, false), brg(40, 47)); eq(BTO.vimInnerBlock(block, i, PAREN, true), brg(40, 47)); }
  for (const i of range(57, 58)) { eq(BTO.vimInnerBlock(block, i, PAREN, false), brg(58, 58)); eq(BTO.vimInnerBlock(block, i, PAREN, true), brg(58, 58)); }

  // ---- vim::register (register.rs — behavior from source) ----
  eq(VIM.BLACK_HOLE_REGISTER, '_', 'black hole register');
  ok(VIM.validRegisterName('a') && VIM.validRegisterName('Z') && VIM.validRegisterName('+') && VIM.validRegisterName('*') && VIM.validRegisterName('"'), 'valid register names');
  ok(!VIM.validRegisterName('1') && !VIM.validRegisterName('_') && !VIM.validRegisterName('#'), 'invalid register names');

  // ---- languages::language_by_filename (lib_tests.rs, extension-resolution cases) ----
  const LANG = require('../src/crates/languages');
  // html_extensions_resolve_to_html / local
  for (const f of ['index.html', 'index.htm']) {
    eq(LANG.languageByLocalFilename('/tmp/' + f).display_name, 'HTML', f + ' -> HTML');
    eq(LANG.languageByLocalFilename(f).display_name, 'HTML', f + ' (local) -> HTML');
  }
  // command_extension_resolves_to_shell / local
  eq(LANG.languageByLocalFilename('/tmp/script.command').display_name, 'Shell', '.command -> Shell');
  eq(LANG.languageByLocalFilename('script.command').display_name, 'Shell', '.command (local) -> Shell');
  // a few more from the resolution table
  eq(LANG.languageByLocalFilename('main.rs').display_name, 'Rust');
  eq(LANG.languageByLocalFilename('app.tsx').display_name, 'TSX');
  eq(LANG.languageByLocalFilename('Dockerfile.dev').display_name, 'Dockerfile', 'Dockerfile variant');
  eq(LANG.languageByLocalFilename('.zshrc').display_name, 'Shell', 'zsh config -> Shell');
  eq(LANG.languageByLocalFilename('unknown.xyz'), null, 'unknown ext -> null');
  // normalize_language_name aliases
  eq(LANG.normalizeLanguageName('go'), 'golang'); eq(LANG.normalizeLanguageName('bash'), 'shell'); eq(LANG.normalizeLanguageName('tf'), 'hcl');

  // ---- lsp::config uri<->path (config_tests.rs, unix variants) ----
  const LSP = require('../src/crates/lsp');
  const u2p = LSP.lspUriToPath, p2u = LSP.pathToLspUri;
  // lsp_uri_to_path: basic + percent-decoding
  eq(u2p('file:///Users/test/project/src/main.rs'), '/Users/test/project/src/main.rs', 'uri basic');
  eq(u2p('file:///Users/test/node_modules/%40firebase/auth/dist/index.d.ts'), '/Users/test/node_modules/@firebase/auth/dist/index.d.ts', 'decode @');
  eq(u2p('file:///Users/test/My%20Project/src/main.rs'), '/Users/test/My Project/src/main.rs', 'decode space');
  eq(u2p('file:///Users/test/%40scope/my%20package%23v1/index.ts'), '/Users/test/@scope/my package#v1/index.ts', 'decode multiple');
  // path_to_lsp_uri: basic + encoding
  eq(p2u('/Users/test/project/src/main.rs'), 'file:///Users/test/project/src/main.rs', 'path basic');
  eq(p2u('/Users/test/My Project/src/main.rs'), 'file:///Users/test/My%20Project/src/main.rs', 'encode space');
  ok(p2u('/Users/관리자/project/src/main.rs').startsWith('file:///Users/%'), 'encode non-ascii');
  ok(p2u('/Users/José/project/src/main.rs').startsWith('file:///Users/Jos%'), 'encode accent');
  eq(p2u('/Users/test/my#project/src/main.rs'), 'file:///Users/test/my%23project/src/main.rs', 'encode hash');
  eq(p2u('/Users/test/routes/blog/[slug].tsx'), 'file:///Users/test/routes/blog/%5Bslug%5D.tsx', 'encode brackets');
  // roundtrips
  for (const orig of ['/Users/test/project/src/main.rs', '/Users/관리자/project/src/main.rs', '/Users/test/My Project/src/main.rs', '/Users/test/routes/[id]/[slug].tsx']) {
    eq(u2p(p2u(orig)), orig, 'roundtrip ' + orig);
  }
  // non-file scheme rejected
  { let threw = false; try { u2p('http://example.com/x'); } catch { threw = true; } ok(threw, 'non-file scheme rejected'); }

  // ---- warp_terminal::shell/unescape (unescape.rs) ----
  const uq = require('../src/crates/warp_terminal').unescapeQuotes;
  // test_unescape_quotes
  eq(uq('東方'), '東方');
  eq(uq("$'\\\"\\\"'"), '""', 'ansi-c escaped quotes');
  eq(uq("'\"'"), '"', 'single-quote literal');
  eq(uq("$'foo\"barbaz\\'quux'"), "foo\"barbaz'quux", 'ansi-c mixed');
  eq(uq("$'\\a\\b\\v\\f\\n\\r\\t\\e\\E'"), '\x07\x08\x0b\x0c\x0a\x0d\x09\x1b\x1b', 'all ansi-c escapes');
  { let threw = false; try { uq("$'\\"); } catch { threw = true; } ok(threw, 'trailing escape errors'); }
  eq(uq("'echo '\\''hello\\nworld'\\'"), "echo 'hello\\nworld'", 'literal escape outside quote');
  // test_unescape_double_quotes
  eq(uq('"hello world"'), 'hello world');
  eq(uq('"hello\\$world"'), 'hello$world', 'double-quote \\$');
  eq(uq('"hello\\`world"'), 'hello`world', 'double-quote \\`');
  eq(uq('"hello\\"world"'), 'hello"world', 'double-quote \\"');
  eq(uq('"hello\\\\world"'), 'hello\\world', 'double-quote \\\\');
  // test_unescape_double_quotes_nonspecial_chars
  eq(uq('"hello\\aworld"'), 'hello\\aworld', 'double-quote keeps \\a literal');
  // test_unescape_backslash_with_newline
  eq(uq('hello\\\nworld'), 'helloworld', 'backslash-newline none');
  eq(uq('"hello\\\nworld"'), 'helloworld', 'backslash-newline double');

  // ---- warp_terminal::model/grid/cell (cell_tests.rs, portable cases) ----
  const CELL = require('../src/crates/warp_terminal').cell;
  // test_contains_cell_decorations
  ok(CELL.Flags.intersects(CELL.Flags.UNDERLINE, CELL.Flags.CELL_DECORATIONS), 'underline decoration');
  ok(CELL.Flags.intersects(CELL.Flags.STRIKEOUT, CELL.Flags.CELL_DECORATIONS), 'strikeout decoration');
  ok(CELL.Flags.intersects(CELL.Flags.DOUBLE_UNDERLINE, CELL.Flags.CELL_DECORATIONS), 'double-underline decoration');
  // push_zerowidth_seeds_base_char_on_first_push
  { const cell = new CELL.Cell({ c: 'x' });
    eq(cell.rawContent(), CELL.CharOrStr.Char('x'), 'raw content is base char');
    cell.pushZerowidth('́', true);
    eq(cell.rawContent(), CELL.CharOrStr.Str('x́'), 'seeded with base + zerowidth'); }
  // push_zerowidth_caps_accumulated_grapheme
  { const cell = new CELL.Cell({ c: 'e' });
    const zwj = '‍'; const zwjBytes = Buffer.byteLength(zwj);
    const pushes = Math.floor((CELL.MAX_GRAPHEME_BYTES * 10) / zwjBytes);
    for (let k = 0; k < pushes; k++) cell.pushZerowidth(zwj, true);
    const r = cell.rawContent(); ok(r.kind === 'Str', 'accumulated as string');
    const content = r.value;
    ok(Buffer.byteLength(content) <= CELL.MAX_GRAPHEME_BYTES, 'capped at MAX_GRAPHEME_BYTES');
    const zeroWidthCount = (Buffer.byteLength(content) - 1) / zwjBytes;
    ok(zeroWidthCount >= 80, 'at least 80 zero-width chars fit, got ' + zeroWidthCount);
    ok(content.startsWith('e') && [...content.slice(1)].every((ch) => ch === zwj), 'base + all zwj'); }

  // ---- warp_terminal::flat_storage/content (content_tests.rs) ----
  const CONTENT = require('../src/crates/warp_terminal').content;
  // test_large_grapheme_starts_new_chunk
  {
    const content = CONTENT.Content.new();
    const a = CONTENT.Grapheme.newFromStr('a');
    for (let k = 0; k < CONTENT.CHUNK_SIZE - 1; k++) content.pushGrapheme(a);
    ok(content.filled_chunks.size === 0, 'no filled chunks yet');
    const g = CONTENT.Grapheme.newFromStr('🚀');
    ok(g.len() > 1, 'rocket grapheme > 1 byte');
    ok(content.endOffset() + g.len() > CONTENT.CHUNK_SIZE, 'would overflow active chunk');
    content.pushGrapheme(g);
    eq(content.filled_chunks.size, 1, 'one filled chunk after overflow');
    eq(content.active_chunk.len(), g.len(), 'active chunk holds the rocket');
    eq(content.active_chunk.start_offset, CONTENT.CHUNK_SIZE - 1, 'active chunk start offset');
  }
  // test_truncate_front_drops_old_chunks
  {
    const content = CONTENT.Content.new();
    const a = CONTENT.Grapheme.newFromStr('a');
    for (let k = 0; k < CONTENT.CHUNK_SIZE - 1; k++) content.pushGrapheme(a);
    content.pushGrapheme(CONTENT.Grapheme.newFromStr('🚀'));
    content.truncateFront(content.active_chunk.start_offset - 1);
    eq(content.filled_chunks.size, 1, 'one byte before active -> chunk kept');
    content.truncateFront(content.active_chunk.start_offset);
    ok(content.filled_chunks.size === 0, 'at active start -> chunk dropped');
  }

  // ---- warp_terminal::flat_storage/attribute_map (attribute_map_tests.rs) ----
  const AM = require('../src/crates/warp_terminal').attributeMap;
  // test_iterate_over_empty_map
  { const map = AM.AttributeMap.new(0);
    eq(map.iterFrom(0).next(), 0, 'empty map yields default from 0');
    eq(map.iterFrom(25625).next(), 0, 'empty map yields default from far offset'); }
  // test_iterate_across_attribute_change
  { const map = AM.AttributeMap.new(0);
    map.pushAttributeChange(2, 1);
    eq(map.iterFrom(0).take(4), [0, 0, 1, 1], 'iterate across change point');
    eq(map.tail(), 1, 'tail value updated'); }

  // ---- warp_terminal::model/indexing (indexing_tests.rs) ----
  const IDX = require('../src/crates/warp_terminal').indexing;
  const PT = IDX.Point.new;
  const BD = IDX.Boundary;
  const peq = (a, b, m) => ok(a.equals(b), m + ` (got ${a.row},${a.col})`);
  // ordering
  ok(PT(0, 0).cmp(PT(0, 0)) === 0 && PT(1, 0).cmp(PT(0, 0)) > 0 && PT(0, 1).cmp(PT(0, 0)) > 0 && PT(1, 1).cmp(PT(0, 1)) > 0 && PT(1, 1).cmp(PT(1, 0)) > 0, 'point ordering');
  // wrapping_sub
  peq(PT(0, 13).wrappingSub(42, 1), PT(0, 12), 'wrapping_sub');
  peq(PT(1, 0).wrappingSub(42, 1), PT(0, 41), 'wrapping_sub_wrap');
  peq(PT(0, 0).wrappingSub(42, 1), PT(0, 0), 'wrapping_sub_clamp');
  // wrapping_add
  peq(PT(0, 13).wrappingAdd(42, 1), PT(0, 14), 'wrapping_add');
  peq(PT(0, 41).wrappingAdd(42, 1), PT(1, 0), 'wrapping_add_wrap');
  // add_absolute (Dimensions = [total_rows, columns])
  peq(PT(0, 13).addAbsolute([1, 42], BD.Clamp, 1), PT(0, 14), 'add_absolute');
  peq(PT(1, 41).addAbsolute([2, 42], BD.Clamp, 1), PT(0, 0), 'add_absolute_wrapline');
  peq(PT(2, 9).addAbsolute([3, 10], BD.Clamp, 11), PT(0, 0), 'add_absolute_multiline');
  peq(PT(0, 41).addAbsolute([1, 42], BD.Clamp, 1), PT(0, 41), 'add_absolute_clamp');
  peq(PT(0, 41).addAbsolute([3, 42], BD.Wrap, 1), PT(2, 0), 'add_absolute_wrap');
  peq(PT(0, 9).addAbsolute([3, 10], BD.Wrap, 11), PT(1, 0), 'add_absolute_multiline_wrap');
  // sub_absolute
  peq(PT(0, 13).subAbsolute([1, 42], BD.Clamp, 1), PT(0, 12), 'sub_absolute');
  peq(PT(0, 0).subAbsolute([2, 42], BD.Clamp, 1), PT(1, 41), 'sub_absolute_wrapline');
  peq(PT(0, 0).subAbsolute([3, 10], BD.Clamp, 11), PT(2, 9), 'sub_absolute_multiline');
  peq(PT(2, 0).subAbsolute([3, 42], BD.Wrap, 1), PT(0, 41), 'sub_absolute_wrap');
  peq(PT(2, 0).subAbsolute([3, 10], BD.Wrap, 11), PT(1, 9), 'sub_absolute_multiline_wrap');
  // distance
  { const a = PT(3, 10); eq(a.distance(30, a), 0); const b = PT(3, 6); eq(a.distance(30, b), 4); eq(b.distance(30, a), 4); const c = PT(4, 2); eq(a.distance(30, c), 22); eq(c.distance(30, a), 22); }
  // Index float adjustment
  eq(IDX.indexFromLines(2.99995), 3, 'index rounds up near boundary'); eq(IDX.indexFromLines(2.4), 2, 'index truncates');

  // ---- fuzzy_match remaining match_indices tests (fuzzy_tests.rs) ----
  eq(fz.match_indices('axbycz', 'abc').matched_indices, [0, 2, 4], 'simple fuzzy indices');
  eq(fz.match_indices('ay東cz', 'a東c').matched_indices, [0, 2, 3], 'multibyte fuzzy indices');
  eq(fz.match_indices('abcdef', '').matched_indices.length, 0, 'empty query -> no indices');
  eq(fz.match_indices('abcdef', 'ghijk'), null, 'no-match query -> none');
  eq(fz.match_indices_case_insensitive('AXBYcz', 'abC').matched_indices, [0, 2, 4], 'case-insensitive indices');
  { const ws = fz.match_indices_case_insensitive_ignore_spaces('myFunction', 'my func');
    const nows = fz.match_indices_case_insensitive('myFunction', 'myfunc');
    ok(ws && nows, 'ignore-spaces both match');
    eq(ws.matched_indices, nows.matched_indices, 'ignore-spaces same indices'); eq(ws.score, nows.score, 'ignore-spaces same score'); }

  // ---- editor::content/undo UndoStack (undo_tests.rs version-match cases) ----
  const UND = require('../src/crates/editor').undo;
  const CVx = require('../src/crates/warp_util').ContentVersion;
  const fakeActions = () => ({ actions: [], replacement_range: { new_range: [0, 0], old_range: [0, 0] } });
  // test_version_match_initial
  { const v = CVx.new(); const st = UND.UndoStack.new(5, v); ok(st.versionMatch(v), 'version match initial'); }
  // test_version_match_after_edit
  { const v = CVx.new(); const st = UND.UndoStack.new(5, v); ok(st.versionMatch(v));
    const nv = CVx.new(); st.pushUndoItemToStack(fakeActions(), nv);
    ok(st.versionMatch(nv) && !st.versionMatch(v), 'version match after edit'); }
  // test_version_match_after_undo
  { const v = CVx.new(); const st = UND.UndoStack.new(5, v);
    const nv = CVx.new(); st.pushUndoItemToStack(fakeActions(), nv); st.undo();
    ok(!st.versionMatch(nv) && st.versionMatch(v), 'version match after undo'); }
  // test_version_match_after_redo
  { const v = CVx.new(); const st = UND.UndoStack.new(5, v);
    const nv = CVx.new(); st.pushUndoItemToStack(fakeActions(), nv); st.undo(); st.redo();
    ok(st.versionMatch(nv) && !st.versionMatch(v), 'version match after redo'); }
  // capacity eviction: pushing beyond capacity bumps the floor version
  { const v = CVx.new(); const st = UND.UndoStack.new(2, v);
    const a = CVx.new(), b = CVx.new(), c = CVx.new();
    st.pushUndoItemToStack(fakeActions(), a); st.pushUndoItemToStack(fakeActions(), b); st.pushUndoItemToStack(fakeActions(), c);
    eq(st.stack.length, 2, 'capped at capacity'); ok(st.versionMatch(c), 'top is newest after eviction'); }

  // ---- editor::content/anchor (anchor_tests.rs, non-App cases) ----
  const ANC = require('../src/crates/editor').anchor;
  const AS = ANC.AnchorSide;
  const upd = (start, oldC, newC, clamp) => ({ start, old_character_count: oldC, new_character_count: newC, clamp });
  // test_anchor_cleanup (explicit refcount stands in for Rust Drop)
  { const a = ANC.Anchors.new();
    const x = a.createAnchor(3, AS.Right); const y = a.createAnchor(4, AS.Right);
    eq(a.anchors.size, 2);
    a.drop(x); a.update(upd(0, 0, 0, false)); eq(a.anchors.size, 1, 'dropped anchor GC-d');
    eq(a.resolve(y), 4, 'other anchor resolves');
    const y2 = y.clone(); a.drop(y); a.update(upd(0, 0, 0, false)); eq(a.resolve(y2), 4, 'clone keeps alive'); }
  // test_insert
  { const a = ANC.Anchors.new();
    const before = a.createAnchor(3, AS.Right), cursor = a.createAnchor(6, AS.Right), cursorLeft = a.createAnchor(6, AS.Left), after = a.createAnchor(9, AS.Right);
    a.update(upd(6, 0, 1, false));
    eq(a.resolve(before), 3); eq(a.resolve(cursor), 7); eq(a.resolve(cursorLeft), 6); eq(a.resolve(after), 10);
    a.update(upd(7, 0, 3, false)); eq(a.resolve(cursor), 10); eq(a.resolve(after), 13); }
  // test_backspace
  { const a = ANC.Anchors.new();
    const before = a.createAnchor(3, AS.Right), cursor = a.createAnchor(6, AS.Right), after = a.createAnchor(9, AS.Right);
    a.update(upd(5, 1, 0, false));
    eq(a.resolve(before), 3); eq(a.resolve(cursor), 5); eq(a.resolve(after), 8); }
  // test_invalidate_anchor
  { const a = ANC.Anchors.new();
    const inside = a.createAnchor(4, AS.Right), outside = a.createAnchor(3, AS.Right);
    const outR = a.createAnchor(5, AS.Right), outL = a.createAnchor(5, AS.Left);
    a.update(upd(3, 2, 0, false));
    eq(a.resolve(inside), null, 'deleted anchor invalidated'); eq(a.resolve(outside), 3);
    eq(a.resolve(outR), 3); eq(a.resolve(outL), 3);
    const inside2 = a.createAnchor(4, AS.Right); a.update(upd(3, 2, 0, true));
    eq(a.resolve(inside2), 3, 'clamp instead of invalidate'); }
  // test_update_anchor
  { const a = ANC.Anchors.new(); const anc = a.createAnchor(4, AS.Right); a.updateAnchor(anc, 3); eq(a.resolve(anc), 3); }

  // ---- editor::render/model/table_offset_map (table_offset_map_tests.rs) ----
  const TOM = require('../src/crates/editor').tableOffsetMap;
  // test_simple_table
  { const m = TOM.TableOffsetMap.new([[1, 2], [3, 1]]);
    eq(m.totalLength(), 11); eq(m.numRows(), 2); eq(m.numCols(), 2);
    const at = (o) => m.positionAtOffset(o);
    eq(at(0).kind, 'InCell'); ok(at(0).row === 0 && at(0).col === 0);
    eq(at(1), TOM.TablePosition.OnTab(0, 0));
    ok(at(2).kind === 'InCell' && at(2).row === 0 && at(2).col === 1);
    eq(at(4), TOM.TablePosition.OnNewline(0));
    ok(at(5).kind === 'InCell' && at(5).row === 1 && at(5).col === 0); }
  // test_cell_at_offset
  { const m = TOM.TableOffsetMap.new([[3, 3]]);
    eq(m.cellAtOffset(0), { row: 0, col: 0, offset_in_cell: 0 });
    eq(m.cellAtOffset(2), { row: 0, col: 0, offset_in_cell: 2 });
    eq(m.cellAtOffset(4), { row: 0, col: 1, offset_in_cell: 0 }); }
  // test_out_of_bounds_offset
  { const m = TOM.TableOffsetMap.new([[2, 2]]);
    eq(m.positionAtOffset(m.totalLength()), null); eq(m.positionAtOffset(100), null); eq(m.cellAtOffset(m.totalLength()), null); }
  // test_is_separator
  { const m = TOM.TableOffsetMap.new([[1, 1], [1, 1]]);
    ok(!m.isSeparator(0) && m.isSeparator(1) && m.isSeparator(3) && !m.isSeparator(4), 'is_separator'); }
  // test_empty_cells
  { const m = TOM.TableOffsetMap.new([[0, 3], [2, 0]]);
    eq(m.numRows(), 2); eq(m.numCols(), 2);
    eq(m.positionAtOffset(0), TOM.TablePosition.OnTab(0, 0));
    ok(m.positionAtOffset(1).kind === 'InCell' && m.positionAtOffset(1).col === 1); }
  // test_cells_in_range
  { const m = TOM.TableOffsetMap.new([[2, 2], [2, 2]]);
    eq(m.cellsInRange(0, m.totalLength()).length, 4);
    const fr = m.cellsInRange(0, 5); eq(fr.length, 2); eq(fr[0].row, 0); }

  console.log(`PASS: ${n} crate assertions (ported 1:1 from Warp Rust tests)`);
})();
