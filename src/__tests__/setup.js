import '@testing-library/jest-dom';

// jsdom doesn't implement ResizeObserver; Observable Plot and react-grid-layout need it
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
