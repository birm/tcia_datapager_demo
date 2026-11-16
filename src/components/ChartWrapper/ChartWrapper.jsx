import { useCube } from '../../contexts/CubeContext';

export default function ChartWrapper({ title, filterId, children }) {
  const { filters, removeFilter } = useCube();
  const activeFilter = filterId ? filters.find((f) => f.id === filterId) : null;

  const filterLabel = activeFilter
    ? (Array.isArray(activeFilter.values) ? activeFilter.values.join(', ') : String(activeFilter.values))
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-sm font-medium text-gray-700 truncate">{title}</span>
        {activeFilter && (
          <button
            onClick={() => removeFilter(filterId)}
            className="ml-2 shrink-0 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-0.5 rounded-full"
            aria-label={`Remove filter: ${filterLabel}`}
          >
            {filterLabel} ×
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-2">{children}</div>
    </div>
  );
}
