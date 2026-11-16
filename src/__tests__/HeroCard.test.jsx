import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HeroCard from '../components/Hero/HeroCard';
import { ConfigContext } from '../contexts/ConfigContext';
import { CubeContext } from '../contexts/CubeContext';
import mdhist from './fixtures/test-mdhist.json';

const BASE_CONFIG = {
  config: {
    FEASIBILITY_THRESHOLDS: [
      { label: 'Pilot',   n: 50,  color: 'yellow' },
      { label: 'Powered', n: 200, color: 'green'  },
    ],
  },
};

// cell sum = 1105, totals.count = 1120 → suppressed = true
const CELL_SUM = mdhist.cells.reduce((s, c) => s + c.count, 0);

function renderHero({ cube = {}, config = BASE_CONFIG } = {}) {
  const defaultCube = {
    mdhist,
    filteredTotals: { count: 500, visit_days: 2500 },
    grandTotals: mdhist.totals,
    filters: [],
    addFilter: () => {},
    removeFilter: () => {},
  };

  return render(
    <CubeContext.Provider value={{ ...defaultCube, ...cube }}>
      <ConfigContext.Provider value={config}>
        <HeroCard fields={{ primary_measure: 'count', secondary_measures: ['visit_days'] }} />
      </ConfigContext.Provider>
    </CubeContext.Provider>
  );
}

describe('HeroCard', () => {
  it('renders the primary measure count', () => {
    renderHero();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('displays the correct percentage of total', () => {
    renderHero();
    // 500 / 1120 * 100 = 44.6%
    expect(screen.getByText(/44\.6%/)).toBeInTheDocument();
  });

  it('shows green Powered label when count >= 200', () => {
    renderHero({ cube: { filteredTotals: { count: 300, visit_days: 1500 } } });
    expect(screen.getByTitle('Powered')).toBeInTheDocument();
  });

  it('shows yellow Pilot label when count is between 50 and 199', () => {
    renderHero({ cube: { filteredTotals: { count: 75, visit_days: 375 } } });
    expect(screen.getByTitle('Pilot')).toBeInTheDocument();
  });

  it('shows Underpowered when count is below the lowest threshold', () => {
    renderHero({ cube: { filteredTotals: { count: 10, visit_days: 50 } } });
    expect(screen.getByTitle('Underpowered')).toBeInTheDocument();
  });

  it('shows suppression notice when totals exceed cell sum', () => {
    // Fixture has totals.count (1120) > cell sum (1105) → suppressed
    renderHero();
    expect(screen.getByText(/suppressed/i)).toBeInTheDocument();
  });

  it('renders secondary measure value', () => {
    renderHero();
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
  });

  it('shows Loading when mdhist is null', () => {
    renderHero({ cube: { mdhist: null } });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
