// Faithful 1:1 port of crates/warp_terminal/src/model/grid/flat_storage/content.rs — a chunked
// flat content buffer keyed by byte offset. Content stores already-full Chunks in a map keyed by
// each chunk's final byte offset plus one active Chunk; push_grapheme rolls to a new chunk when the
// active one lacks room, and truncate/truncate_front move the head/tail pointers. Chunk content is
// stored as a string here (byte offsets computed via UTF-8 byte lengths) rather than a [u8;1024].
'use strict';

const CHUNK_SIZE = 1024;
const byteLen = (s) => Buffer.byteLength(s, 'utf8');

// Minimal Grapheme: content string + its UTF-8 byte length.
class Grapheme {
  constructor(s) { this._content = s; this._len = byteLen(s); }
  static newFromStr(s) { return new Grapheme(s); }
  content() { return this._content; }
  len() { return this._len; }
}

class Chunk {
  constructor(startOffset) { this.s = ''; this.start_offset = startOffset; }
  len() { return byteLen(this.s); }
  capacity() { return CHUNK_SIZE; }
  contentRangeEnd() { return this.start_offset + this.len(); }
  push(content) { this.s += content; }
  truncate(offset) { // keep [start_offset, offset) bytes
    const keep = offset - this.start_offset;
    const buf = Buffer.from(this.s, 'utf8').subarray(0, keep);
    this.s = buf.toString('utf8');
  }
}

class Content {
  constructor() {
    // filled_chunks: Map<endByteOffsetInclusive, Chunk>, kept sorted by key on read.
    this.filled_chunks = new Map();
    this.active_chunk = new Chunk(0);
  }
  static new() { return new Content(); }

  _filledSortedKeys() { return [...this.filled_chunks.keys()].sort((a, b) => a - b); }

  pushGrapheme(grapheme) {
    const graphemeLen = grapheme.len();
    if (graphemeLen >= CHUNK_SIZE) throw new Error(`grapheme with length ${graphemeLen} exceeds chunk size of ${CHUNK_SIZE}`);
    if (this.active_chunk.len() + graphemeLen > this.active_chunk.capacity()) {
      const newStart = this.active_chunk.contentRangeEnd();
      const full = this.active_chunk;
      this.active_chunk = new Chunk(newStart);
      this.filled_chunks.set(full.contentRangeEnd() - 1, full); // keyed by final byte offset (inclusive)
    }
    this.active_chunk.push(grapheme.content());
  }

  truncate(newLen) {
    // split_off(&new_len): move chunks with key >= newLen out; first becomes the new active chunk.
    const removed = this._filledSortedKeys().filter((k) => k >= newLen);
    if (removed.length > 0) {
      const firstKey = removed[0];
      this.active_chunk = this.filled_chunks.get(firstKey);
      for (const k of removed) this.filled_chunks.delete(k);
    }
    this.active_chunk.truncate(newLen);
  }

  truncateFront(newStartOffset) {
    for (;;) {
      const keys = this._filledSortedKeys();
      if (keys.length === 0) break;
      const firstKey = keys[0];
      if (firstKey < newStartOffset) this.filled_chunks.delete(firstKey);
      else break;
    }
  }

  endOffset() { return this.active_chunk.start_offset + this.active_chunk.len(); }

  // Index over a byte range [start, end): find the covering chunk, slice within it.
  slice(start, end) {
    const keys = this._filledSortedKeys();
    let chunk = this.active_chunk;
    for (const k of keys) { if (k >= start) { chunk = this.filled_chunks.get(k); break; } }
    const s = start - chunk.start_offset, e = end - chunk.start_offset;
    return Buffer.from(chunk.s, 'utf8').subarray(s, e).toString('utf8');
  }
}

module.exports = { Content, Chunk, Grapheme, CHUNK_SIZE };
