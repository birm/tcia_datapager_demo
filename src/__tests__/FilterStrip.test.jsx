import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterStrip from '../components/FilterStrip/FilterStrip';
import { CubeContext } from '../contexts/CubeContext';
import mdhist from './fixtures/test-mdhist.json';

function renderStrip(filters = [], removeFilter = vi.fn()) {
  return render(
    <CubeContext.Provider value={{ filters, removeFilter, mdhist }}>
      <FilterStrip />
    </CubeContext.Provider>
  );
}

describe('FilterStrip', () => {
  it('renders nothing when there are no active filters', () => {
    const { container } = renderStrip([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows filter chip for each active filter', () => {
    const filters = [
      { id: 'f1', field: 'gender',    operation: 'eq', values: 'M' },
      { id: 'f2', field: 'condition', operation: 'eq', values: 'diabetes' },
    ];
    renderStrip(filters);
    expect(screen.getByText(/Gender = M/)).toBeInTheDocument();
    expect(screen.getByText(/Condition = diabetes/)).toBeInTheDocument();
  });

  it('shows Reset all button when filters are present', () => {
    renderStrip([{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }]);
    expect(screen.getByText('Reset all')).toBeInTheDocument();
  });

  it('calls removeFilter with the filter id when a chip is clicked', () => {
    const removeFilter = vi.fn();
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    renderStrip(filters, removeFilter);
    screen.getByRole('button', { name: /Remove filter: Gender = M/i }).click();
    expect(removeFilter).toHaveBeenCalledWith('f1');
  });

  it('calls removeFilter with ALL when Reset all is clicked', () => {
    const removeFilter = vi.fn();
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    renderStrip(filters, removeFilter);
    screen.getByText('Reset all').click();
    expect(removeFilter).toHaveBeenCalledWith('ALL');
  });
});
