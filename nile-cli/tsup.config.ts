import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  treeshake: true,
  sourcemap: false,
});
