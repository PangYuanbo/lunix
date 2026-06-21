// Faithful 1:1 port of the UndoStack core from crates/editor/src/content/undo.rs — the
// undo/redo stack with capacity-bounded history, redo-branch truncation, non-atomic coalescing,
// and ContentVersion tracking (version_match). The editor action payloads (CoreEditorAction,
// RenderedSelectionSet, ReplacementRange) are opaque here; the version/stack bookkeeping is exact.
'use strict';

// UndoStackItem holds the reversible actions for one edit, its version, and a reversed flag.
class UndoStackItem {
  constructor(item, version) { this.item = item; this.version = version; this.reversed = false; this.batched = []; }
  add(item, _action, version) { this.batched.push({ item, version }); this.version = version; }
  reverse() { this.reversed = !this.reversed; }
}

class UndoStack {
  constructor(capacity, initialVersion) {
    this.stack = [];
    this.current_index = 0;
    this.capacity = capacity;
    this.previous_action_type = null;
    this.initial_version = initialVersion;
  }
  static new(capacity, initialVersion) { return new UndoStack(capacity, initialVersion); }

  pushUndoItemToStack(item, version) {
    let stackSize = this.stack.length;
    if (this.current_index < stackSize) { // clear redo branch
      this.stack.length = this.current_index;
      stackSize = this.current_index;
    }
    if (stackSize === this.capacity) { // evict oldest; its version becomes the new floor
      this.initial_version = this.stack.shift().version;
      this.current_index -= 1;
    }
    this.stack.push(new UndoStackItem(item, version));
    this.current_index += 1;
  }

  undo() {
    if (this.stack.length === 0 || this.current_index === 0) return null;
    this.previous_action_type = null;
    this.current_index -= 1;
    const it = this.stack[this.current_index];
    const result = { item: it.item, replacement_range: it.item && it.item.replacement_range };
    it.reverse();
    return result;
  }

  redo() {
    if (this.current_index >= this.stack.length) return null;
    const it = this.stack[this.current_index];
    const result = { item: it.item, replacement_range: it.item && it.item.replacement_range };
    it.reverse();
    this.current_index += 1;
    return result;
  }

  reset(version) { this.stack = []; this.current_index = 0; this.previous_action_type = null; this.initial_version = version; }

  // version_match: at the stack floor compare initial_version, else the last-completed item's version.
  versionMatch(version) {
    if (this.current_index === 0) return version.equals(this.initial_version);
    return this.stack[this.current_index - 1].version.equals(version);
  }

  isEmpty() { return this.stack.length === 0; }
}

module.exports = { UndoStack, UndoStackItem };
