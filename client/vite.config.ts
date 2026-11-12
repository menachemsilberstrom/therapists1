import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies /api and /uploads to the Express server, so the browser sees a single origin
// (no CORS setup needed). Set API_PROXY_TARGET if the API runs somewhere other than localhost:5000.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget, // avatars
    },
  },
});
