import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('dimension controls regroup results, report selection, and support controlled updates', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Event',
  ]) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement: h, act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { PivotTable } = await import('../dist/esm/index.js');
  const container = document.getElementById('root');
  const root = createRoot(container);
  const data = [
    { region: 'North', team: 'A', amount: 10 },
    { region: 'South', team: 'A', amount: 20 },
    { region: 'North', team: 'B', amount: null },
  ];
  const dimensions = [
    { id: 'region', label: 'Region', getValue: (record) => record.region },
    { id: 'team', label: 'Team', getValue: (record) => record.team },
  ];
  const measures = [
    { id: 'sales', label: 'Sales', operation: 'sum', getValue: (record) => record.amount },
  ];
  const selections = [];
  function App() {
    const [ids, setIds] = useState(['region', 'team']);
    return h(PivotTable, {
      data,
      dimensions,
      measures,
      dimensionIds: ids,
      onDimensionChange: (next) => {
        selections.push(next);
        setIds(next);
      },
    });
  }
  try {
    await act(async () => root.render(h(App)));
    assert.equal(container.querySelectorAll('tbody tr').length, 3);
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    await act(async () => boxes[1].click());
    assert.deepEqual(selections.at(-1), ['region']);
    assert.equal(container.querySelectorAll('tbody tr').length, 2);
    assert.equal(container.querySelector('tbody tr td').textContent, '10');
    await act(async () => boxes[0].click());
    assert.deepEqual(selections.at(-1), []);
    assert.equal(container.querySelectorAll('tbody tr').length, 1);
    assert.equal(container.querySelector('tbody th').textContent, 'All records');
    assert.equal(container.querySelector('tbody td').textContent, '30');
    assert.equal(container.querySelector('tfoot td').textContent, '30');
    await act(async () => boxes[1].click());
    assert.deepEqual(selections.at(-1), ['team']);
    assert.equal(container.querySelector('tbody th').textContent, 'A');
    await act(async () =>
      root.render(
        h(PivotTable, {
          data: [],
          dimensions,
          measures,
          emptyMessage: 'Nothing here',
          showTotals: false,
        }),
      ),
    );
    assert.equal(container.querySelector('tfoot'), null);
    assert.equal(container.querySelector('tbody td').textContent, 'Nothing here');
    await act(async () => root.render(h(PivotTable, { data, dimensions, measures })));
    await act(async () => container.querySelectorAll('input')[0].click());
    assert.equal(container.querySelectorAll('tbody tr').length, 2);
    assert.equal(container.querySelector('thead th').textContent, 'Team');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
