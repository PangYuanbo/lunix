// Faithful 1:1 port of crates/editor/src/content/anchor.rs — relative anchors into buffer content
// that shift as text is inserted/deleted around them. The Rust uses Arc/Weak reference counting to
// garbage-collect dropped anchors; JS has no Drop, so liveness is modeled with an explicit shared
// refcount: anchor.clone() increments it, anchors.drop(anchor) decrements it, and update() prunes
// anchors whose refcount has reached zero. The offset-adjustment math is exact.
'use strict';

const AnchorSide = Object.freeze({ Left: 'Left', Right: 'Right' });

class Anchor {
  constructor(id, ref) { this.id = id; this.ref = ref; } // ref = { count }
  clone() { this.ref.count += 1; return new Anchor(this.id, this.ref); }
}

class Anchors {
  constructor() { this.next_id = 0; this.anchors = new Map(); } // id -> { ref, offset, side }
  static new() { return new Anchors(); }

  updateAnchor(anchor, offset) { const s = this.anchors.get(anchor.id); if (s) s.offset = offset; }

  createAnchor(offset, side) {
    const id = this.next_id;
    this.next_id = (this.next_id + 1) >>> 0; // wrapping_add
    const ref = { count: 1 };
    this.anchors.set(id, { ref, offset, side });
    return new Anchor(id, ref);
  }

  // Decrement an anchor's refcount (the JS stand-in for Rust's Drop). Cleanup happens on update().
  drop(anchor) { if (anchor && anchor.ref) anchor.ref.count -= 1; }

  // Reflect replacing old_character_count chars at `start` with new_character_count chars.
  update({ start, old_character_count, new_character_count, clamp }) {
    const oldEnd = start + old_character_count;
    const newEnd = start + new_character_count;
    for (const [id, state] of [...this.anchors]) {
      if (state.ref.count <= 0) { this.anchors.delete(id); continue; }
      let keep;
      if (state.offset > oldEnd || (state.side === AnchorSide.Right && state.offset === oldEnd)) {
        state.offset = (state.offset + newEnd) - oldEnd;
        keep = true;
      } else if ((clamp && state.offset > newEnd) || (state.offset === oldEnd && state.offset > newEnd && state.side === AnchorSide.Left)) {
        state.offset = newEnd;
        keep = true;
      } else {
        keep = state.offset <= newEnd;
      }
      if (!keep) this.anchors.delete(id);
    }
  }

  resolve(anchor) { const s = this.anchors.get(anchor.id); return s ? s.offset : null; }
}

module.exports = { AnchorSide, Anchor, Anchors };
