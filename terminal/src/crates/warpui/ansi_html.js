// ansi_html — render a term.js Grid<Cell> row range to styled HTML, resolving the engine's color
// descriptors (default / ansi-index / rgb) against a palette. This is how Warp blocks show output:
// per-cell fg/bg/bold/italic/underline/strike become grouped <span> runs. Browser-only output, but
// the row→span grouping is pure and unit-tested in Node.
'use strict';
(function (root) {
  function esc(s) { return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;')); }

  // A cell's visual style key + its resolved CSS, given a palette and defaults.
  function cellStyle(cell, pal, fgDef, bgDef) {
    const inv = cell.inverse;
    let fg = resolve(cell.fg, fgDef, pal), bg = cell.bg.t === 'bg' ? null : resolve(cell.bg, bgDef, pal);
    if (inv) { const t = fg; fg = bg || bgDef; bg = t || fgDef; }
    if (cell.hidden) fg = bg || bgDef;
    if (cell.dim) fg = [Math.round(fg[0] * 0.66), Math.round(fg[1] * 0.66), Math.round(fg[2] * 0.66)];  // DIM_FACTOR (terminal/color.rs)
    const deco = [];
    if (cell.underline) deco.push('underline');
    if (cell.strike) deco.push('line-through');
    return {
      fg: `rgb(${fg[0]},${fg[1]},${fg[2]})`,
      bg: bg ? `rgb(${bg[0]},${bg[1]},${bg[2]})` : '',
      bold: !!cell.bold, italic: !!cell.italic, deco: deco.join(' '),
    };
  }
  function resolve(d, def, pal) { return d.t === 'rgb' ? [d.r, d.g, d.b] : d.t === 'idx' ? (pal[d.i] || def) : def; }
  function styleKey(s) { return s.fg + '|' + s.bg + '|' + (s.bold ? 1 : 0) + (s.italic ? 1 : 0) + '|' + s.deco; }
  function styleCss(s) {
    let css = `color:${s.fg};`;
    if (s.bg) css += `background:${s.bg};`;
    if (s.bold) css += 'font-weight:600;';
    if (s.italic) css += 'font-style:italic;';
    if (s.deco) css += `text-decoration:${s.deco};`;
    return css;
  }

  // Render one grid row (array of cells) to an HTML string of grouped spans. Trailing blanks dropped.
  // cursorCol (optional): mark that column as the block cursor (its own .wcursor span).
  function rowToHtml(row, pal, fgDef, bgDef, cursorCol) {
    if (!row) return '';
    let last = row.length - 1;
    while (last >= 0 && (row[last].c === ' ' || row[last].c === '\0') && row[last].bg.t === 'bg' && !row[last].underline && !row[last].strike) last--;
    if (cursorCol != null && cursorCol > last) last = cursorCol;   // keep blank cell under the cursor
    if (last < 0) return '';
    let html = '', runKey = null, runStyle = '', runText = '', runLink = null;
    const flush = () => {
      if (!runText) { runText = ''; return; }
      const t = esc(runText);
      html += runLink                                       // OSC 8 explicit hyperlink cell run
        ? `<span class="wlink" data-url="${esc(runLink).replace(/"/g, '&quot;')}" style="${runStyle}">${t}</span>`
        : `<span style="${runStyle}">${t}</span>`;
      runText = '';
    };
    for (let i = 0; i <= last; i++) {
      const cell = row[i];
      if (cell.spacer) continue;
      if (i === cursorCol) { flush(); runKey = null; html += `<span class="wcursor">${esc(cell.c === '\0' || cell.c === ' ' ? ' ' : cell.c)}</span>`; continue; }
      const s = cellStyle(cell, pal, fgDef, bgDef);
      const k = styleKey(s) + '|' + (cell.link || '');
      if (k !== runKey) { flush(); runKey = k; runStyle = styleCss(s); runLink = cell.link || null; }
      runText += (cell.c === '\0' ? ' ' : cell.c);
    }
    flush();
    return html;
  }

  // Render a contiguous range of logical rows [from,to] (inclusive) of a term to multi-line HTML.
  // cursor (optional): { row: absoluteRow, col } draws the block cursor on that row.
  function rowsToHtmlLines(term, from, to, pal, fgDef, bgDef, cursor) {
    const n = term.totalRows(); const lines = []; const start = Math.max(0, from);
    for (let i = start; i <= to && i < n; i++) {
      lines.push(rowToHtml(term.rowAt(i), pal, fgDef, bgDef, cursor && cursor.row === i ? cursor.col : undefined));
    }
    return lines;
  }

  function rowsToHtml(term, from, to, pal, fgDef, bgDef, cursor, opts = {}) {
    const start = Math.max(0, from);
    const lines = rowsToHtmlLines(term, from, to, pal, fgDef, bgDef, cursor);
    if (opts.trimEnd !== false) {
      const keepTo = cursor && cursor.row >= start ? cursor.row - start : -1;   // don't trim away the cursor row
      while (lines.length - 1 > keepTo && lines[lines.length - 1] === '') lines.pop();
    }
    return lines.join('\n');
  }

  const api = { rowToHtml, rowsToHtml, rowsToHtmlLines, cellStyle, styleKey, esc, resolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.warpAnsiHtml = api;
})(typeof window !== 'undefined' ? window : globalThis);
