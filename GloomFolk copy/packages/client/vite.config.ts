import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy the game WebSocket through the dev server so phones on the LAN
      // (or behind a tunnel) only need a single port/origin open.
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
});
