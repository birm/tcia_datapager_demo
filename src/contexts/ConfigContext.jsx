import { createContext, useContext, useEffect, useState } from 'react';

export const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const configUrl = params.get('configurl') || './config/tcia-pathology-config.json';

    fetch(configUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load config: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setConfig(data);
        setIsPending(false);
      })
      .catch((err) => {
        setError(err);
        setIsPending(false);
      });
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isPending, error }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);
