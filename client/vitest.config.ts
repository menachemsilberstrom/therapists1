import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Same build pipeline as the app (React, Tailwind), plus the test settings below.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom', // a simulated browser, so React components can be rendered and clicked
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      css: false, // class names are enough for the tests; no need to process Tailwind
      restoreMocks: true,
    },
  }),
);
