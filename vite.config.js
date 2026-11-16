import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths — this app is reverse-proxied under a path prefix
  // (e.g. www.host.com/some/path/to/root/), not served at a domain root, so
  // absolute `/assets/...` references would resolve to the wrong place.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // functions at 75%: Observable Plot text/fill formatter lambdas are passed to a
      // mocked Plot.* call and never invoked in unit tests — not real business logic gaps.
      thresholds: { lines: 80, functions: 75, branches: 70 },
      include: ['src/core/**', 'src/services/**', 'src/components/**'],
      exclude: [
        'src/main.jsx',
        'src/__tests__/**',
        'src/components/Layout/GridLayout.jsx',
      ],
    },
  },
});
