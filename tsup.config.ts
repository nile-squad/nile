import glob from 'fast-glob';
import { defineConfig } from 'tsup';

export default defineConfig(async () => {
  const entries = ['index.ts', ...(await glob('src/**/*.ts'))];
  return {
    entry: entries,
    dts: true,
    format: ['esm', 'cjs'],
    outDir: 'dist',
    clean: true,
    platform: 'node',
    splitting: false,
  };
});
