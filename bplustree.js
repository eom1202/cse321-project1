"use strict";

// B+-tree. RIDs only in leaves, leaves linked via next.

const { lowerBound } = require("./btree");

class BPlusNode {
  constructor(leaf = true) {
    this.leaf = leaf;
    this.keys = [];
    this.values = [];
    this.children = [];
    this.next = null;
  }
}

class BPlusTree {
  constructor(d = 3) {
    this.d = d;
    this.maxKeys = 2 * d - 1;
    this.minLeaf = Math.ceil(this.maxKeys / 2);
    this.minInt = d - 1;
    this.root = new BPlusNode(true);
    this.splitCount = 0;
    this.size = 0;
  }

  _childIndex(node, key) {
    let i = 0;
    while (i < node.keys.length && key >= node.keys[i]) i++;
    return i;
  }

  _findLeaf(key) {
    let node = this.root;
    while (!node.leaf) node = node.children[this._childIndex(node, key)];
    return node;
  }

  search(key) {
    const leaf = this._findLeaf(key);
    const i = lowerBound(leaf.keys, key);
    if (i < leaf.keys.length && leaf.keys[i] === key) return leaf.values[i];
    return null;
  }

  insert(key, rid) {
    const r = this._insert(this.root, key, rid);
    if (r.split) {
      const nr = new BPlusNode(false);
      nr.keys.push(r.split.key);
      nr.children.push(this.root, r.split.node);
      this.root = nr;
    }
    if (r.inserted) this.size++;
  }

  _insert(node, key, rid) {
    if (node.leaf) {
      const i = lowerBound(node.keys, key);
      if (i < node.keys.length && node.keys[i] === key) {
        node.values[i] = rid;
        return { inserted: false, split: null };
      }
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, rid);
      if (node.keys.length > this.maxKeys) return { inserted: true, split: this._splitLeaf(node) };
      return { inserted: true, split: null };
    }
    const idx = this._childIndex(node, key);
    const r = this._insert(node.children[idx], key, rid);
    if (!r.split) return r;
    node.keys.splice(idx, 0, r.split.key);
    node.children.splice(idx + 1, 0, r.split.node);
    if (node.keys.length > this.maxKeys) return { inserted: r.inserted, split: this._splitInt(node) };
    return { inserted: r.inserted, split: null };
  }

  _splitLeaf(leaf) {
    const mid = Math.ceil(leaf.keys.length / 2);
    const right = new BPlusNode(true);
    right.keys = leaf.keys.splice(mid);
    right.values = leaf.values.splice(mid);
    right.next = leaf.next;
    leaf.next = right;
    this.splitCount++;
    return { key: right.keys[0], node: right };
  }

  _splitInt(node) {
    const total = node.keys.length;
    const mid = Math.floor(total / 2);
    const midKey = node.keys[mid];
    const right = new BPlusNode(false);
    right.keys = node.keys.splice(mid + 1);
    right.children = node.children.splice(mid + 1);
    node.keys.length = mid;
    this.splitCount++;
    return { key: midKey, node: right };
  }

  delete(key) {
    const ok = this._delete(this.root, key);
    if (ok) {
      this.size--;
      if (!this.root.leaf && this.root.keys.length === 0) {
        this.root = this.root.children[0];
      }
    }
    return ok;
  }

  _delete(node, key) {
    if (node.leaf) {
      const i = lowerBound(node.keys, key);
      if (i < node.keys.length && node.keys[i] === key) {
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        return true;
      }
      return false;
    }
    const idx = this._childIndex(node, key);
    const c = node.children[idx];
    const ok = this._delete(c, key);
    if (!ok) return false;
    if (c.leaf) {
      if (c.keys.length < this.minLeaf) this._fixLeaf(node, idx);
      else if (idx > 0) node.keys[idx - 1] = c.keys[0];
    } else if (c.keys.length < this.minInt) {
      this._fixInt(node, idx);
    }
    return true;
  }

  _fixLeaf(parent, idx) {
    const c = parent.children[idx];
    const L = idx > 0 ? parent.children[idx - 1] : null;
    const R = idx < parent.children.length - 1 ? parent.children[idx + 1] : null;
    if (L && L.keys.length > this.minLeaf) {
      c.keys.unshift(L.keys.pop());
      c.values.unshift(L.values.pop());
      parent.keys[idx - 1] = c.keys[0];
      return;
    }
    if (R && R.keys.length > this.minLeaf) {
      c.keys.push(R.keys.shift());
      c.values.push(R.values.shift());
      parent.keys[idx] = R.keys[0];
      if (idx > 0) parent.keys[idx - 1] = c.keys[0];
      return;
    }
    if (L) {
      L.keys.push(...c.keys);
      L.values.push(...c.values);
      L.next = c.next;
      parent.keys.splice(idx - 1, 1);
      parent.children.splice(idx, 1);
    } else if (R) {
      c.keys.push(...R.keys);
      c.values.push(...R.values);
      c.next = R.next;
      parent.keys.splice(idx, 1);
      parent.children.splice(idx + 1, 1);
    }
  }

  _fixInt(parent, idx) {
    const c = parent.children[idx];
    const L = idx > 0 ? parent.children[idx - 1] : null;
    const R = idx < parent.children.length - 1 ? parent.children[idx + 1] : null;
    if (L && L.keys.length > this.minInt) {
      c.keys.unshift(parent.keys[idx - 1]);
      c.children.unshift(L.children.pop());
      parent.keys[idx - 1] = L.keys.pop();
      return;
    }
    if (R && R.keys.length > this.minInt) {
      c.keys.push(parent.keys[idx]);
      c.children.push(R.children.shift());
      parent.keys[idx] = R.keys.shift();
      return;
    }
    if (L) {
      L.keys.push(parent.keys[idx - 1]);
      L.keys.push(...c.keys);
      L.children.push(...c.children);
      parent.keys.splice(idx - 1, 1);
      parent.children.splice(idx, 1);
    } else if (R) {
      c.keys.push(parent.keys[idx]);
      c.keys.push(...R.keys);
      c.children.push(...R.children);
      parent.keys.splice(idx, 1);
      parent.children.splice(idx + 1, 1);
    }
  }

  rangeQuery(lo, hi) {
    const out = [];
    let leaf = this._findLeaf(lo);
    let i = lowerBound(leaf.keys, lo);
    while (leaf) {
      while (i < leaf.keys.length && leaf.keys[i] <= hi) {
        out.push(leaf.values[i]); i++;
      }
      if (i < leaf.keys.length) break;
      leaf = leaf.next;
      i = 0;
    }
    return out;
  }

  getStats() {
    const s = this._count(this.root, 1);
    const cap = s.nodeCount * this.maxKeys;
    return {
      nodeCount: s.nodeCount,
      keyCount: s.keyCount,
      height: s.height,
      splitCount: this.splitCount,
      utilization: cap === 0 ? 0 : s.keyCount / cap,
    };
  }

  _count(node, depth) {
    let nc = 1, kc = node.keys.length, h = depth;
    for (const c of node.children) {
      const cs = this._count(c, depth + 1);
      nc += cs.nodeCount;
      kc += cs.keyCount;
      if (cs.height > h) h = cs.height;
    }
    return { nodeCount: nc, keyCount: kc, height: h };
  }
}

module.exports = { BPlusTree, BPlusNode };
