import { describe, expect, it } from 'vitest';
import CubeEngine from '../core/CubeEngine';
import mdhist from './fixtures/test-mdhist.json';

const engine = CubeEngine(mdhist.dimensions);
const { cells } = mdhist;

describe('filterCells', () => {
  it('returns all cells when filters is empty', () => {
    expect(engine.filterCells(cells, [])).toHaveLength(cells.length);
  });

  it('eq: returns only matching cells', () => {
    const result = engine.filterCells(cells, [{ field: 'gender', operation: 'eq', values: 'M' }]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.gender === 'M')).toBe(true);
  });

  it('eq: returns empty array when no match', () => {
    const result = engine.filterCells(cells, [{ field: 'gender', operation: 'eq', values: 'X' }]);
    expect(result).toHaveLength(0);
  });

  it('ne: excludes the specified value', () => {
    const result = engine.filterCells(cells, [{ field: 'gender', operation: 'ne', values: 'M' }]);
    expect(result.every((c) => c.gender !== 'M')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('in: returns cells matching any listed value', () => {
    const result = engine.filterCells(cells, [
      { field: 'condition', operation: 'in', values: ['diabetes', 'hypertension'] },
    ]);
    expect(result.every((c) => ['diabetes', 'hypertension'].includes(c.condition))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('nin: excludes cells matching any listed value', () => {
    const result = engine.filterCells(cells, [
      { field: 'condition', operation: 'nin', values: ['diabetes', 'hypertension'] },
    ]);
    expect(result.every((c) => !['diabetes', 'hypertension'].includes(c.condition))).toBe(true);
  });

  it('range (ordinal): matches values within index bounds', () => {
    // age_group ordinal: ['65-74', '75-84', '85+']
    const result = engine.filterCells(cells, [
      { field: 'age_group', operation: 'range', values: ['65-74', '75-84'] },
    ]);
    expect(result.every((c) => ['65-74', '75-84'].includes(c.age_group))).toBe(true);
    expect(result.every((c) => c.age_group !== '85+')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('range (ordinal): excludes values outside bounds', () => {
    const result = engine.filterCells(cells, [
      { field: 'age_group', operation: 'range', values: ['75-84', '85+'] },
    ]);
    expect(result.every((c) => c.age_group !== '65-74')).toBe(true);
  });

  it('multiple filters are AND-ed', () => {
    const result = engine.filterCells(cells, [
      { field: 'gender', operation: 'eq', values: 'F' },
      { field: 'age_group', operation: 'eq', values: '85+' },
    ]);
    expect(result.every((c) => c.gender === 'F' && c.age_group === '85+')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('unknown operation passes all cells', () => {
    const result = engine.filterCells(cells, [{ field: 'gender', operation: 'BOGUS', values: 'M' }]);
    expect(result).toHaveLength(cells.length);
  });
});

describe('marginalize', () => {
  it('returns one entry per distinct field value', () => {
    const result = engine.marginalize(cells, 'gender', ['count']);
    const values = result.map((d) => d.value);
    expect(values).toContain('M');
    expect(values).toContain('F');
  });

  it('sums count correctly across all cells for a gender', () => {
    const result = engine.marginalize(cells, 'gender', ['count']);
    const mEntry = result.find((d) => d.value === 'M');
    const expectedM = cells.filter((c) => c.gender === 'M').reduce((s, c) => s + c.count, 0);
    expect(mEntry.count).toBe(expectedM);
  });

  it('sums a secondary measure correctly', () => {
    const result = engine.marginalize(cells, 'gender', ['count', 'visit_days']);
    const fEntry = result.find((d) => d.value === 'F');
    const expectedDays = cells.filter((c) => c.gender === 'F').reduce((s, c) => s + c.visit_days, 0);
    expect(fEntry.visit_days).toBe(expectedDays);
  });

  it('returns an empty array when cells is empty', () => {
    expect(engine.marginalize([], 'gender', ['count'])).toHaveLength(0);
  });
});

describe('crossTab', () => {
  it('returns entries for each (a, b) pair', () => {
    const result = engine.crossTab(cells, 'gender', 'age_group', 'count');
    const fOld = result.find((d) => d.a === 'F' && d.b === '85+');
    expect(fOld).toBeDefined();
    expect(fOld.value).toBeGreaterThan(0);
  });

  it('value equals sum of count for that (a,b) combination', () => {
    const result = engine.crossTab(cells, 'gender', 'condition', 'count');
    const mDiabetes = result.find((d) => d.a === 'M' && d.b === 'diabetes');
    const expected = cells
      .filter((c) => c.gender === 'M' && c.condition === 'diabetes')
      .reduce((s, c) => s + c.count, 0);
    expect(mDiabetes.value).toBe(expected);
  });
});

describe('totalMeasure', () => {
  it('sums count across provided cells', () => {
    const total = engine.totalMeasure(cells, 'count');
    const expected = cells.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(expected);
  });

  it('returns 0 for empty cells', () => {
    expect(engine.totalMeasure([], 'count')).toBe(0);
  });

  it('cell total is less than mdhist totals (suppression)', () => {
    const cellSum = engine.totalMeasure(cells, 'count');
    expect(mdhist.totals.count).toBeGreaterThan(cellSum);
  });
});
