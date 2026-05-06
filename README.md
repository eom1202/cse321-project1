# CSE321 Project #1

B-tree, B*-tree, and B+-tree implementations + experiments on the
100,000-record student dataset.

## Environment

- Node.js v24.11.0 was used for the report experiments
  - Node.js v18 or newer should also work
- no external libraries
- `student.csv` should be in the same folder

## Run

```
node main.js student.csv
```

For each `d = 3, 5, 10` the program prints insert / point search /
range query / delete results.

## Test

```
node --test test.js
```

## Files

- `main.js` - reads the csv and runs the experiments
- `btree.js` - B-tree
- `bstartree.js` - B*-tree
- `bplustree.js` - B+-tree
- `test.js` - unit / regression tests

## Notes

- `d` is the minimum degree, so max keys per node = `2d - 1`.
- range query uses `[202000000, 202100000]`. The PDF example range is
  8 digits but the dataset has 9-digit IDs (`2020xxxxx..2026xxxxx`),
  so I used the matching 9-digit range.
