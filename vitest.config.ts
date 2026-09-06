import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/src/**/*.spec.ts',
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.spec.ts',
    ],
    exclude: ['tests/e2e/**'],
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.config.ts', 'apps/extension/'],
    },
  },
});
