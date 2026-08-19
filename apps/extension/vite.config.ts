import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // Keep readable for review; enable before Web Store submission
    rollupOptions: {
      input: {
        'background': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        // Inline all chunks — extension service workers can't use dynamic imports
        inlineDynamicImports: false,
        format: 'es',
      },
    },
    target: 'esnext',
  },
});
