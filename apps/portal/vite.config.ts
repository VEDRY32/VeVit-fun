import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // Pořadí rozhoduje: přesnější zápis musí být dřív, jinak by obecné
    // '@vevit-games/ui' spolklo i podcestu se stylem.
    alias: [
      { find: '@vevit-games/ui/styles.css', replacement: resolve(root, 'packages/ui/src/styles/tokens.css') },
      { find: '@vevit-games/engine/core', replacement: resolve(root, 'packages/engine/src/core.ts') },
      { find: '@vevit-games/engine', replacement: resolve(root, 'packages/engine/src/index.ts') },
      { find: /^@vevit-games\/rules\/(.*)$/, replacement: resolve(root, 'packages/rules/src/$1/index.ts') },
      { find: '@vevit-games/rules', replacement: resolve(root, 'packages/rules/src/index.ts') },
      { find: '@vevit-games/ui', replacement: resolve(root, 'packages/ui/src/index.ts') },
      { find: '@titles', replacement: resolve(root, 'titles') },
    ],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        // Offline stránka je samostatný vstup: nesmí táhnout React ani
        // shell portálu, protože se servíruje právě tehdy, když se nic
        // dalšího stáhnout nedá.
        main: resolve(import.meta.dirname, 'index.html'),
        offline: resolve(import.meta.dirname, 'offline.html'),
        sw: resolve(import.meta.dirname, 'src/sw.ts'),
      },
      output: {
        // Service worker musí ležet v kořeni a mít stálý název, jinak by
        // po nasazení neřídil celý rozsah.
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        // Každá hra má vlastní chunk — portál se nesmí stahovat kvůli
        // jediné hře celý.
        manualChunks(id: string) {
          if (id.includes('/titles/')) {
            const match = /\/titles\/([^/]+)\//.exec(id);
            if (match) return `hra-${match[1]}`;
          }
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
