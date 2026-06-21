// Faithful 1:1 port of crates/warp_terminal/src/model/grid/flat_storage/attribute_map.rs — a
// space-efficient run-length map of a per-byte grid attribute. Internally a sorted map keyed by
// each range's inclusive end byte offset, plus a tail value for everything past the last end.
// push_attribute_change records a change point; iterFrom yields per-byte values from an offset.
'use strict';

const USIZE_MAX = Number.MAX_SAFE_INTEGER;

class AttributeMap {
  constructor(startingValue) { this.map = new Map(); this.tail_value = startingValue; }
  static new(startingValue) { return new AttributeMap(startingValue); }

  _sortedKeys() { return [...this.map.keys()].sort((a, b) => a - b); }
  _lastEndOffset() { const ks = this._sortedKeys(); return ks.length ? ks[ks.length - 1] : 0; }

  // truncate to new_len: split off ranges ending >= new_len; the first becomes the new tail value.
  truncate(newLen) {
    const removed = this._sortedKeys().filter((k) => k >= newLen);
    if (removed.length > 0) this.tail_value = this.map.get(removed[0]);
    for (const k of removed) this.map.delete(k);
  }
  // truncate_front: keep only ranges ending >= new_start_offset.
  truncateFront(newStartOffset) {
    for (const k of this._sortedKeys()) if (k < newStartOffset) this.map.delete(k);
  }

  // Record that the attribute value changes to `value` at byte `rangeStart` (RangeFrom).
  pushAttributeChange(rangeStart, value) {
    if (value === this.tail_value) return;
    const prevTail = this.tail_value;
    this.tail_value = value;
    if (rangeStart === 0) { /* map must be empty */ }
    else this.map.set(rangeStart - 1, prevTail); // key = inclusive end of the prior range
  }

  tail() { return this.tail_value; }

  // Per-byte value iterator from startOffset. Returns an object with next() yielding values.
  iterFrom(startOffset) {
    const keys = this._sortedKeys().filter((k) => k >= startOffset);
    let ki = 0;
    const nextRange = () => (ki < keys.length ? [keys[ki], this.map.get(keys[ki++])] : [USIZE_MAX, this.tail_value]);
    let curOffset = startOffset;
    let curRange = nextRange();
    const self = this;
    const advance = (n) => {
      curOffset += n;
      while (curOffset > curRange[0]) curRange = nextRange();
      const val = curRange[1];
      curOffset += 1;
      return val;
    };
    return {
      next: () => advance(0),
      take: (count) => { const out = []; for (let i = 0; i < count; i++) out.push(advance(0)); return out; },
      _self: self,
    };
  }
}

module.exports = { AttributeMap };
