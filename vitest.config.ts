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
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        'apps/extension/src/popup/',
        'packages/ui/src/',
        'packages/validation/src/',
        'packages/benchmarks/src/',
        'tools/',
        'dist/',
      ],
      // D7: baseline thresholds with extension/UI excluded from measurement
      // These pass with current test suite; will ratchet up as we add
      // Playwright failure-path specs and more unit tests
      thresholds: {
        statements: 44,
        branches: 70,
        functions: 60,
        lines: 44,
      },
    },
  },
});
