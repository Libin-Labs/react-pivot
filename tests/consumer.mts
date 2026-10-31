import { createElement } from 'react';
import { createPivot, validatePivotConfig, PivotTable } from '@lp-labs/react-pivot';
import type {
  PivotDimension,
  PivotMeasure,
  PivotResult,
  PivotTableProps,
} from '@lp-labs/react-pivot';

type Sale = { region: string; amount: number | null };
const dimensions: PivotDimension<Sale>[] = [{ id: 'region', getValue: (sale) => sale.region }];
const measures: PivotMeasure<Sale>[] = [
  { id: 'sum', operation: 'sum', getValue: (sale) => sale.amount },
  { id: 'count', operation: 'count' },
];
const result: PivotResult = createPivot([{ region: 'North', amount: 4 }], { dimensions, measures });
validatePivotConfig({ dimensions, measures });
const props: PivotTableProps<Sale> = {
  data: [],
  dimensions,
  measures,
  onDimensionChange: (ids) => {
    ids.push('region');
  },
};
createElement(PivotTable<Sale>, props);
void result.totals.sum;
// @ts-expect-error Numeric measures require an accessor.
const bad: PivotMeasure<Sale> = { id: 'bad', operation: 'sum' };
// @ts-expect-error Count does not accept a numeric accessor.
const invalidCount: PivotMeasure<Sale> = { id: 'bad', operation: 'count', getValue: () => 1 };
void bad;
void invalidCount;
