"use strict";

// B-tree. d = minimum degree, max keys per node = 2d - 1.

function lowerBound(arr, key) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

class BTreeNode {
  constructor(leaf = true) {
    this.leaf = leaf;
    this.keys = [];
    this.values = [];
    this.children = [];
  }
}

class BTree {
  constructor(d = 3) {
    this.d = d;
    this.maxKeys = 2 * d - 1;
    this.root = new BTreeNode(true);
    this.splitCount = 0;
    this.size = 0;
  }

  search(key) { return this._search(this.root, key); }

  _search(node, key) {
    const i = lowerBound(node.keys, key);
    if (i < node.keys.length && node.keys[i] === key) return node.values[i];
    if (node.leaf) return null;
    return this._search(node.children[i], key);
  }

  insert(key, rid) {
    if (this._update(this.root, key, rid)) return;
    const root = this.root;
    if (root.keys.length === this.maxKeys) {
      const r = new BTreeNode(false);
      r.children.push(root);
      this._splitChild(r, 0);
      this.root = r;
      this._insertNonFull(r, key, rid);
    } else {
      this._insertNonFull(root, key, rid);
    }
    this.size++;
  }

  _update(node, key, rid) {
    const i = lowerBound(node.keys, key);
    if (i < node.keys.length && node.keys[i] === key) {
      node.values[i] = rid;
      return true;
    }
    if (node.leaf) return false;
    return this._update(node.children[i], key, rid);
  }

  _insertNonFull(node, key, rid) {
    let i = lowerBound(node.keys, key);
    if (node.leaf) {
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, rid);
      return;
    }
    if (node.children[i].keys.length === this.maxKeys) {
      this._splitChild(node, i);
      if (key > node.keys[i]) i++;
      else if (key === node.keys[i]) { node.values[i] = rid; return; }
    }
    this._insertNonFull(node.children[i], key, rid);
  }

  _splitChild(parent, idx) {
    const d = this.d;
    const c = parent.children[idx];
    const s = new BTreeNode(c.leaf);
    const mk = c.keys[d - 1], mv = c.values[d - 1];
    s.keys = c.keys.splice(d, d - 1);
    s.values = c.values.splice(d, d - 1);
    c.keys.length = d - 1;
    c.values.length = d - 1;
    if (!c.leaf) s.children = c.children.splice(d, d);
    parent.keys.splice(idx, 0, mk);
    parent.values.splice(idx, 0, mv);
    parent.children.splice(idx + 1, 0, s);
    this.splitCount++;
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
    let i = lowerBound(node.keys, key);
    if (i < node.keys.length && node.keys[i] === key) {
      if (node.leaf) {
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        return true;
      }
      return this._deleteInternal(node, i);
    }
    if (node.leaf) return false;
    const atEnd = i === node.keys.length;
    if (node.children[i].keys.length < this.d) this._fill(node, i);
    if (atEnd && i > node.keys.length) return this._delete(node.children[i - 1], key);
    return this._delete(node.children[i], key);
  }

  _deleteInternal(node, i) {
    const key = node.keys[i];
    const L = node.children[i], R = node.children[i + 1];
    if (L.keys.length >= this.d) {
      const [k, v] = this._popMax(L);
      node.keys[i] = k; node.values[i] = v;
      return true;
    }
    if (R.keys.length >= this.d) {
      const [k, v] = this._popMin(R);
      node.keys[i] = k; node.values[i] = v;
      return true;
    }
    this._merge(node, i);
    return this._delete(L, key);
  }

  _popMax(node) {
    if (node.leaf) return [node.keys.pop(), node.values.pop()];
    const last = node.children.length - 1;
    if (node.children[last].keys.length < this.d) this._fill(node, last);
    return this._popMax(node.children[node.children.length - 1]);
  }

  _popMin(node) {
    if (node.leaf) return [node.keys.shift(), node.values.shift()];
    if (node.children[0].keys.length < this.d) this._fill(node, 0);
    return this._popMin(node.children[0]);
  }

  _fill(node, i) {
    if (i > 0 && node.children[i - 1].keys.length >= this.d) this._borrowL(node, i);
    else if (i < node.children.length - 1 && node.children[i + 1].keys.length >= this.d) this._borrowR(node, i);
    else if (i < node.children.length - 1) this._merge(node, i);
    else this._merge(node, i - 1);
  }

  _borrowL(node, i) {
    const c = node.children[i], s = node.children[i - 1];
    c.keys.unshift(node.keys[i - 1]);
    c.values.unshift(node.values[i - 1]);
    node.keys[i - 1] = s.keys.pop();
    node.values[i - 1] = s.values.pop();
    if (!c.leaf) c.children.unshift(s.children.pop());
  }

  _borrowR(node, i) {
    const c = node.children[i], s = node.children[i + 1];
    c.keys.push(node.keys[i]);
    c.values.push(node.values[i]);
    node.keys[i] = s.keys.shift();
    node.values[i] = s.values.shift();
    if (!c.leaf) c.children.push(s.children.shift());
  }

  _merge(node, i) {
    const L = node.children[i], R = node.children[i + 1];
    L.keys.push(node.keys[i]);
    L.values.push(node.values[i]);
    for (let j = 0; j < R.keys.length; j++) {
      L.keys.push(R.keys[j]);
      L.values.push(R.values[j]);
    }
    if (!L.leaf) for (const ch of R.children) L.children.push(ch);
    node.keys.splice(i, 1);
    node.values.splice(i, 1);
    node.children.splice(i + 1, 1);
  }

  rangeQuery(lo, hi) {
    const out = [];
    this._range(this.root, lo, hi, out);
    return out;
  }

  _range(node, lo, hi, out) {
    let i = lowerBound(node.keys, lo);
    if (node.leaf) {
      while (i < node.keys.length && node.keys[i] <= hi) {
        out.push(node.values[i]); i++;
      }
      return;
    }
    while (i < node.keys.length && node.keys[i] <= hi) {
      this._range(node.children[i], lo, hi, out);
      out.push(node.values[i]);
      i++;
    }
    this._range(node.children[i], lo, hi, out);
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

module.exports = { BTree, BTreeNode, lowerBound };
