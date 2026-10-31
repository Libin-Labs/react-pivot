# @lp-labs/react-pivot

Package version: `0.1.0`.

An original, standalone typed aggregation engine and React pivot results
table with interactive grouping controls. Zero runtime dependencies; React
is a peer. ESM and CommonJS expose the same API and declarations.

## Install

```sh
npm install @lp-labs/react-pivot react
```

React `^18.2.0 || ^19.0.0` is supported. Supply a compatible renderer.
Optional CSS must be imported explicitly.

```tsx
import { useState } from "react";
import { PivotTable, createPivot } from "@lp-labs/react-pivot";
import type { PivotDimension, PivotMeasure } from "@lp-labs/react-pivot";
import "@lp-labs/react-pivot/styles.css";

type Sale = { region: string; product: string; amount: number | null };
const data: Sale[] = [
  { region: "North", product: "Book", amount: 12 },
  { region: "South", product: "Book", amount: 24 },
  { region: "North", product: "Pen", amount: null },
];
const dimensions: PivotDimension<Sale>[] = [
  { id: "region", label: "Region", getValue: (sale) => sale.region },
  { id: "product", label: "Product", getValue: (sale) => sale.product },
];
const measures: PivotMeasure<Sale>[] = [
  { id: "revenue", label: "Revenue", operation: "sum", getValue: (sale) => sale.amount },
  { id: "average", label: "Average", operation: "avg", getValue: (sale) => sale.amount },
  { id: "orders", label: "Orders", operation: "count" },
];

export function SalesSummary() {
  const [ids, setIds] = useState<string[]>(["region"]);
  return (
    <PivotTable
      data={data}
      dimensions={dimensions}
      measures={measures}
      dimensionIds={ids}
      onDimensionChange={setIds}
      formatValue={(value, measure) => value === null ? "-" :
        measure.id === "orders" ? String(value) : value.toFixed(2)}
    />
  );
}

const result = createPivot(data, { dimensions, measures });
console.log(result.totals.revenue); // 36
console.log(result.totals.average); // 18, not the average of group averages
```

Field access uses caller-supplied typed functions, never paths interpreted
as code. Accessors should be pure and deterministic. Nested records can be
read normally: `getValue: sale => sale.customer.region`.

## Types and pure API

```ts
type PivotKey = string | number | boolean | null;
type Aggregation = "sum" | "count" | "min" | "max" | "avg";

interface PivotDimension<T> {
  id: string;
  label?: string;
  getValue: (record: T) => PivotKey;
}

// PivotMeasure<T> is a discriminated union:
// { id, label?, operation: "count", getValue?: never }
// or { id, label?, operation: "sum" | "min" | "max" | "avg",
//      getValue: (record: T) => number | null | undefined }

interface PivotConfig<T> {
  dimensions: readonly PivotDimension<T>[];
  measures: readonly PivotMeasure<T>[];
}
interface PivotRow {
  keys: PivotKey[];
  values: Record<string, number | null>;
  recordCount: number;
}
interface PivotResult {
  rows: PivotRow[];
  totals: Record<string, number | null>;
  recordCount: number;
}
```

`createPivot<T>(data: readonly T[], config: PivotConfig<T>): PivotResult`
returns rows in first-seen compound-key order. `keys` follow config dimension
order. `values` and `totals` use measure IDs and are null-prototype objects;
read with `values[id]` or `Object.entries`, not `values.hasOwnProperty`.
Dimensions distinguish number `1` from string `"1"`, booleans, and null.
Positive and negative zero belong to the same group. Keys containing
delimiters or `"__proto__"` do not collide. Inputs are never mutated.

`validatePivotConfig<T>(config: PivotConfig<T>): void` validates definitions.
IDs must be nonempty and unique **within** their dimension/measure list.
The two lists may share IDs. An empty measure list is allowed.

| Operation | Missing numeric values | Empty aggregate |
| --- | --- | --- |
| `count` | Counts every record, without an accessor | `0` |
| `sum` | Skips `null` and `undefined` | `0` |
| `min` / `max` | Skips `null` and `undefined` | `null` |
| `avg` | Skips `null` and `undefined`; divides by numeric count | `null` |

Grand totals are accumulated from raw records, not rendered groups.
Without dimensions, nonempty data produces one `keys: []` row. Empty data
always produces no rows and the empty totals above. Each numeric measure
accessor is called once per record (its value feeds both group and totals).

Invalid IDs, operations, missing accessors, non-primitive dimension values,
nonfinite dimension numbers, and nonnumeric/nonfinite numeric measure
values throw `TypeError`. Numeric strings are not coerced. Sum/average
accumulator overflow throws `RangeError`; other arithmetic uses ordinary
JavaScript floating-point precision. Accessor exceptions propagate.

## PivotTableProps&lt;T&gt;

| Prop | Default | Contract |
| --- | --- | --- |
| `data` | required | Readonly records |
| `dimensions` | required | All available dimension definitions |
| `measures` | required | Displayed aggregation definitions |
| `dimensionIds` | internal selection | Optional readonly IDs in grouping/display order |
| `onDimensionChange(ids: string[])` | absent | Selection proposal after toggling a checkbox |
| `showTotals` | `true` | Render grand-total footer |
| `emptyMessage` | `"No records"` | Empty result text |
| `formatValue(value, measure)` | null becomes `"-"`, otherwise `String(value)` | Returns display text only |
| `className` | `""` | Extra root class |
| `aria-label` | `"Pivot table"` | Section label and caption |

Without `dimensionIds`, selection starts with all dimensions and updates
internally. Removed dimension definitions are filtered out of that internal
selection; newly supplied definitions are available but not auto-selected.
With `dimensionIds`, persist `onDimensionChange` into your state. Unknown or
duplicate selected IDs throw `TypeError`. Toggling on appends an ID, toggling
off removes it; zero selected dimensions means one all-records group.

The first dimension columns show key text; null displays `(null)`. A literal
string `"(null)"` may look the same but remains a separate engine group.
Measure selectors and operation editors are not included; change the
`measures` prop yourself. Engine errors and formatter/callback errors
propagate; use an application error boundary when appropriate.

## Styles and accessibility

Import `@lp-labs/react-pivot/styles.css`, or style `.lp-pivot`,
`.lp-pivot-controls`, `.lp-pivot-scroll`, and `.lp-pivot-status` yourself.
`--lp-pivot-border` and `--lp-pivot-accent` customize the optional CSS:

```css
.sales-pivot { --lp-pivot-accent: #6d28d9; }
```

Pass `className="sales-pivot"`. Native checkbox labels, a fieldset/legend,
table caption, scoped headers, and a live record/group count support
standard keyboard and assistive-technology use. There is no spreadsheet
focus model, drag-and-drop, or keyboard cell editing.

## Bounds

This is a row-grouped aggregate table, not a cross-tab column-axis engine.
There is no sorting UI, subtotal hierarchy, calculated-expression evaluator,
remote query execution, export, virtualization, or worker offloading.
Work is synchronous and in memory; grouping is approximately
`O(records * (dimensions + measures))` with per-group measure storage.
Rendering is proportional to result size. Pre-filter/limit large datasets.
No production certification or universal accessibility compatibility is
claimed; test with your application, numerical requirements, and users.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
