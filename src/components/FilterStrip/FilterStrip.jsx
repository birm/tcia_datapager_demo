import { useCube } from '../../contexts/CubeContext';

export default function FilterStrip() {
  const { filters, removeFilter, mdhist } = useCube();

  if (!filters.length) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-blue-600 shrink-0">Active filters:</span>
      {filters.map((f) => {
        const dim = mdhist?.dimensions?.find((d) => d.field === f.field);
        const label = dim?.label ?? f.field;
        const valueStr = Array.isArray(f.values) ? f.values.join(', ') : String(f.values);
        return (
          <button
            key={f.id}
            onClick={() => removeFilter(f.id)}
            className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"
            aria-label={`Remove filter: ${label} = ${valueStr}`}
          >
            <span>{label} = {valueStr}</span>
            <span aria-hidden="true">×</span>
          </button>
        );
      })}
      <button
        onClick={() => removeFilter('ALL')}
        className="ml-auto text-xs text-blue-500 hover:text-blue-700 underline shrink-0"
      >
        Reset all
      </button>
    </div>
  );
}
