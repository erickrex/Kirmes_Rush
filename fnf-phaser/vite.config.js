import { defineConfig } from 'vite';
import fs from 'node:fs';
import path, { resolve } from 'node:path';

const appRoot = resolve(__dirname);
const repoRoot = resolve(__dirname, '..');
const assetSourceDir = resolve(repoRoot, 'assets', 'funkin.assets');
const assetTargetDir = 'assets/funkin.assets';

function getContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.json': return 'application/json';
    case '.xml': return 'application/xml';
    case '.mp3': return 'audio/mpeg';
    case '.ogg': return 'audio/ogg';
    case '.wav': return 'audio/wav';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

async function copyDirectory(source, target) {
  await fs.promises.mkdir(target, { recursive: true });
  const entries = await fs.promises.readdir(source, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = resolve(source, entry.name);
    const targetPath = resolve(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      return;
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, targetPath);
  }));
}

function funkinAssetBridge() {
  return {
    name: 'funkin-asset-bridge',
    configureServer(server) {
      server.middlewares.use('/assets/funkin.assets', async (req, res, next) => {
        const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const relativePath = requestPath.replace(/^\/+/, '');
        const filePath = resolve(assetSourceDir, relativePath);

        if (!filePath.startsWith(assetSourceDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        try {
          const stat = await fs.promises.stat(filePath);
          if (!stat.isFile()) {
            next();
            return;
          }

          res.setHeader('Content-Type', getContentType(filePath));
          fs.createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    async writeBundle() {
      await copyDirectory(assetSourceDir, resolve(appRoot, 'dist', assetTargetDir));
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [funkinAssetBridge()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@play': resolve(__dirname, 'src/play'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@data': resolve(__dirname, 'src/data'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@input': resolve(__dirname, 'src/input'),
      '@graphics': resolve(__dirname, 'src/graphics')
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
        // Isolate the Phaser engine into its own chunk so the application
        // chunk stays below the chunk-size warning threshold and the engine
        // can be cached separately from app code.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
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
    cors: true
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
