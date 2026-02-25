import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/cli/index.ts'],
    outDir: 'dist/cli',
    format: ['esm'],
    banner: { js: '#!/usr/bin/env node' },
    sourcemap: true,
  },
]);
