import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DistributionChart from '../components/Distribution/DistributionChart';
import { ConfigContext } from '../contexts/ConfigContext';
import { CubeContext } from '../contexts/CubeContext';
import CubeEngine from '../core/CubeEngine';
import mdhist from './fixtures/test-mdhist.json';

vi.mock('@observablehq/plot', () => ({
  barY:  vi.fn(() => ({ markType: 'barY'  })),
  ruleY: vi.fn(() => ({ markType: 'ruleY' })),
  axisY: vi.fn(() => ({ markType: 'axisY' })),
  text:  vi.fn(() => ({ markType: 'text'  })),
  plot: vi.fn(() => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'observable-plot');
    el.scale = () => ({ domain: ['M', 'F'], apply: () => 0, bandwidth: 100 });
    return el;
  }),
}));

import * as Plot from '@observablehq/plot';

const engine = CubeEngine(mdhist.dimensions);

function renderChart(cubeOverrides = {}, chartProps = {}) {
  const defaultCube = {
    mdhist,
    engine,
    filteredCells: mdhist.cells,
    grandTotals: mdhist.totals,
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
  };

  return render(
    <CubeContext.Provider value={{ ...defaultCube, ...cubeOverrides }}>
      <ConfigContext.Provider value={{ config: {} }}>
        <DistributionChart id="test" fields={{ x: 'gender', y: 'count' }} {...chartProps} />
      </ConfigContext.Provider>
    </CubeContext.Provider>
  );
}

describe('DistributionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = renderChart();
    expect(container).toBeTruthy();
  });

  it('calls Plot.plot after mount', () => {
    renderChart();
    expect(Plot.plot).toHaveBeenCalledOnce();
  });

  it('calls Plot.barY twice in overlay mode (full + filtered bars)', () => {
    renderChart({}, { overlayMode: true });
    expect(Plot.barY).toHaveBeenCalledTimes(2);
  });

  it('calls Plot.barY once when overlay is off', () => {
    renderChart({}, { overlayMode: false });
    expect(Plot.barY).toHaveBeenCalledTimes(1);
  });

  it('adds axisY and text marks when filtered/total ratio is below threshold', () => {
    // First cell has count=70; grand total = 1120 → ratio ≈ 0.063 < 0.1
    const tinyFiltered = [mdhist.cells[0]];
    renderChart({ filteredCells: tinyFiltered });
    // axisY (right axis) and text (percentage labels) should be called for dual-axis mode
    expect(Plot.axisY).toHaveBeenCalled();
    expect(Plot.text).toHaveBeenCalled();
  });

  it('does not add axisY when ratio is above threshold', () => {
    // All cells → ratio = 1.0, above 0.1 → no dual axis
    renderChart({ filteredCells: mdhist.cells });
    expect(Plot.axisY).not.toHaveBeenCalled();
  });
});
