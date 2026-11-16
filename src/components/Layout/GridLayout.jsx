import ReactGridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useConfig } from '../../contexts/ConfigContext';
import { useCube } from '../../contexts/CubeContext';
import ChartWrapper from '../ChartWrapper/ChartWrapper';
import CrossTabChart from '../CrossTab/CrossTabChart';
import DistributionChart from '../Distribution/DistributionChart';
import FilterWaterfall from '../FilterWaterfall/FilterWaterfall';
import HeroCard from '../Hero/HeroCard';
import { getLayoutConfig } from './getLayoutConfig';

const AutoWidthGrid = WidthProvider(ReactGridLayout);

const CHART_REGISTRY = {
  HERO: (chart) => <HeroCard fields={chart.fields} />,
  DISTRIBUTION: (chart) => (
    <DistributionChart
      id={chart.id}
      fields={chart.fields}
      overlayMode={chart.overlayMode ?? false}
      horizontal={chart.horizontal ?? false}
    />
  ),
  FILTER_WATERFALL: (chart) => <FilterWaterfall fields={chart.fields} />,
  CROSS_TAB: (chart) => <CrossTabChart id={chart.id} fields={chart.fields} />,
};

export default function GridLayout() {
  const { config } = useConfig();
  const { cubeError } = useCube();

  if (!config) return <div className="p-8 text-gray-400">Loading configuration…</div>;
  if (cubeError) return <div className="p-8 text-red-500">Error loading cube: {cubeError.message}</div>;

  const charts = config.VISUALIZATION_VIEW_CONFIGURATION ?? [];
  const cols = 4;
  const [, rowHeight] = config.UNIT_OF_GRID_VIEW ?? [280, 220];
  const { layout } = getLayoutConfig(charts, cols);

  return (
    <AutoWidthGrid
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      isDraggable={false}
      isResizable={false}
      margin={[12, 12]}
    >
      {charts.map((chart) => {
        const renderer = CHART_REGISTRY[chart.chartType];
        const filterId = chart.fields?.x ? `${chart.id}-${chart.fields.x}` : undefined;
        return (
          <div key={chart.id}>
            <ChartWrapper title={chart.title ?? chart.chartType} filterId={filterId}>
              {renderer
                ? renderer(chart)
                : <div className="p-2 text-xs text-gray-400">Unsupported: {chart.chartType}</div>}
            </ChartWrapper>
          </div>
        );
      })}
    </AutoWidthGrid>
  );
}
