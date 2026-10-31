import { useState } from 'react';
import { createPivot, validatePivotConfig } from './pivot.js';
import type { PivotDimension, PivotMeasure } from './pivot.js';

export interface PivotTableProps<T> {
  data: readonly T[];
  dimensions: readonly PivotDimension<T>[];
  measures: readonly PivotMeasure<T>[];
  dimensionIds?: readonly string[];
  onDimensionChange?: (ids: string[]) => void;
  showTotals?: boolean;
  emptyMessage?: string;
  formatValue?: (value: number | null, measure: PivotMeasure<T>) => string;
  className?: string;
  'aria-label'?: string;
}

export function PivotTable<T>({
  data,
  dimensions,
  measures,
  dimensionIds,
  onDimensionChange,
  showTotals = true,
  emptyMessage = 'No records',
  formatValue = (value) => (value === null ? '-' : String(value)),
  className = '',
  'aria-label': label = 'Pivot table',
}: PivotTableProps<T>) {
  validatePivotConfig({ dimensions, measures });
  const [internalIds, setInternalIds] = useState(() => dimensions.map((dimension) => dimension.id));
  const ids =
    dimensionIds ?? internalIds.filter((id) => dimensions.some((dimension) => dimension.id === id));
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !dimensions.some((dimension) => dimension.id === id))
  ) {
    throw new TypeError('Selected dimension IDs must be unique and known.');
  }
  const selected = ids.map((id) => dimensions.find((dimension) => dimension.id === id)!);
  const result = createPivot(data, { dimensions: selected, measures });
  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...ids, id] : ids.filter((value) => value !== id);
    if (dimensionIds === undefined) setInternalIds(next);
    onDimensionChange?.(next);
  };

  return (
    <section className={`lp-pivot ${className}`} aria-label={label}>
      <fieldset className="lp-pivot-controls">
        <legend>Group by</legend>
        {dimensions.map((dimension) => (
          <label key={dimension.id}>
            <input
              type="checkbox"
              checked={ids.includes(dimension.id)}
              onChange={(event) => toggle(dimension.id, event.target.checked)}
            />
            {dimension.label ?? dimension.id}
          </label>
        ))}
      </fieldset>
      <div className="lp-pivot-scroll">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              {selected.length ? (
                selected.map((dimension) => (
                  <th scope="col" key={dimension.id}>
                    {dimension.label ?? dimension.id}
                  </th>
                ))
              ) : (
                <th scope="col">Group</th>
              )}
              {measures.map((measure) => (
                <th scope="col" key={measure.id}>
                  {measure.label ?? measure.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index}>
                {row.keys.length ? (
                  row.keys.map((key, keyIndex) => (
                    <th scope="row" key={keyIndex}>
                      {key === null ? '(null)' : String(key)}
                    </th>
                  ))
                ) : (
                  <th scope="row">All records</th>
                )}
                {measures.map((measure) => (
                  <td key={measure.id}>{formatValue(row.values[measure.id], measure)}</td>
                ))}
              </tr>
            ))}
            {!result.rows.length && (
              <tr>
                <td colSpan={Math.max(1, selected.length) + measures.length}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
          {showTotals && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={Math.max(1, selected.length)}>
                  Total
                </th>
                {measures.map((measure) => (
                  <td key={measure.id}>{formatValue(result.totals[measure.id], measure)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="lp-pivot-status" role="status">
        {result.recordCount} records; {result.rows.length} groups
      </p>
    </section>
  );
}
