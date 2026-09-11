#!/usr/bin/env node
/**
 * Cross-platform clean script
 * Removes build artifacts from src directories and dist folders
 */

import { globSync } from 'glob';
import { rimrafSync } from 'rimraf';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

function clean() {
  // Clean dist folders
  const distDirs = globSync('packages/*/dist', { cwd: root, absolute: true });
  distDirs.push(...globSync('apps/*/dist', { cwd: root, absolute: true }));

  for (const dir of distDirs) {
    rimrafSync(dir);
    console.log(`Cleaned: ${dir}`);
  }

  // Clean any stray .js/.d.ts/.map files in src directories
  const strayFiles = [
    ...globSync('packages/*/src/**/*.js', { cwd: root, absolute: true }),
    ...globSync('packages/*/src/**/*.d.ts', { cwd: root, absolute: true }),
    ...globSync('packages/*/src/**/*.js.map', { cwd: root, absolute: true }),
    ...globSync('packages/*/src/**/*.d.ts.map', { cwd: root, absolute: true }),
    ...globSync('apps/*/src/**/*.js', { cwd: root, absolute: true }),
    ...globSync('apps/*/src/**/*.d.ts', { cwd: root, absolute: true }),
    ...globSync('apps/*/src/**/*.js.map', { cwd: root, absolute: true }),
    ...globSync('apps/*/src/**/*.d.ts.map', { cwd: root, absolute: true }),
  ];

  for (const file of strayFiles) {
    rimrafSync(file);
    console.log(`Cleaned stray file: ${file}`);
  }

  console.log('Clean complete');
}

clean();