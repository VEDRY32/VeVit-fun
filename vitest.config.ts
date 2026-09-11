import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  // Stejné aliasy jako v portálu; přesnější zápis musí být první.
  resolve: {
    alias: [
      { find: '@vevit-games/engine/core', replacement: resolve(root, 'packages/engine/src/core.ts') },
      { find: '@vevit-games/engine', replacement: resolve(root, 'packages/engine/src/index.ts') },
      { find: /^@vevit-games\/rules\/(.*)$/, replacement: resolve(root, 'packages/rules/src/$1/index.ts') },
      { find: '@vevit-games/rules', replacement: resolve(root, 'packages/rules/src/index.ts') },
      { find: '@vevit-games/ui', replacement: resolve(root, 'packages/ui/src/index.ts') },
      { find: '@titles', replacement: resolve(root, 'titles') },
    ],
  },
  test: {
    include: ['packages/**/*.test.ts', 'titles/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
  },
});
