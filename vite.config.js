import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      // Arte-fonte e vídeos ficam travados enquanto são gravados e derrubam o watcher no Windows.
      ignored: ['**/art/**', '**/tools/**'],
    },
  },
});
