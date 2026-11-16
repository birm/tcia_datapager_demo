import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrossTabChart from '../components/CrossTab/CrossTabChart';
import { CubeContext } from '../contexts/CubeContext';
import CubeEngine from '../core/CubeEngine';
import mdhist from './fixtures/test-mdhist.json';

vi.mock('@observablehq/plot', () => ({
  cell: vi.fn(() => ({ markType: 'cell' })),
  text: vi.fn(() => ({ markType: 'text' })),
  plot: vi.fn(() => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'observable-plot');
    // Minimal scale stub
    el.scale = (name) => name === 'x'
      ? { domain: ['M', 'F'], apply: (v) => v === 'M' ? 68 : 344, bandwidth: 248 }
      : { domain: ['diabetes', 'hypertension'], apply: (v) => v === 'diabetes' ? 40 : 200, bandwidth: 80 };
    return el;
  }),
}));

import * as Plot from '@observablehq/plot';

const engine = CubeEngine(mdhist.dimensions);

function renderCrossTab(cubeOverrides = {}) {
  const defaultCube = {
    mdhist,
    engine,
    filteredCells: mdhist.cells,
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
  };
  return render(
    <CubeContext.Provider value={{ ...defaultCube, ...cubeOverrides }}>
      <CrossTabChart id="test-xt" fields={{ x: 'gender', y: 'condition', value: 'count' }} />
    </CubeContext.Provider>
  );
}

describe('CrossTabChart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    const { container } = renderCrossTab();
    expect(container).toBeTruthy();
  });

  it('calls Plot.cell and Plot.text after mount', () => {
    renderCrossTab();
    expect(Plot.cell).toHaveBeenCalledOnce();
    expect(Plot.text).toHaveBeenCalledOnce();
  });

  it('passes correct x and y fields to Plot.cell', () => {
    renderCrossTab();
    const cellCall = Plot.cell.mock.calls[0];
    expect(cellCall[1]).toMatchObject({ x: 'a', y: 'b', fill: 'value' });
  });

  it('calls Plot.plot with the cell and text marks', () => {
    renderCrossTab();
    expect(Plot.plot).toHaveBeenCalledWith(
      expect.objectContaining({ marks: expect.any(Array) })
    );
  });

  it('shows no-data message when filteredCells is empty', () => {
    const { container } = renderCrossTab({ filteredCells: [] });
    expect(container.textContent).toMatch(/no data/i);
  });

  it('calls addFilter for both axes when a cell is clicked', () => {
    const addFilter = vi.fn();
    const { container } = renderCrossTab({ addFilter });

    const plotEl = container.querySelector('[data-testid="observable-plot"]');
    // Give the mock element real dimensions so the click handler doesn't bail early
    vi.spyOn(plotEl, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 640, height: 400,
    });

    // Click at center of 'M' band (apply('M')=68 + bw/2=124 = 192) and
    // center of 'diabetes' band (apply('diabetes')=40 + bw/2=40 = 80)
    plotEl.dispatchEvent(new MouseEvent('click', {
      clientX: 192, clientY: 80, bubbles: true,
    }));

    expect(addFilter).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'gender', values: 'M' })
    );
    expect(addFilter).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'condition', values: 'diabetes' })
    );
  });
});
