import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FilterWaterfall from '../components/FilterWaterfall/FilterWaterfall';
import { CubeContext } from '../contexts/CubeContext';
import CubeEngine from '../core/CubeEngine';
import mdhist from './fixtures/test-mdhist.json';

const engine = CubeEngine(mdhist.dimensions);

function renderWaterfall(filters = []) {
  return render(
    <CubeContext.Provider value={{ mdhist, engine, filters, removeFilter: () => {} }}>
      <FilterWaterfall fields={{ primary_measure: 'count' }} />
    </CubeContext.Provider>
  );
}

describe('FilterWaterfall', () => {
  it('shows only the baseline row when no filters are active', () => {
    renderWaterfall([]);
    expect(screen.getByText('All records')).toBeInTheDocument();
  });

  it('shows "All records" baseline row', () => {
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    renderWaterfall(filters);
    expect(screen.getByText('All records')).toBeInTheDocument();
  });

  it('renders a row for each active filter', () => {
    const filters = [
      { id: 'f1', field: 'gender',    operation: 'eq', values: 'M' },
      { id: 'f2', field: 'condition', operation: 'eq', values: 'diabetes' },
    ];
    renderWaterfall(filters);
    // All records + 2 filter rows = 3 percentage labels
    const pctLabels = screen.getAllByText(/%$/);
    expect(pctLabels.length).toBe(3);
  });

  it('filter row count is less than or equal to baseline count', () => {
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    renderWaterfall(filters);

    const allCellsCount = engine.totalMeasure(mdhist.cells, 'count');
    const mCells = engine.filterCells(mdhist.cells, filters);
    const mCount = engine.totalMeasure(mCells, 'count');

    // Both values should appear in the document
    expect(screen.getByText(allCellsCount.toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(mCount.toLocaleString())).toBeInTheDocument();
    expect(mCount).toBeLessThanOrEqual(allCellsCount);
  });

  it('shows the filter label using dimension label not field name', () => {
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'F' }];
    renderWaterfall(filters);
    // 'gender' dimension has label 'Gender'
    expect(screen.getByText(/Gender = F/)).toBeInTheDocument();
  });
});
