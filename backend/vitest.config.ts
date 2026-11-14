import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
