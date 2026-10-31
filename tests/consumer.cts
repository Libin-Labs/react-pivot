import pivot = require('@lp-labs/react-pivot');
import { createElement } from 'react';

type Row = { amount: number };
const config: pivot.PivotConfig<Row> = {
  dimensions: [],
  measures: [{ id: 'sum', operation: 'sum', getValue: (row) => row.amount }],
};
const result: pivot.PivotResult = pivot.createPivot([{ amount: 2 }], config);
pivot.validatePivotConfig(config);
createElement(pivot.PivotTable<Row>, { data: [], ...config });
void result;
