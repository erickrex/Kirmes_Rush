import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@play': resolve(__dirname, 'src/play'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@data': resolve(__dirname, 'src/data'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@input': resolve(__dirname, 'src/input'),
      '@graphics': resolve(__dirname, 'src/graphics'),
      '@util': resolve(__dirname, 'src/util')
    }
  },
  // Configure public directory for static assets
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Increase chunk size warning limit for game assets
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        },
        // Configure asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          // Organize assets by type in the build output
          if (/png|jpe?g|gif|svg|webp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/mp3|ogg|wav|flac/i.test(ext)) {
            return `assets/audio/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          if (/xml/i.test(ext)) {
            return `assets/data/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    }
  },
  // Asset handling configuration
  assetsInclude: [
    // Image formats
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.webp',
    // Audio formats (FNF uses OGG natively, MP3 for web)
    '**/*.ogg',
    '**/*.mp3',
    '**/*.wav',
    // Data formats
    '**/*.xml',  // Sparrow atlas format
    '**/*.json',
    // Font formats
    '**/*.ttf',
    '**/*.otf',
    '**/*.woff',
    '**/*.woff2'
  ],
  server: {
    port: 3000,
    open: true,
    // Configure CORS for local development
    cors: true,
    // Configure headers for proper MIME types
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    port: 4173
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['phaser']
  },
  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
