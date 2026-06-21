// Module mirror of Warp crate `sum_tree` (Rust: crates/sum_tree, 1996 LOC).
// STATUS: ported (core) — faithful port of the SumTree B+ tree from crates/sum_tree/src/lib.rs
// (extend / push / push_tree / push_tree_recursive / from_child_trees / items / extent / summary
// / last / update_last) with TREE_BASE = 2 (the crate's `test-util` config). The Rust generics
// (Item/Summary/Dimension traits) become an injected `spec` { summarize, zero, add, clone }.
// The Cursor/FilterCursor (cursor.rs, 1009 LOC) and the seeded-RNG randomized test are not
// ported — that test compares against Rust's StdRng draw sequence, which can't be reproduced 1:1.
'use strict';

const TREE_BASE = 2;
const MAX = 2 * TREE_BASE;

// ---- Node helpers (Internal | Leaf) ----
const isLeaf = (n) => n.kind === 'leaf';
const heightOf = (n) => (n.kind === 'internal' ? n.height : 0);
const childSummaries = (n) => (n.kind === 'internal' ? n.child_summaries : n.item_summaries);
const isUnderflowing = (n) => (n.kind === 'internal' ? n.child_trees.length < TREE_BASE : n.items.length < TREE_BASE);

class SumTree {
  constructor(spec, node) {
    this.spec = spec;
    this.node = node || { kind: 'leaf', summary: spec.zero(), items: [], item_summaries: [] };
  }
  static newWith(spec) { return new SumTree(spec); }

  _sum(summaries) {
    let acc = this.spec.zero();
    for (const s of summaries) this.spec.add(acc, s);
    return acc;
  }

  summary() { return this.spec.clone(this.node.summary); }
  extent(dim) { const d = dim.zero(); dim.addSummary(d, this.node.summary); return d; }
  isEmpty() { return this.node.kind === 'leaf' && this.node.items.length === 0; }

  // In-order item collection (Rust uses a cursor; a recursive leaf walk is equivalent).
  items() {
    const out = [];
    const walk = (n) => { if (n.kind === 'leaf') out.push(...n.items); else n.child_trees.forEach((t) => walk(t.node)); };
    walk(this.node);
    return out;
  }
  last() {
    let n = this.node;
    while (n.kind === 'internal') n = n.child_trees[n.child_trees.length - 1].node;
    return n.items.length ? n.items[n.items.length - 1] : null;
  }
  first() {
    let n = this.node;
    while (n.kind === 'internal') n = n.child_trees[0].node;
    return n.items.length ? n.items[0] : null;
  }

  extend(iter) {
    let leaf = null;
    for (const item of iter) {
      if (leaf && leaf.items.length === 2 * TREE_BASE) { this.pushTree(new SumTree(this.spec, leaf)); leaf = null; }
      if (!leaf) leaf = { kind: 'leaf', summary: this.spec.zero(), items: [], item_summaries: [] };
      const is = this.spec.summarize(item);
      this.spec.add(leaf.summary, is);
      leaf.items.push(item);
      leaf.item_summaries.push(is);
    }
    if (leaf) this.pushTree(new SumTree(this.spec, leaf));
  }

  push(item) {
    const summary = this.spec.summarize(item);
    this.pushTree(SumTree._fromChildTrees(this.spec, [new SumTree(this.spec, {
      kind: 'leaf', summary: this.spec.clone(summary), items: [item], item_summaries: [this.spec.clone(summary)],
    })]));
  }

  pushTree(other) {
    const on = other.node;
    const onEmpty = isLeaf(on) && on.items.length === 0;
    if (!onEmpty) {
      if (heightOf(this.node) < heightOf(on)) {
        for (const tree of on.child_trees) this.pushTree(tree);
      } else {
        const split = this._pushTreeRecursive(other);
        if (split) this.node = SumTree._fromChildTrees(this.spec, [new SumTree(this.spec, this.node), split]).node;
      }
    }
  }

