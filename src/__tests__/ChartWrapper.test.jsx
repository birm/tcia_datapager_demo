import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChartWrapper from '../components/ChartWrapper/ChartWrapper';
import { CubeContext } from '../contexts/CubeContext';

function renderWrapper({ cubeOverrides = {}, filterId, title = 'Test Chart' } = {}) {
  const defaultCube = {
    filters: [],
    removeFilter: vi.fn(),
  };
  return render(
    <CubeContext.Provider value={{ ...defaultCube, ...cubeOverrides }}>
      <ChartWrapper title={title} filterId={filterId}>
        <div>chart content</div>
      </ChartWrapper>
    </CubeContext.Provider>
  );
}

describe('ChartWrapper', () => {
  it('renders the title', () => {
    renderWrapper();
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('renders children', () => {
    renderWrapper();
    expect(screen.getByText('chart content')).toBeInTheDocument();
  });

  it('shows no filter chip when filters array is empty', () => {
    renderWrapper({ filterId: 'chart-gender' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows filter chip when an active filter matches filterId', () => {
    const filters = [{ id: 'chart-gender', field: 'gender', operation: 'eq', values: 'M' }];
    renderWrapper({ cubeOverrides: { filters }, filterId: 'chart-gender' });
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(/M ×/)).toBeInTheDocument();
  });

  it('calls removeFilter with filterId when chip is clicked', () => {
    const removeFilter = vi.fn();
    const filters = [{ id: 'chart-gender', field: 'gender', operation: 'eq', values: 'M' }];
    renderWrapper({ cubeOverrides: { filters, removeFilter }, filterId: 'chart-gender' });
    screen.getByRole('button').click();
    expect(removeFilter).toHaveBeenCalledWith('chart-gender');
  });

  it('shows comma-joined values for array filter values', () => {
    const filters = [{ id: 'chart-cond', field: 'condition', operation: 'in', values: ['diabetes', 'hypertension'] }];
    renderWrapper({ cubeOverrides: { filters }, filterId: 'chart-cond' });
    expect(screen.getByText(/diabetes, hypertension/)).toBeInTheDocument();
  });
});
