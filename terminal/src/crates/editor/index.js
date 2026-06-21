// Module mirror of Warp crate `editor` (Rust: crates/editor, 62532 LOC).
// STATUS: partial — faithful 1:1 port of the pure OffsetMap translation algorithm from
// crates/editor/src/render/model/offset_map.rs (maps between visible "frame" char offsets and
// interactive "content" char offsets across placeholder runs). Offsets are plain integers
// (the string_offset CharOffset/FrameOffset newtypes). The stateful Buffer/Paragraph render
// model (the App-driven parts) is warpui_core-coupled and not ported.
'use strict';

// SelectableTextRun: { content_start, frame_start, length }.
const SelectableTextRun = ({ content_start, frame_start, length }) => ({ content_start, frame_start, length });

class OffsetMap {
  constructor(runs) {
    this.runs = runs.slice().sort((a, b) => a.frame_start - b.frame_start);
  }
  static direct(length) { return new OffsetMap([SelectableTextRun({ content_start: 0, frame_start: 0, length })]); }
  static new(runs) { return new OffsetMap(runs); }

  toContent(frameOffset) { return this._translate(frameOffset, (r) => r.frame_start, (r) => r.content_start); }
  toFrame(charOffset) { return this._translate(charOffset, (r) => r.content_start, (r) => r.frame_start); }

  // 1:1 port of translate(): exact within a run, else snap to the nearer run.
  _translate(offset, startT, startU) {
    // partition_point: first index where startT(run) < offset is false.
    let afterIdx = 0;
    while (afterIdx < this.runs.length && startT(this.runs[afterIdx]) < offset) afterIdx++;

    let after = null;
    if (afterIdx < this.runs.length) {
      const run = this.runs[afterIdx];
      after = { distance: startT(run) - offset, translation: startU(run) };
    }
    let before = null;
    if (afterIdx - 1 >= 0) {
      const run = this.runs[afterIdx - 1];
      const runEnd = startT(run) + run.length;
      const distance = Math.max(0, offset - runEnd); // saturating_sub
      const translation = startU(run) + Math.min(offset - startT(run), run.length);
      before = { distance, translation };
    }

    if (before === null && after === null) return 0;
    if (before === null) return after.translation;
    if (after === null) return before.translation;
    return before.distance < after.distance ? before.translation : after.translation;
  }
}

module.exports = { __crate: 'editor', __status: 'partial', __rustLoc: 62532, OffsetMap, SelectableTextRun, undo: require('./undo'), anchor: require('./anchor'), tableOffsetMap: require('./table_offset_map') };
