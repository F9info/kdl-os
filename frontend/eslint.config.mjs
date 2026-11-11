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
  // ── Architecture boundaries (docs/planning/09-admin-frontend-architecture.md) ─────────────────
  // The Admin controls the website, the Frontend renders it. Rendering code never imports admin UI,
  // the shared layer imports neither area, and admin never imports a public route.
  {
    files: ['src/frontend/**/*.{ts,tsx}', 'src/app/(site)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/admin/*', '@/app/admin/*'],
              message:
                'Public website code must not import admin code. Move what both need to the shared layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/stores/**/*.{ts,tsx}',
      'src/types/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/admin/*', '@/frontend/*', '@/app/*'],
              message:
                'The shared layer must not import from the admin area, the public website area, or routes.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/admin/**/*.{ts,tsx}', 'src/app/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/(site)/*'],
              message: 'Admin code must not import public route files.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
