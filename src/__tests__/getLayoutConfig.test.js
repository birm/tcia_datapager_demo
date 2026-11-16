import { describe, expect, it } from 'vitest';
import { getLayoutConfig } from '../components/Layout/getLayoutConfig';

const SAMPLE_CHARTS = [
  { id: 'hero',  title: 'Cohort',  chartType: 'HERO',         size: [4, 1], priority: 100 },
  { id: 'dist1', title: 'Gender',  chartType: 'DISTRIBUTION', size: [2, 2], priority: 90  },
  { id: 'dist2', title: 'Age',     chartType: 'DISTRIBUTION', size: [2, 2], priority: 85  },
  { id: 'dist3', title: 'Insur.',  chartType: 'DISTRIBUTION', size: [2, 2], priority: 80  },
];

describe('getLayoutConfig', () => {
  it('returns one layout entry per chart', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    expect(layout).toHaveLength(SAMPLE_CHARTS.length);
  });

  it('layout entry i values match chart ids', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    const ids = layout.map((l) => l.i);
    expect(ids).toContain('hero');
    expect(ids).toContain('dist1');
  });

  it('hero (highest priority) has w=4, h=1 matching its size', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    const hero = layout.find((l) => l.i === 'hero');
    expect(hero.w).toBe(4);
    expect(hero.h).toBe(1);
  });

  it('hero is placed at y=0 (highest priority → first)', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    const hero = layout.find((l) => l.i === 'hero');
    expect(hero.y).toBe(0);
  });

  it('all layout positions have non-negative x and y', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    for (const l of layout) {
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('isResizable is false by default', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4);
    expect(layout.every((l) => l.isResizable === false)).toBe(true);
  });

  it('isResizable can be set to true', () => {
    const { layout } = getLayoutConfig(SAMPLE_CHARTS, 4, true);
    expect(layout.every((l) => l.isResizable === true)).toBe(true);
  });

  it('does not mutate the input array order', () => {
    const input = [...SAMPLE_CHARTS];
    const originalFirst = input[0].id;
    getLayoutConfig(input, 4);
    expect(input[0].id).toBe(originalFirst);
  });

  it('expandWidth sets w to cols regardless of size', () => {
    const charts = [{ id: 'wide', title: 'Wide', size: [2, 1], expandWidth: true, priority: 0 }];
    const { layout } = getLayoutConfig(charts, 4);
    expect(layout[0].w).toBe(4);
  });

  it('handles charts with no priority field (defaults to 0)', () => {
    const charts = [
      { id: 'a', title: 'A', size: [1, 1] },
      { id: 'b', title: 'B', size: [1, 1] },
    ];
    const { layout } = getLayoutConfig(charts, 4);
    expect(layout).toHaveLength(2);
  });

  it('handles empty chart list', () => {
    const { layout } = getLayoutConfig([], 4);
    expect(layout).toHaveLength(0);
  });
});
