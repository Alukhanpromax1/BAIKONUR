/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { HttpsProxyAgent } from 'https-proxy-agent';

// The public JPL Horizons API does not send CORS headers, so the browser cannot call it
// directly. In development and preview we proxy /api/horizons to the official endpoint;
// in production the same path is served by the serverless function in api/horizons.js.
// If the machine itself sits behind an HTTPS proxy (HTTPS_PROXY), the dev proxy tunnels through it.
const upstreamProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const horizonsProxy = {
  '/api/horizons': {
    target: 'https://ssd.jpl.nasa.gov',
    changeOrigin: true,
    ...(upstreamProxy ? { agent: new HttpsProxyAgent(upstreamProxy) } : {}),
    rewrite: (path: string) => path.replace(/^\/api\/horizons/, '/api/horizons.api'),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { proxy: horizonsProxy },
  preview: { proxy: horizonsProxy },
  build: {
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
