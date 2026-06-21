'use strict';

const { Terminal } = require('../src/crates/warp_terminal/term');
const ansi = require('../src/crates/warpui/ansi_html');
const { buildPalette, BASE16 } = require('../src/crates/warp_terminal/engine_pane');

const rows = Number(process.env.ROWS || 12000);
const cols = Number(process.env.COLS || 120);
const chunkRows = Number(process.env.CHUNK_ROWS || 40);
const pageRows = Number(process.env.PAGE_ROWS || 80);
const pageJumps = Number(process.env.PAGE_JUMPS || 1000);
const pal = buildPalette(BASE16);
const fg = [255, 255, 255];
const bg = [0, 0, 0];

function ms(fn) {
  const t0 = process.hrtime.bigint();
  const value = fn();
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, value };
}

function sampleInput(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(`\x1b[3${i % 7}mrow ${String(i).padStart(5, '0')} `);
    out.push('abcdefghijklmnopqrstuvwxyz 0123456789 ');
    if (i % 97 === 0) out.push(`https://example.com/${i} `);
    out.push('\x1b[0m\n');
    if (i % 113 === 0) out.push('\n');
  }
  return out.join('');
}

const input = sampleInput(rows);
const term = new Terminal(cols, 32, { maxScrollback: rows + 100 });
const parse = ms(() => term.write(input));
const total = term.totalRows();

const fullHtml = ms(() => ansi.rowsToHtml(term, 0, total - 1, pal, fg, bg));
const fullHtmlRows = ms(() => {
  const lines = ansi.rowsToHtmlLines(term, 0, total - 1, pal, fg, bg);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
});

const naiveActiveHtml = ms(() => {
  let len = 0;
  for (let to = chunkRows - 1; to < total; to += chunkRows) {
    len += ansi.rowsToHtml(term, 0, Math.min(total - 1, to), pal, fg, bg, null, { trimEnd: false }).length;
  }
  if ((total - 1) % chunkRows !== chunkRows - 1) {
    len += ansi.rowsToHtml(term, 0, total - 1, pal, fg, bg, null, { trimEnd: false }).length;
  }
  return len;
});

const appendHtml = ms(() => {
  let s = '';
  let renderedTo = -1;
  for (let from = 0; from < total; from += chunkRows) {
    const to = Math.min(total - 1, from + chunkRows - 1);
    const part = ansi.rowsToHtml(term, from, to, pal, fg, bg, null, { trimEnd: to === total - 1 });
    s += (renderedTo >= 0 ? '\n' : '') + part;
    renderedTo = to;
  }
  return s;
});

const appendActiveHtml = ms(() => {
  let s = '';
  let renderedTo = -1;
  for (let from = 0; from < total; from += chunkRows) {
    const to = Math.min(total - 1, from + chunkRows - 1);
    const part = ansi.rowsToHtml(term, from, to, pal, fg, bg, null, { trimEnd: false });
    s += (renderedTo >= 0 ? '\n' : '') + part;
    renderedTo = to;
  }
  return s;
});

const snapshot = ms(() => {
  const block = {
    cmd: `bench ${rows}`,
    cwd: '~',
    exit: 0,
    outputHtml: fullHtml.value,
  };
  return JSON.stringify({ version: 1, blocks: [block] });
});

const reload = ms(() => {
  const doc = JSON.parse(snapshot.value);
  return doc.blocks.map((b) => b.outputHtml).join('\n');
});

const rowSnapshot = ms(() => JSON.stringify({
  version: 1,
  blocks: [{
    cmd: `bench ${rows}`,
    cwd: '~',
    exit: 0,
    outputHtmlRows: fullHtmlRows.value,
  }],
}));

const lazyReload = ms(() => JSON.parse(rowSnapshot.value));

const pageRender = ms(() => {
  const lines = lazyReload.value.blocks[0].outputHtmlRows;
  const maxStart = Math.max(0, lines.length - pageRows);
  let bytes = 0;
  for (let i = 0; i < pageJumps; i++) {
    const start = (i * 997) % (maxStart + 1);
    bytes += lines.slice(start, start + pageRows).join('\n').length;
  }
  return bytes;
});

const result = {
  rows,
  cols,
  logicalRows: total,
  parseGridMs: Math.round(parse.ms * 100) / 100,
  fullHtmlMs: Math.round(fullHtml.ms * 100) / 100,
  fullHtmlRowsMs: Math.round(fullHtmlRows.ms * 100) / 100,
  replayLoadMs: Math.round((parse.ms + fullHtml.ms) * 100) / 100,
  naiveActiveRerenderMs: Math.round(naiveActiveHtml.ms * 100) / 100,
  appendActiveRenderMs: Math.round(appendActiveHtml.ms * 100) / 100,
  activeRenderSpeedup: Math.round((naiveActiveHtml.ms / appendActiveHtml.ms) * 100) / 100,
  appendHtmlMs: Math.round(appendHtml.ms * 100) / 100,
  snapshotBytes: Buffer.byteLength(snapshot.value),
  snapshotWriteModelMs: Math.round(snapshot.ms * 100) / 100,
  snapshotReloadMs: Math.round(reload.ms * 100) / 100,
  rowSnapshotBytes: Buffer.byteLength(rowSnapshot.value),
  rowSnapshotWriteMs: Math.round(rowSnapshot.ms * 100) / 100,
  lazySnapshotReloadMs: Math.round(lazyReload.ms * 100) / 100,
  pageRenderRows: pageRows,
  pageJumps,
  pageRenderTotalMs: Math.round(pageRender.ms * 100) / 100,
  pageRenderAvgMs: Math.round((pageRender.ms / pageJumps) * 10000) / 10000,
  lazyReloadVsReplaySpeedup: Math.round(((parse.ms + fullHtml.ms) / lazyReload.ms) * 100) / 100,
  pageRenderVsReplaySpeedup: Math.round(((parse.ms + fullHtml.ms) / (pageRender.ms / pageJumps)) * 100) / 100,
  activeAppendMatchesFull: appendActiveHtml.value === ansi.rowsToHtml(term, 0, total - 1, pal, fg, bg, null, { trimEnd: false }),
  appendMatchesFull: appendHtml.value === fullHtml.value,
  rowsMatchFull: fullHtmlRows.value.join('\n') === fullHtml.value,
  reloadMatchesFull: reload.value === fullHtml.value,
};

console.log(JSON.stringify(result, null, 2));
