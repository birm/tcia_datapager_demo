// Ported from eaglescope/source/services/URLServices.js
// Narrowed to datapager's supported filter operations.

const VALID_OPERATIONS = new Set(['eq', 'in', 'nin', 'ne', 'range']);

const isValidFilter = (f) =>
  f !== null &&
  typeof f === 'object' &&
  typeof f.field === 'string' &&
  !f.field.startsWith('__') &&
  typeof f.operation === 'string' &&
  VALID_OPERATIONS.has(f.operation) &&
  f.values !== undefined;

export const updateURL = (filters) => {
  if (filters.length === 0) {
    clearURL();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('filterState', JSON.stringify([...filters]));
  window.history.replaceState({}, document.title, url.toString());
};

export const clearURL = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('filterState');
  window.history.replaceState({}, document.title, url.toString());
};

export const initURL = (addFilters, removeAllFilters) => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('filterState');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isValidFilter)) {
      removeAllFilters();
      addFilters(parsed);
    }
  } catch {
    // ignore malformed filterState
  }
};
