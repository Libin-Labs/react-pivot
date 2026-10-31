import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPivot, validatePivotConfig } from '../dist/esm/index.js';

const dimensions = [{ id: 'region', getValue: (record) => record.region }];
const measures = [
  { id: 'sum', operation: 'sum', getValue: (record) => record.amount },
  { id: 'count', operation: 'count' },
  { id: 'min', operation: 'min', getValue: (record) => record.amount },
  { id: 'max', operation: 'max', getValue: (record) => record.amount },
  { id: 'avg', operation: 'avg', getValue: (record) => record.amount },
];

test('all aggregations, null policy, first-seen grouping, and weighted grand average', () => {
  const data = Object.freeze([
    Object.freeze({ region: 'north', amount: 2 }),
    Object.freeze({ region: 'south', amount: 8 }),
    Object.freeze({ region: 'north', amount: 4 }),
    Object.freeze({ region: 'north', amount: null }),
    Object.freeze({ region: 'empty', amount: undefined }),
  ]);
  const result = createPivot(data, { dimensions, measures });
  assert.deepEqual(
    result.rows.map((row) => row.keys),
    [['north'], ['south'], ['empty']],
  );
  assert.deepEqual({ ...result.rows[0].values }, { sum: 6, count: 3, min: 2, max: 4, avg: 3 });
  assert.deepEqual(
    { ...result.rows[2].values },
    { sum: 0, count: 1, min: null, max: null, avg: null },
  );
  assert.equal(result.totals.avg, 14 / 3);
  assert.equal(result.totals.count, 5);
  assert.equal(result.rows[0].recordCount, 3);
});

test('typed compound keys have no delimiter, primitive-type, or prototype collisions', () => {
  const data = [
    { a: 1, b: 'x|y' },
    { a: '1', b: 'x|y' },
    { a: null, b: false },
    { a: '__proto__', b: true },
  ];
  const result = createPivot(data, {
    dimensions: [
      { id: 'a', getValue: (row) => row.a },
      { id: 'b', getValue: (row) => row.b },
    ],
    measures: [{ id: '__proto__', operation: 'count' }],
  });
  assert.equal(result.rows.length, 4);
  assert.equal(result.totals.__proto__, 4);
  assert.equal(Object.getPrototypeOf(result.totals), null);
});

test('zero dimensions and empty inputs have defined totals', () => {
  const result = createPivot([{ amount: -2 }, { amount: 3 }], { dimensions: [], measures });
  assert.deepEqual(result.rows[0].keys, []);
  assert.equal(result.rows[0].values.sum, 1);
  const empty = createPivot([], { dimensions, measures });
  assert.deepEqual(empty.rows, []);
  assert.deepEqual({ ...empty.totals }, { sum: 0, count: 0, min: null, max: null, avg: null });
});

test('rejects invalid configs, values, nonfinite keys, and numeric overflow', () => {
  assert.throws(
    () => validatePivotConfig({ dimensions: [dimensions[0], dimensions[0]], measures }),
    TypeError,
  );
  assert.throws(
    () => createPivot([], { dimensions, measures: [{ id: '', operation: 'count' }] }),
    TypeError,
  );
  assert.throws(
    () => createPivot([], { dimensions, measures: [{ id: 'x', operation: 'median' }] }),
    TypeError,
  );
  assert.throws(() => createPivot([{ region: NaN }], { dimensions, measures: [] }), TypeError);
  assert.throws(() => createPivot([{ region: {} }], { dimensions, measures: [] }), TypeError);
  for (const amount of [NaN, Infinity, '3']) {
    assert.throws(
      () => createPivot([{ region: 'x', amount }], { dimensions, measures }),
      TypeError,
    );
  }
  assert.throws(
    () =>
      createPivot([{ amount: Number.MAX_VALUE }, { amount: Number.MAX_VALUE }], {
        dimensions: [],
        measures,
      }),
    RangeError,
  );
});

test('accessors run once per measure per row and CJS matches ESM', () => {
  let calls = 0;
  const config = {
    dimensions: [],
    measures: [
      {
        id: 'x',
        operation: 'sum',
        getValue: (row) => {
          calls++;
          return row;
        },
      },
    ],
  };
  const result = createPivot([1, 2, 3], config);
  assert.equal(calls, 3);
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(
    Object.keys(cjs).sort(),
    ['PivotTable', 'createPivot', 'validatePivotConfig'].sort(),
  );
  assert.deepEqual(cjs.createPivot([1, 2, 3], config), result);
});
