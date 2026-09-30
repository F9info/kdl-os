import { defineConfig } from 'vitest/config'
import path from 'path'

// Vitest 4 removed `environmentMatchGlobs`; one project per environment replaces it.
// `extends: true` inherits the shared options below (globals, setup, alias, esbuild).
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/rtl/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'rtl',
          environment: 'jsdom',
          include: ['tests/rtl/**/*.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: ['tests/rtl/**/*.test.tsx', '**/node_modules/**'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
})
