export type PivotKey = string | number | boolean | null;
export type Aggregation = 'sum' | 'count' | 'min' | 'max' | 'avg';

export interface PivotDimension<T> {
  id: string;
  label?: string;
  getValue: (record: T) => PivotKey;
}

export type PivotMeasure<T> = {
  id: string;
  label?: string;
} & (
  | { operation: 'count'; getValue?: never }
  | { operation: Exclude<Aggregation, 'count'>; getValue: (record: T) => number | null | undefined }
);

export interface PivotConfig<T> {
  dimensions: readonly PivotDimension<T>[];
  measures: readonly PivotMeasure<T>[];
}

export interface PivotRow {
  keys: PivotKey[];
  values: Record<string, number | null>;
  recordCount: number;
}

export interface PivotResult {
  rows: PivotRow[];
  totals: Record<string, number | null>;
  recordCount: number;
}

interface Accumulator {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
}

export function validatePivotConfig<T>(config: PivotConfig<T>): void {
  for (const fields of [config.dimensions, config.measures]) {
    const ids = new Set<string>();
    for (const field of fields) {
      if (typeof field.id !== 'string' || !field.id.trim() || ids.has(field.id)) {
        throw new TypeError(
          'Dimension and measure IDs must be nonempty and unique within each list.',
        );
      }
      ids.add(field.id);
    }
  }
  for (const dimension of config.dimensions) {
    if (typeof dimension.getValue !== 'function')
      throw new TypeError('Dimensions need a getValue function.');
  }
  for (const measure of config.measures) {
    if (!['sum', 'count', 'min', 'max', 'avg'].includes(measure.operation)) {
      throw new TypeError(`Unknown aggregation: ${measure.operation}.`);
    }
    if (measure.operation !== 'count' && typeof measure.getValue !== 'function') {
      throw new TypeError('Numeric measures need a getValue function.');
    }
  }
}

function fresh(size: number): Accumulator[] {
  return Array.from({ length: size }, () => ({ count: 0, sum: 0, min: null, max: null }));
}

function update(acc: Accumulator, value: number | null | undefined, operation: Aggregation): void {
  if (operation === 'count') {
    acc.count++;
    return;
  }
  if (value == null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Numeric measures must return finite numbers, null, or undefined.');
  }
  acc.count++;
  if (operation === 'sum' || operation === 'avg') {
    acc.sum += value;
    if (!Number.isFinite(acc.sum)) throw new RangeError('Numeric aggregate overflow.');
  }
  acc.min = acc.min === null ? value : Math.min(acc.min, value);
  acc.max = acc.max === null ? value : Math.max(acc.max, value);
}

function finish<T>(
  accumulators: Accumulator[],
  measures: readonly PivotMeasure<T>[],
): Record<string, number | null> {
  const result: Record<string, number | null> = Object.create(null);
  measures.forEach((measure, index) => {
    const acc = accumulators[index];
    switch (measure.operation) {
      case 'count':
        result[measure.id] = acc.count;
        break;
      case 'sum':
        result[measure.id] = acc.sum;
        break;
      case 'avg':
        result[measure.id] = acc.count ? acc.sum / acc.count : null;
        break;
      case 'min':
        result[measure.id] = acc.min;
        break;
      case 'max':
        result[measure.id] = acc.max;
        break;
    }
  });
  return result;
}

export function createPivot<T>(data: readonly T[], config: PivotConfig<T>): PivotResult {
  validatePivotConfig(config);
  const { dimensions, measures } = config;
  const totals = fresh(measures.length);
  const groups = new Map<
    string,
    { keys: PivotKey[]; accumulators: Accumulator[]; recordCount: number }
  >();
  for (const record of data) {
    const keys = dimensions.map((dimension) => {
      const key = dimension.getValue(record);
      if (
        key !== null &&
        typeof key !== 'string' &&
        typeof key !== 'number' &&
        typeof key !== 'boolean'
      ) {
        throw new TypeError('Dimension values must be string, finite number, boolean, or null.');
      }
      if (typeof key === 'number' && !Number.isFinite(key))
        throw new TypeError('Dimension numbers must be finite.');
      return key;
    });
    const signature = JSON.stringify(keys);
    let group = groups.get(signature);
    if (!group) {
      group = { keys, accumulators: fresh(measures.length), recordCount: 0 };
      groups.set(signature, group);
    }
    group.recordCount++;
    measures.forEach((measure, index) => {
      const value = measure.operation === 'count' ? undefined : measure.getValue(record);
      update(group.accumulators[index], value, measure.operation);
      update(totals[index], value, measure.operation);
    });
  }
  return {
    rows: [...groups.values()].map((group) => ({
      keys: group.keys,
      values: finish(group.accumulators, measures),
      recordCount: group.recordCount,
    })),
    totals: finish(totals, measures),
    recordCount: data.length,
  };
}
