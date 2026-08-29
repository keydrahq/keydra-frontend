import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetMockConnections, resetMockKeys } from '@mocks/handlers';
import { server } from '@mocks/node';
import '@i18n/config';

/**
 * jsdom has no layout engine and no ResizeObserver, so every element measures zero.
 *
 * <p>Virtualised lists ask how tall their scroll container is — through offsetHeight, not
 * getBoundingClientRect — and render nothing when the answer is zero. That would make the key
 * browser untestable for reasons that have nothing to do with its code. Only the key table's
 * viewport is given a size; everything else still measures zero, so no test can quietly depend on
 * a fake layout elsewhere.
 */
const VIEWPORT_HEIGHT = 520;
const VIEWPORT_WIDTH = 800;

class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver = StubResizeObserver;

  /*
   * jsdom implements no SVG geometry either, and PatternFly's topology measures its labels
   * with getBBox before it can place them. Without this the graph throws on every badge it
   * draws. Zero is the honest answer here — jsdom has no text metrics — and the graph's own
   * layout is not what these tests are checking.
   */
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;

  const sized = (fallback: number) =>
    function measure(this: HTMLElement): number {
      return this.classList.contains('keydra-key-table__viewport') ? fallback : 0;
    };

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: sized(VIEWPORT_HEIGHT),
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: sized(VIEWPORT_WIDTH),
  });
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // The connection handlers keep an in-memory store, so reset it between tests.
  resetMockConnections();
  resetMockKeys();
});

afterAll(() => server.close());
