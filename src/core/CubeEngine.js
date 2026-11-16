/**
 * CubeEngine(dimensions) → { filterCells, marginalize, crossTab, totalMeasure }
 *
 * dimensions: array from mdhist.dimensions — used for ordinal range comparisons.
 */
function CubeEngine(dimensions) {
  const ordinalIndex = {};
  for (const dim of dimensions) {
    if (dim.type === 'ordinal') {
      ordinalIndex[dim.field] = dim.values;
    }
  }

  function matchesPredicate(cellValue, filter) {
    const { field, operation, values } = filter;
    switch (operation) {
      case 'eq':
        return cellValue === values;
      case 'ne':
        return cellValue !== values;
      case 'in':
        return Array.isArray(values) && values.includes(cellValue);
      case 'nin':
        return Array.isArray(values) && !values.includes(cellValue);
      case 'range': {
        const ordinalValues = ordinalIndex[field];
        if (ordinalValues) {
          const idx = ordinalValues.indexOf(cellValue);
          const minIdx = ordinalValues.indexOf(values[0]);
          const maxIdx = ordinalValues.indexOf(values[1]);
          if (idx < 0 || minIdx < 0 || maxIdx < 0) return false;
          return idx >= minIdx && idx <= maxIdx;
        }
        return cellValue >= values[0] && cellValue <= values[1];
      }
      default:
        return true;
    }
  }

  function filterCells(cells, filters) {
    if (!filters || filters.length === 0) return cells;
    return cells.filter((cell) =>
      filters.every((f) => matchesPredicate(cell[f.field], f))
    );
  }

  function marginalize(cells, field, measures) {
    const acc = new Map();
    for (const cell of cells) {
      const key = String(cell[field]);
      if (!acc.has(key)) {
        acc.set(key, { value: cell[field], ...Object.fromEntries(measures.map((m) => [m, 0])) });
      }
      const entry = acc.get(key);
      for (const m of measures) entry[m] += cell[m] ?? 0;
    }
    return Array.from(acc.values());
  }

  function crossTab(cells, fieldA, fieldB, measure) {
    const seen = new Map();
    const result = [];
    for (const cell of cells) {
      const key = `${cell[fieldA]}\x00${cell[fieldB]}`;
      if (!seen.has(key)) {
        const entry = { a: cell[fieldA], b: cell[fieldB], value: 0 };
        seen.set(key, entry);
        result.push(entry);
      }
      seen.get(key).value += cell[measure] ?? 0;
    }
    return result;
  }

  function totalMeasure(cells, measure) {
    return cells.reduce((sum, cell) => sum + (cell[measure] ?? 0), 0);
  }

  return { filterCells, marginalize, crossTab, totalMeasure };
}

export default CubeEngine;
