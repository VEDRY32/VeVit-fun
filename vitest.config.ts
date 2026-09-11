import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'titles/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
  },
});
