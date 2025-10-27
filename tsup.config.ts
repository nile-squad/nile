import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'index.ts',
    'src/core/index.ts',
    'src/core/orm/index.ts',
    'src/interfaces/rest/index.ts',
    'src/interfaces/rpc/index.ts',
    'src/logging/index.ts',
    'src/task-runner/index.ts',
    'src/types/index.ts',
    'src/utils/index.ts',
  ],
  dts: false,
  format: ['esm', 'cjs'],
  outDir: 'dist',
  clean: true,
  platform: 'node',
  splitting: false,
});
