import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Path aliases (@app, @i18n, @mocks, @test) are declared once in
// tsconfig.app.json and resolved natively by Vite 8.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 9000,
    strictPort: true,
    proxy: {
      // REST and the notification WebSocket both live under /api, so one rule
      // with ws:true covers that half of the backend surface.
      '/api': {
        target: 'http://localhost:8181',
        changeOrigin: true,
        ws: true,
      },
      // The GraphQL surface is not under /api and needs its own rule. `ws: true`
      // because subscriptions arrive over the same path, upgraded.
      '/graphql': {
        target: 'http://localhost:8181',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    /*
     * Raised from the 5s default. These tests drive real components through userEvent,
     * which types a character at a time, and run several files at once — a test that takes
     * two seconds alone can take six on a loaded machine. At 5s the suite failed on a
     * different test each run, which is worse than a slow suite: it teaches everyone to
     * re-run rather than to read the failure.
     */
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/app/**/*.{ts,tsx}'],
    },
  },
});
