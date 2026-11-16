import { useMemo } from 'react';
import { useCube } from '../../contexts/CubeContext';

function filterLabel(filter, dimensions) {
  const dim = dimensions?.find((d) => d.field === filter.field);
  const fieldLabel = dim?.label ?? filter.field;
  const valueStr = Array.isArray(filter.values)
    ? filter.values.join(', ')
    : String(filter.values);
  return `${fieldLabel} = ${valueStr}`;
}

export default function FilterWaterfall({ fields }) {
  const { mdhist, engine, filters } = useCube();

  const primary = fields?.primary_measure ?? 'count';

  const steps = useMemo(() => {
    if (!mdhist || !engine) return [];

    const allCount = engine.totalMeasure(mdhist.cells, primary);
    const grandTotal = mdhist.totals[primary] ?? allCount;

    const rows = [{ label: 'All records', count: allCount, isBaseline: true }];

    for (let i = 0; i < filters.length; i++) {
      const prefixCells = engine.filterCells(mdhist.cells, filters.slice(0, i + 1));
      rows.push({
        label: filterLabel(filters[i], mdhist.dimensions),
        count: engine.totalMeasure(prefixCells, primary),
        isBaseline: false,
      });
    }

    return rows.map((row, i) => ({
      ...row,
      pct: grandTotal > 0 ? ((row.count / grandTotal) * 100).toFixed(1) : '0',
      reduction: i > 0 ? rows[i - 1].count - row.count : 0,
    }));
  }, [mdhist, engine, filters, primary]);

  if (!mdhist || !engine) {
    return <div className="p-4 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-3 overflow-auto h-full">
      {steps.map((step, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex items-center gap-1 my-0.5 ml-4">
              <span className="text-gray-300 text-xs">↓</span>
              {step.reduction > 0 && (
                <span className="text-xs text-red-400">−{step.reduction.toLocaleString()}</span>
              )}
            </div>
          )}
          <div className={`rounded px-3 py-1.5 ${step.isBaseline ? 'bg-gray-50' : 'bg-blue-50'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500 truncate flex-1" title={step.label}>
                {step.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-800 shrink-0">
                {step.count.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 shrink-0 w-12 text-right">
                {step.pct}%
              </span>
            </div>
            <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full ${step.isBaseline ? 'bg-gray-400' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(parseFloat(step.pct), 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
