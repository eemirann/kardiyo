import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Uretimde Vercel /api/* isteklerini API'ye yonlendiriyor (vercel.json).
    // Yerelde ayni davranisi kurup cerezin hep birinci taraf kalmasini sagliyoruz.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
