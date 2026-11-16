import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { CubeProvider, useCube } from './contexts/CubeContext';
import FilterStrip from './components/FilterStrip/FilterStrip';
import GridLayout from './components/Layout/GridLayout';
import { buildEaglescopeLink } from './services/EaglescopeLink';

function EaglescopeButton() {
  const { config } = useConfig();
  const { filters, mdhist } = useCube();
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (!config?.EAGLESCOPE_MAP_URL) return;
    fetch(config.EAGLESCOPE_MAP_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMap)
      .catch(() => setMap(null));
  }, [config?.EAGLESCOPE_MAP_URL]);

  const link = useMemo(
    () => (map ? buildEaglescopeLink(filters, map, mdhist?.dimensions ?? []) : null),
    [map, filters, mdhist]
  );
  if (!link) return null;

  const title = link.skipped.length
    ? `Open the current selection in Eaglescope (not carried over: ${link.skipped.join(', ')})`
    : 'Open the current selection in the original Eaglescope viewer';

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="shrink-0 text-sm border border-gray-200 rounded px-3 py-1 text-gray-700 bg-white hover:border-gray-400 hover:bg-gray-50"
    >
      View in Eaglescope ↗
      {link.skipped.length > 0 && <span className="ml-1 text-amber-600">*</span>}
    </a>
  );
}

function AppHeader() {
  const { config } = useConfig();
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-gray-800 truncate">
          {config?.TITLE ?? 'datapager'}
        </h1>
        {config?.SUBTITLE && (
          <p className="text-xs text-gray-500 truncate">
            {config.SUBTITLE}{' '}
            {config.SOURCE_URL && (
              <a href={config.SOURCE_URL} className="underline hover:text-gray-700" target="_blank" rel="noopener noreferrer">
                source CSV
              </a>
            )}
          </p>
        )}
      </div>
      <EaglescopeButton />
    </header>
  );
}

function AppInner() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <FilterStrip />
      <main className="flex-1 p-4 overflow-auto">
        <GridLayout />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <CubeProvider>
        <AppInner />
      </CubeProvider>
    </ConfigProvider>
  );
}
