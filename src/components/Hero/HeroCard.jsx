import { useMemo } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import { useCube } from '../../contexts/CubeContext';

function FeasibilityDot({ count, thresholds }) {
  if (!thresholds || thresholds.length === 0) return null;
  const sorted = [...thresholds].sort((a, b) => b.n - a.n);
  const met = sorted.find((t) => count >= t.n);
  const color = met?.color ?? 'red';
  const label = met?.label ?? 'Underpowered';
  const colorClass =
    { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }[color] ?? 'bg-red-500';
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full shrink-0 ${colorClass}`}
      title={label}
      aria-label={label}
    />
  );
}

function FunnelSteps({ primary }) {
  const { mdhist, engine, filters, removeFilter, grandTotals } = useCube();
  const grandCount = grandTotals[primary] ?? 1;

  const steps = useMemo(() => {
    if (!mdhist || !engine) return [];
    const allCount = engine.totalMeasure(mdhist.cells, primary);
    const rows = [{ label: 'All', count: allCount, filterId: null }];
    for (let i = 0; i < filters.length; i++) {
      const dim = mdhist.dimensions?.find((d) => d.field === filters[i].field);
      const fieldLabel = dim?.label ?? filters[i].field;
      const vals = Array.isArray(filters[i].values)
        ? filters[i].values.join(', ')
        : String(filters[i].values);
      const cells = engine.filterCells(mdhist.cells, filters.slice(0, i + 1));
      rows.push({
        label: `${fieldLabel} = ${vals}`,
        count: engine.totalMeasure(cells, primary),
        filterId: filters[i].id,
      });
    }
    return rows.map((r) => ({
      ...r,
      pct: grandCount > 0 ? ((r.count / grandCount) * 100).toFixed(1) : '0',
    }));
  }, [mdhist, engine, filters, primary, grandCount]);

  if (steps.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      {steps.map((step, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex items-center gap-1 ml-3 my-0.5">
              <span className="text-gray-300 text-xs">↓</span>
              <span className="text-xs text-red-400">
                −{(steps[i - 1].count - step.count).toLocaleString()}
              </span>
            </div>
          )}
          {step.filterId ? (
            <button
              onClick={() => removeFilter(step.filterId)}
              className="w-full text-left rounded px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 group"
              title="Click to remove this filter"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-blue-600 truncate flex-1">{step.label}</span>
                <span className="text-xs font-semibold tabular-nums text-gray-700 shrink-0">
                  {step.count.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 shrink-0 w-10 text-right">{step.pct}%</span>
                <span className="text-xs text-blue-300 group-hover:text-blue-500 shrink-0">×</span>
              </div>
              <div className="mt-1 h-1 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-1 bg-blue-400 rounded-full" style={{ width: `${Math.min(parseFloat(step.pct), 100)}%` }} />
              </div>
            </button>
          ) : (
            <div className="rounded px-2.5 py-1.5 bg-gray-50">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-gray-400 truncate flex-1">{step.label}</span>
                <span className="text-xs font-semibold tabular-nums text-gray-700 shrink-0">
                  {step.count.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 shrink-0 w-10 text-right">{step.pct}%</span>
              </div>
              <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-1 bg-gray-400 rounded-full" style={{ width: `${Math.min(parseFloat(step.pct), 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
      {filters.length > 0 && (
        <button
          onClick={() => removeFilter('ALL')}
          className="text-xs text-gray-400 hover:text-gray-600 underline pt-0.5"
        >
          Reset all
        </button>
      )}
    </div>
  );
}

export default function HeroCard({ fields }) {
  const { mdhist, filteredTotals, grandTotals } = useCube();
  const { config } = useConfig();

  const primary = fields?.primary_measure ?? 'count';
  const secondaries = fields?.secondary_measures ?? [];
  const thresholds = config?.FEASIBILITY_THRESHOLDS ?? [];

  const primaryCount = filteredTotals[primary] ?? 0;
  const grandCount = grandTotals[primary] ?? 1;
  const pct = grandCount > 0 ? ((primaryCount / grandCount) * 100).toFixed(1) : '0.0';

  const primaryMeta = mdhist?.measures?.find((m) => m.field === primary);

  const cellsTotal = useMemo(
    () => mdhist?.cells.reduce((s, c) => s + (c[primary] ?? 0), 0) ?? 0,
    [mdhist, primary]
  );
  const isSuppressed = mdhist && (grandTotals[primary] ?? 0) > cellsTotal;

  if (!mdhist || !config) {
    return <div className="p-4 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-4 h-full flex flex-col overflow-auto">
      <div>
        <div className="flex items-baseline gap-2">
          <div className="text-5xl font-bold tabular-nums text-gray-900">
            {primaryCount.toLocaleString()}
          </div>
          <FeasibilityDot count={primaryCount} thresholds={thresholds} />
        </div>
        <div className="text-base text-gray-500 mt-1">{primaryMeta?.label ?? primary}</div>
        {secondaries.map((field) => {
          const meta = mdhist.measures.find((m) => m.field === field);
          const val = filteredTotals[field] ?? 0;
          return (
            <div key={field} className="text-sm text-gray-500 mt-0.5">
              {val.toLocaleString()} {meta?.unit ?? meta?.label ?? field}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="text-sm text-gray-400">
          {pct}% of {grandCount.toLocaleString()} total
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-1">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
          />
        </div>
        {isSuppressed && (
          <p className="text-xs text-amber-600 mt-1">Some combinations are suppressed (k-anonymity)</p>
        )}
      </div>

      <FunnelSteps primary={primary} />
    </div>
  );
}
