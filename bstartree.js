"use strict";

// B*-tree: try redistribute first, then 2-to-3 split, then normal split.

const { BTree, BTreeNode, lowerBound } = require("./btree");

class BStarTree extends BTree {
  constructor(d = 3) {
    super(d);
    this.redistributionCount = 0;
    this.twoToThreeSplitCount = 0;
  }

  insert(key, rid) {
    if (this._update(this.root, key, rid)) return;
    if (this.root.keys.length === this.maxKeys) {
      const r = new BTreeNode(false);
      r.children.push(this.root);
      this._splitChild(r, 0);
      this.root = r;
    }
    this._insertNonFullStar(this.root, key, rid);
    this.size++;
  }

  _insertNonFullStar(node, key, rid) {
    let i = lowerBound(node.keys, key);
    if (node.leaf) {
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, rid);
      return;
    }
    if (node.children[i].keys.length === this.maxKeys) {
      const r = this._handleOverflow(node, i, key, rid);
      if (r.inserted) return;
      i = r.childIndex;
      if (i < node.keys.length && key === node.keys[i]) {
        node.values[i] = rid;
        return;
      }
    }
    this._insertNonFullStar(node.children[i], key, rid);
  }

  _handleOverflow(parent, idx, key, rid) {
    if (idx < parent.children.length - 1 && parent.children[idx + 1].keys.length < this.maxKeys) {
      const inserted = this._redistR(parent, idx, key, rid);
      if (inserted !== null) {
        this.redistributionCount++;
        return { inserted, childIndex: key > parent.keys[idx] ? idx + 1 : idx };
      }
    }
    if (idx > 0 && parent.children[idx - 1].keys.length < this.maxKeys) {
      const inserted = this._redistL(parent, idx, key, rid);
      if (inserted !== null) {
        this.redistributionCount++;
        return { inserted, childIndex: key < parent.keys[idx - 1] ? idx - 1 : idx };
      }
    }
    if (idx < parent.children.length - 1) {
      const inserted = this._twoToThree(parent, idx, key, rid);
      this.twoToThreeSplitCount++;
      return { inserted, childIndex: this._childAfterTwoToThree(parent, idx, key) };
    } else if (idx > 0) {
      const inserted = this._twoToThree(parent, idx - 1, key, rid);
      this.twoToThreeSplitCount++;
      return { inserted, childIndex: this._childAfterTwoToThree(parent, idx - 1, key) };
    } else {
      this._splitChild(parent, idx);
    }
    let i = idx;
    while (i < parent.keys.length && key > parent.keys[i]) i++;
    return { inserted: false, childIndex: i };
  }

  _redistR(parent, idx, key, rid) {
    const c = parent.children[idx], r = parent.children[idx + 1];
    const allK = [...c.keys, parent.keys[idx], ...r.keys];
    const allV = [...c.values, parent.values[idx], ...r.values];
    const inserted = c.leaf;
    if (inserted) this._insertPair(allK, allV, key, rid);

    const leftCount = this._redistributionSep(allK, key, !inserted);
    if (leftCount === null) return null;
    const sep = leftCount;
    c.keys = allK.slice(0, sep);
    c.values = allV.slice(0, sep);
    parent.keys[idx] = allK[sep];
    parent.values[idx] = allV[sep];
    r.keys = allK.slice(sep + 1);
    r.values = allV.slice(sep + 1);

    if (!c.leaf) {
      const allC = [...c.children, ...r.children];
      c.children = allC.slice(0, sep + 1);
      r.children = allC.slice(sep + 1);
    }
    return inserted;
  }

  _redistL(parent, idx, key, rid) {
    const c = parent.children[idx], l = parent.children[idx - 1];
    const allK = [...l.keys, parent.keys[idx - 1], ...c.keys];
    const allV = [...l.values, parent.values[idx - 1], ...c.values];
    const inserted = c.leaf;
    if (inserted) this._insertPair(allK, allV, key, rid);

    const leftCount = this._redistributionSep(allK, key, !inserted);
    if (leftCount === null) return null;
    const sep = leftCount;
    l.keys = allK.slice(0, sep);
    l.values = allV.slice(0, sep);
    parent.keys[idx - 1] = allK[sep];
    parent.values[idx - 1] = allV[sep];
    c.keys = allK.slice(sep + 1);
    c.values = allV.slice(sep + 1);

    if (!c.leaf) {
      const allC = [...l.children, ...c.children];
      l.children = allC.slice(0, sep + 1);
      c.children = allC.slice(sep + 1);
    }
    return inserted;
  }

  // 2 full nodes + 1 separator -> 3 nodes + 2 separators.
  _twoToThree(parent, idx, key, rid) {
    const L = parent.children[idx], R = parent.children[idx + 1];
    const allK = [...L.keys, parent.keys[idx], ...R.keys];
    const allV = [...L.values, parent.values[idx], ...R.values];
    const inserted = L.leaf;
    if (inserted) this._insertPair(allK, allV, key, rid);
    const allC = L.leaf ? null : [...L.children, ...R.children];

    const total = allK.length;
    const remaining = total - 2;
    const base = Math.floor(remaining / 3);
    const extra = remaining - base * 3;
    const sa = base + (extra > 0 ? 1 : 0);
    const sb = base + (extra > 1 ? 1 : 0);
    const s1 = sa, s2 = sa + 1 + sb;

    const a = new BTreeNode(L.leaf);
    const b = new BTreeNode(L.leaf);
    const c = new BTreeNode(L.leaf);

    a.keys = allK.slice(0, s1);
    a.values = allV.slice(0, s1);
    b.keys = allK.slice(s1 + 1, s2);
    b.values = allV.slice(s1 + 1, s2);
    c.keys = allK.slice(s2 + 1);
    c.values = allV.slice(s2 + 1);

    if (allC) {
      a.children = allC.slice(0, s1 + 1);
      b.children = allC.slice(s1 + 1, s2 + 1);
      c.children = allC.slice(s2 + 1);
    }

    parent.keys.splice(idx, 1, allK[s1], allK[s2]);
    parent.values.splice(idx, 1, allV[s1], allV[s2]);
    parent.children.splice(idx, 2, a, b, c);
    return inserted;
  }

  _insertPair(keys, values, key, rid) {
    const i = lowerBound(keys, key);
    keys.splice(i, 0, key);
    values.splice(i, 0, rid);
  }

  _redistributionSep(keys, key, mustLeaveRoomForDescent) {
    let best = -1;
    let bestScore = Infinity;
    for (let sep = 1; sep < keys.length - 1; sep++) {
      const left = sep;
      const right = keys.length - sep - 1;
      if (left > this.maxKeys || right > this.maxKeys) continue;
      if (mustLeaveRoomForDescent) {
        const targetCount = key < keys[sep] ? left : right;
        if (targetCount >= this.maxKeys) continue;
      }
      const score = Math.abs(left - right);
      if (score < bestScore) {
        best = sep;
        bestScore = score;
      }
    }
    if (best < 0) return null;
    return best;
  }

  _childAfterTwoToThree(parent, idx, key) {
    if (key < parent.keys[idx]) return idx;
    if (key > parent.keys[idx + 1]) return idx + 2;
    return idx + 1;
  }
}

module.exports = { BStarTree };
