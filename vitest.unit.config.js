import { defineConfig, configDefaults } from 'vitest/config';
import { mergeConfig } from 'vite';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.js'],
      exclude: [...configDefaults.exclude, 'tests/integration/**'],
    },
  })
);
