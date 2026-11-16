// Translate datapager filter state into an Eaglescope filterState URL.
//
// The cube uses cleaned labels (e.g. "H&E", "Yes") while Eaglescope filters the
// raw CSV, so we look each value up in the generated map
// (public/config/tcia-pathology-eaglescope.json):
//   FIELDS[dim] = { id, title, field, values: { cubeValue: [rawValue, ...] } }
// One raw value → `eq`; several → `in`.

function cubeValuesFor(filter, dim) {
  const { operation, values } = filter;
  if (operation === 'eq') return [values];
  if (operation === 'in') return Array.isArray(values) ? values : [values];
  if (operation === 'range' && dim?.values) {
    const i = dim.values.indexOf(values[0]);
    const j = dim.values.indexOf(values[1]);
    if (i >= 0 && j >= 0) return dim.values.slice(Math.min(i, j), Math.max(i, j) + 1);
  }
  return null; // ne / nin / unknown → can't express exactly
}

/**
 * @returns {{ url: string, skipped: string[] }}
 *   skipped: labels of filters that could not be carried over.
 */
export function buildEaglescopeLink(filters, map, dimensions = []) {
  const skipped = [];
  // Intersect filters on the same field (e.g. a bar chart + a cross-tab on the same
  // dimension) so Eaglescope receives one filter per chart id.
  const byField = new Map();
  for (const f of filters) {
    const spec = map?.FIELDS?.[f.field];
    const dim = dimensions.find((d) => d.field === f.field);
    const cubeVals = spec ? cubeValuesFor(f, dim) : null;
    if (!cubeVals) {
      skipped.push(dim?.label ?? f.field);
      continue;
    }
    const raw = new Set(cubeVals.flatMap((v) => spec.values[String(v)] ?? []));
    const prev = byField.get(f.field);
    byField.set(f.field, {
      spec,
      raw: prev ? new Set([...prev.raw].filter((r) => raw.has(r))) : raw,
    });
  }

  const state = [];
  for (const { spec, raw } of byField.values()) {
    const vals = [...raw].sort();
    if (vals.length === 0) continue;
    state.push({
      id: spec.id,
      title: spec.title,
      field: spec.field,
      operation: vals.length === 1 ? 'eq' : 'in',
      values: vals.length === 1 ? vals[0] : vals,
    });
  }

  const params = new URLSearchParams({ configurl: map.CONFIG_URL });
  if (state.length > 0) params.set('filterState', JSON.stringify(state));
  // Eaglescope expects %20 rather than "+" for spaces.
  const query = params.toString().replace(/\+/g, '%20');
  return { url: `${map.BASE_URL}?${query}`, skipped };
}
