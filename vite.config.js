import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути в сборке: index.html из dist/ можно открыть с любого
  // под-пути или статического хостинга без правки base.
  base: './',
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
  server: {
    host: true,
  },
});
