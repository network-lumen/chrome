import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'util', 'stream', 'process', 'path', 'os', 'crypto'],
      overrides: {
        fs: path.resolve(__dirname, 'src/mocks/fs.ts'),
      },
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      stream: 'stream-browserify',
      util: 'util',
      crypto: 'crypto-browserify',
      url: path.resolve(__dirname, 'src/mocks/url.ts'),
      'fs/promises': path.resolve(__dirname, 'src/mocks/fs.ts'),
      fs: path.resolve(__dirname, 'src/mocks/fs.ts'),
      path: 'path-browserify',
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        background: path.resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@cosmjs') || id.includes('cosmjs-types')) {
              return 'vendor-cosmjs';
            }
            if (id.includes('@lumen-chain/sdk')) {
              return 'vendor-lumen';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            return 'vendor';
          }
        }
      },
    },
  },
})