  _pushTreeRecursive(other) {
    const sp = this.spec, self = this.node, on = other.node;
    if (self.kind === 'internal') {
      sp.add(self.summary, on.summary);
      const heightDelta = self.height - heightOf(on);
      const summariesToAppend = [], treesToAppend = [];
      if (heightDelta === 0) {
        for (const s of childSummaries(on)) summariesToAppend.push(sp.clone(s));
        for (const t of on.child_trees) treesToAppend.push(t);
      } else if (heightDelta === 1 && !isUnderflowing(on)) {
        summariesToAppend.push(sp.clone(on.summary));
        treesToAppend.push(other);
      } else {
        const lastChild = self.child_trees[self.child_trees.length - 1];
        const split = lastChild._pushTreeRecursive(other);
        self.child_summaries[self.child_summaries.length - 1] = sp.clone(lastChild.node.summary);
        if (split) { summariesToAppend.push(sp.clone(split.node.summary)); treesToAppend.push(split); }
      }
      const childCount = self.child_trees.length + treesToAppend.length;
      if (childCount > MAX) {
        const midpoint = (childCount + (childCount % 2)) / 2;
        const allSummaries = self.child_summaries.concat(summariesToAppend);
        const allTrees = self.child_trees.concat(treesToAppend);
        const leftS = allSummaries.slice(0, midpoint), rightS = allSummaries.slice(midpoint);
        const leftT = allTrees.slice(0, midpoint), rightT = allTrees.slice(midpoint);
        self.summary = this._sum(leftS);
        self.child_summaries = leftS;
        self.child_trees = leftT;
        return new SumTree(sp, { kind: 'internal', height: self.height, summary: this._sum(rightS), child_summaries: rightS, child_trees: rightT });
      }
      self.child_summaries.push(...summariesToAppend);
      self.child_trees.push(...treesToAppend);
      return null;
    }
    // Leaf
    const childCount = self.items.length + on.items.length;
    if (childCount > MAX) {
      const midpoint = (childCount + (childCount % 2)) / 2;
      const allItems = self.items.concat(on.items);
      const allSummaries = self.item_summaries.concat(childSummaries(on));
      const leftItems = allItems.slice(0, midpoint), rightItems = allItems.slice(midpoint);
      const leftS = allSummaries.slice(0, midpoint).map((s) => sp.clone(s));
      const rightS = allSummaries.slice(midpoint).map((s) => sp.clone(s));
      self.items = leftItems;
      self.item_summaries = leftS;
      self.summary = this._sum(self.item_summaries);
      return new SumTree(sp, { kind: 'leaf', items: rightItems, summary: this._sum(rightS), item_summaries: rightS });
    }
    sp.add(self.summary, on.summary);
    self.items.push(...on.items);
    for (const s of childSummaries(on)) self.item_summaries.push(sp.clone(s));
    return null;
  }

  updateLast(f) {
    if (this.isEmpty()) return;
    this._updateLastLeafRecursive(f);
  }
  _updateLastLeafRecursive(f) {
    const sp = this.spec, n = this.node;
    if (n.kind === 'internal') {
      const lastChild = n.child_trees[n.child_trees.length - 1];
      n.child_summaries[n.child_summaries.length - 1] = lastChild._updateLastLeafRecursive(f);
      n.summary = this._sum(n.child_summaries);
      return sp.clone(n.summary);
    }
    const i = n.items.length - 1;
    f(n.items, i); // mutate via (items, index) so callers can reassign primitives
    n.item_summaries[i] = sp.summarize(n.items[i]);
    n.summary = this._sum(n.item_summaries);
    return sp.clone(n.summary);
  }

  static _fromChildTrees(spec, childTrees) {
    const height = heightOf(childTrees[0].node) + 1;
    const child_summaries = childTrees.map((c) => spec.clone(c.node.summary));
    let summary = spec.zero();
    for (const s of child_summaries) spec.add(summary, s);
    return new SumTree(spec, { kind: 'internal', height, summary, child_summaries, child_trees: childTrees });
  }
}

// Summary spec matching the tests' IntegersSummary over u8 items.
const integersSpec = {
  summarize: (item) => ({ count: 1, sum: item, contains_even: (item & 1) === 0 }),
  zero: () => ({ count: 0, sum: 0, contains_even: false }),
  add: (acc, s) => { acc.count += s.count; acc.sum += s.sum; acc.contains_even = acc.contains_even || s.contains_even; },
  clone: (s) => ({ count: s.count, sum: s.sum, contains_even: s.contains_even }),
};
const CountDim = { zero: () => 0, addSummary: (d, s) => d + s.count, };
// Dimensions return a value; addSummary here is pure-add style used via extent().
const dimCount = { zero: () => ({ v: 0 }), addSummary: (d, s) => { d.v += s.count; } };
const dimSum = { zero: () => ({ v: 0 }), addSummary: (d, s) => { d.v += s.sum; } };

module.exports = {
  __crate: 'sum_tree', __status: 'ported', __rustLoc: 1996,
  TREE_BASE, SumTree, integersSpec, dimCount, dimSum,
  newU8Tree: () => SumTree.newWith(integersSpec),
};
