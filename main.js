"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { BTree } = require("./btree");
const { BStarTree } = require("./bstartree");
const { BPlusTree } = require("./bplustree");

function loadStudents(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const p = line.split(",");
    if (p.length < 6) continue;
    out.push({
      id: Number(p[0]),
      name: p[1],
      gender: p[2],
      gpa: Number(p[3]),
      height: Number(p[4]),
      weight: Number(p[5]),
    });
  }
  return out;
}

// Fisher-Yates with a small fixed-seed LCG so the search / delete key
// sets are the same on every run. -> table numbers in the report stay
// reproducible.
function shuffle(arr, seed) {
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 0x100000000) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function ms() { return performance.now(); }

function main(csvPath) {
  console.log("loading", csvPath);
  const t0 = ms();
  const records = loadStudents(csvPath);
  console.log("loaded", records.length, "records in", (ms() - t0).toFixed(2), "ms");

  const ids = records.map((r) => r.id);

  const searchKeys = ids.slice();
  shuffle(searchKeys, 1);
  searchKeys.length = 10000;

  const delKeys = ids.slice();
  shuffle(delKeys, 2);
  delKeys.length = 2000;

  // dataset uses 9-digit IDs (2020xxxxx..2026xxxxx).
  const LO = 202000000;
  const HI = 202100000;

  for (const d of [3, 5, 10]) {
    console.log("\n=== d =", d, "(max keys =", 2 * d - 1, ") ===");

    const trees = [
      ["B-tree ", new BTree(d)],
      ["B*-tree", new BStarTree(d)],
      ["B+-tree", new BPlusTree(d)],
    ];

    // insert
    for (const [name, tree] of trees) {
      const t = ms();
      for (let i = 0; i < records.length; i++) tree.insert(records[i].id, i);
      const took = ms() - t;
      const s = tree.getStats();
      const extra = tree instanceof BStarTree
        ? ` redist=${tree.redistributionCount} 2to3=${tree.twoToThreeSplitCount}`
        : "";
      console.log(`${name} | insert ${took.toFixed(2)}ms | splits=${s.splitCount} | nodes=${s.nodeCount} | h=${s.height} | util=${(s.utilization * 100).toFixed(1)}%${extra}`);
    }

    // search
    console.log("-- search --");
    for (const [name, tree] of trees) {
      const t = ms();
      let hits = 0;
      for (const k of searchKeys) if (tree.search(k) !== null) hits++;
      const took = ms() - t;
      console.log(`${name} | total ${took.toFixed(2)}ms | mean ${(took / searchKeys.length * 1000).toFixed(3)}us | hits=${hits}`);
    }

    // range
    console.log("-- range --");
    for (const [name, tree] of trees) {
      const t = ms();
      const rids = tree.rangeQuery(LO, HI);
      let n = 0, gpa = 0, h = 0;
      for (const rid of rids) {
        const r = records[rid];
        if (r.gender === "Male") { n++; gpa += r.gpa; h += r.height; }
      }
      const took = ms() - t;
      console.log(`${name} | ${took.toFixed(2)}ms | matched=${n} | avgGPA=${(gpa / n).toFixed(3)} | avgH=${(h / n).toFixed(2)}`);
    }

    // delete
    console.log("-- delete --");
    for (const [name, tree] of trees) {
      const t = ms();
      let n = 0;
      for (const k of delKeys) if (tree.delete(k)) n++;
      const took = ms() - t;
      const s = tree.getStats();
      console.log(`${name} | ${took.toFixed(2)}ms | deleted=${n} | nodes=${s.nodeCount} | h=${s.height} | util=${(s.utilization * 100).toFixed(1)}%`);
    }
  }
}

if (require.main === module) {
  const csv = process.argv[2] || path.join(__dirname, "student.csv");
  main(csv);
}

module.exports = { loadStudents, main };
