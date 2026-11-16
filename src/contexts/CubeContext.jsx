import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import CubeEngine from '../core/CubeEngine';
import { clearURL, initURL, updateURL } from '../services/URLServices';
import { useConfig } from './ConfigContext';

export const CubeContext = createContext(null);

function columnarToRows(cells) {
  const fields = Object.keys(cells);
  const n = cells[fields[0]].length;
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(fields.map((f) => [f, cells[f][i]]))
  );
}

function filtersReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const idx = state.findIndex((f) => f.id === action.filter.id);
      if (idx >= 0) {
        const next = [...state];
        next[idx] = action.filter;
        return next;
      }
      return [...state, action.filter];
    }
    case 'ADD_MANY':
      return action.filters;
    case 'REMOVE':
      if (action.id === 'ALL') return [];
      return state.filter((f) => f.id !== action.id);
    default:
      return state;
  }
}

export function CubeProvider({ children }) {
  const { config } = useConfig();
  const [mdhist, setMdhist] = useState(null);
  const [cubeError, setCubeError] = useState(null);
  const [filters, dispatch] = useReducer(filtersReducer, []);

  useEffect(() => {
    if (!config?.CUBE_URL) return;
    const url = config.CUBE_URL;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load cube: ${r.status}`);
        if (url.endsWith('.gz') && r.headers.get('content-encoding') !== 'gzip') {
          // Server sent raw bytes — decompress manually (DecompressionStream, no library needed).
          // When the server sets Content-Encoding: gzip the browser already decoded the body,
          // so we skip this branch and fall through to r.json() below.
          const decompressed = r.body.pipeThrough(new DecompressionStream('gzip'));
          return new Response(decompressed).json();
        }
        return r.json();
      })
      .then((data) => {
        if (data.meta?.format_version === 2) {
          return { ...data, cells: columnarToRows(data.cells) };
        }
        return data;
      })
      .then(setMdhist)
      .catch(setCubeError);
  }, [config?.CUBE_URL]);

  // Restore filters from URL once cube is ready
  useEffect(() => {
    if (!mdhist) return;
    initURL(
      (fs) => dispatch({ type: 'ADD_MANY', filters: fs }),
      () => dispatch({ type: 'REMOVE', id: 'ALL' })
    );
  }, [mdhist]);

  const engine = useMemo(
    () => (mdhist ? CubeEngine(mdhist.dimensions) : null),
    [mdhist]
  );

  const filteredCells = useMemo(() => {
    if (!engine || !mdhist) return [];
    return engine.filterCells(mdhist.cells, filters);
  }, [engine, mdhist, filters]);

  const grandTotals = useMemo(() => mdhist?.totals ?? {}, [mdhist]);

  const filteredTotals = useMemo(() => {
    if (!mdhist || !engine) return {};
    return Object.fromEntries(
      mdhist.measures.map((m) => [m.field, engine.totalMeasure(filteredCells, m.field)])
    );
  }, [engine, filteredCells, mdhist]);

  // Sync filter state to URL whenever it changes
  useEffect(() => {
    if (!mdhist) return;
    if (filters.length === 0) {
      clearURL();
    } else {
      updateURL(filters);
    }
  }, [filters, mdhist]);

  const addFilter = useCallback((filter) => {
    dispatch({ type: 'ADD', filter });
  }, []);

  const removeFilter = useCallback((id) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return (
    <CubeContext.Provider value={{
      mdhist,
      engine,
      filters,
      filteredCells,
      filteredTotals,
      grandTotals,
      cubeError,
      addFilter,
      removeFilter,
    }}>
      {children}
    </CubeContext.Provider>
  );
}

export const useCube = () => useContext(CubeContext);
