import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver, which ResponsiveIdCard uses to
// scale the fixed-size card canvas to its container.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
