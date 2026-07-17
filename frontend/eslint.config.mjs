import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

// next/core-web-vitals already registers the jsx-a11y plugin and recommended rules.
// Spread only the rules here to avoid "Cannot redefine plugin" ConfigError.
export default [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Harness introduction: surface pre-existing violations as warnings.
    // Each rule listed below was originally "error" in jsxA11y.flatConfigs.recommended.
    // Downgraded to "warn" here so the harness lands without blocking CI on legacy code.
    // Follow-up: KDL-346 a11y debt — fix violations and raise back to "error".
    files: ['**/*.{jsx,tsx}'],
    rules: Object.fromEntries(
      Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, cfg]) => [
        rule,
        Array.isArray(cfg) ? ['warn', ...cfg.slice(1)] : cfg === 'error' ? 'warn' : cfg,
      ])
    ),
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
