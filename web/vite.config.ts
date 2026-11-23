import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :8000 (uvicorn --reload); /api is proxied so the
// browser talks to a single origin, exactly like the nginx setup in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8000', changeOrigin: true },
    },
  },
});
