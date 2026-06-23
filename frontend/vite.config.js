import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // viteSingleFile inlines all JS/CSS into one index.html on build (dev unaffected),
  // so the whole UI ships as a single string the backend can embed.
  plugins: [react(), viteSingleFile()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
  },
});
