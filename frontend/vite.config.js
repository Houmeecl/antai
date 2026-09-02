import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo el frontend corre en 5173 y el backend en 3001. El
    // proxy hace que /api sea del mismo origen para el navegador, así no
    // hay que configurar CORS ni en desarrollo ni en producción (donde
    // Express sirve el build).
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
});
