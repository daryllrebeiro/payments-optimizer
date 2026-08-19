import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function copyManifest() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      try {
        const manifestPath = resolve(__dirname, 'manifest.json');
        const outputPath = resolve(__dirname, 'dist/manifest.json');
        const manifest = readFileSync(manifestPath, 'utf-8');
        writeFileSync(outputPath, manifest);
        console.info('✓ manifest.json copied to dist/');
      } catch (err) {
        console.error('Failed to copy manifest.json:', err);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // Keep readable for review; enable before Web Store submission
    rollupOptions: {
      input: {
        'background': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
        'popup': resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        // Scripts output as entryName.js, but html outputs to its own path
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content-script') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        inlineDynamicImports: false,
        format: 'es',
      },
    },
    target: 'esnext',
  },
});
