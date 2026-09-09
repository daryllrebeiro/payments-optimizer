import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    include: [
      'packages/*/src/**/*.spec.ts',
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.spec.ts',
      'tests/conformance/**/*.spec.ts',
    ],
    exclude: ['tests/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.config.ts', 'apps/extension/'],
      // Baseline measured 2026-09-07 (386 tests passing): stmts/lines 64.5%,
      // branches 83.3%, funcs 70.4%. Thresholds are set below baseline to make
      // the gate pass today and ratchet upward toward the >=85% target.
      thresholds: {
        statements: 60,
        branches: 78,
        functions: 65,
        lines: 60,
      },
    },
  },
});
