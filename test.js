"use strict";

// node --test test.js

const test = require("node:test");
const assert = require("node:assert/strict");

const { BTree } = require("./btree");
const { BTreeNode } = require("./btree");
const { BStarTree } = require("./bstartree");
const { BPlusTree } = require("./bplustree");

test("B-tree insert/search", () => {
  const t = new BTree(2);
  for (const [k, v] of [[10, 0], [20, 1], [5, 2], [6, 3], [12, 4]]) t.insert(k, v);
  assert.equal(t.search(6), 3);
  assert.equal(t.search(12), 4);
  assert.equal(t.search(99), null);
});

test("B+-tree range query", () => {
  const t = new BPlusTree(2);
  for (const [k, v] of [[10, 0], [20, 1], [5, 2], [6, 3], [12, 4]]) t.insert(k, v);
  assert.deepEqual(t.rangeQuery(6, 12), [3, 0, 4]);
});

test("B*-tree redistributes into a sibling with one free slot before splitting", () => {
  const t = new BStarTree(3);
  const root = new BTreeNode(false);
  const left = new BTreeNode(true);
  const right = new BTreeNode(true);

  root.keys = [50];
  root.values = [50];
  left.keys = [10, 20, 30, 40, 45];
  left.values = [10, 20, 30, 40, 45];
  right.keys = [60, 70, 80, 90];
  right.values = [60, 70, 80, 90];
  root.children = [left, right];
  t.root = root;
  t.size = 10;

  t.insert(35, 35);

  assert.equal(t.root.children.length, 2);
  assert.equal(t.search(35), 35);
  assert.equal(t.redistributionCount, 1);
  assert.equal(t.splitCount, 0);
});

test("B*-tree keeps nodes within capacity after inserts", () => {
  const keys = [
    883, 2558, 1432, 1393, 2880, 1747, 2565, 2978,
    222, 1098, 1296, 1155, 815, 996, 1158, 1198,
    23, 1829, 2496, 2417, 339, 2613, 1289, 1186,
  ];
  const t = new BStarTree(2);
  for (let i = 0; i < keys.length; i++) t.insert(keys[i], i);

  function check(node) {
    assert.ok(node.keys.length <= t.maxKeys);
    if (!node.leaf) assert.equal(node.children.length, node.keys.length + 1);
    for (const child of node.children) check(child);
  }

  check(t.root);
  for (let i = 0; i < keys.length; i++) assert.equal(t.search(keys[i]), i);
});

test("delete works", () => {
  for (const C of [BTree, BStarTree, BPlusTree]) {
    const t = new C(2);
    t.insert(10, 0);
    t.insert(20, 1);
    t.insert(5, 2);
    t.delete(10);
    assert.equal(t.search(10), null);
    assert.equal(t.search(20), 1);
    assert.equal(t.search(5), 2);
  }
});
