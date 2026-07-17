# Performance Budgets — First-Load JS (KDL-295)

Run `pnpm analyze` (from `frontend/`) to get live bundle sizes.  
Set `ANALYZE=1` env var — the analyzer writes HTML reports to `.next/analyze/`.

---

## Route Groups

| Route Group | Example Routes | First-Load JS Budget |
|---|---|---|
| `(auth)` | `/login`, `/register`, `/forgot-password`, `/reset-password` | ≤ 120 kB |
| `admin` (shared layout) | `/admin/dashboard`, `/admin/users`, etc. | ≤ 200 kB |
| `admin/*` (per-page delta) | Any individual admin page | ≤ 80 kB |
| Root / public | `/`, `/share/[token]`, `/p/[slug]` | ≤ 100 kB |

All sizes are **gzip-compressed**. Next.js reports raw sizes; divide by ~3 for a gzip estimate, or use the analyzer's "Parsed" vs "Gzipped" toggle.

---

## Baseline (branch `feat/kdl-295-perf-bundle-analyzer`)

> **Baseline not yet captured.** Run `pnpm analyze` after a successful production build to populate this section.  
> The CI build requires a running backend for env vars — stub values are sufficient for a size-only run:
> ```bash
> cd frontend
> ANALYZE=1 BACKEND_INTERNAL_URL=http://localhost:4000 pnpm build
> ```
> Copy the "First Load JS" column from the Next.js build output into the table below.

| Route | First Load JS (raw) | Status |
|---|---|---|
| `/(auth)/login` | TBD | — |
| `/(auth)/register` | TBD | — |
| `/admin/dashboard` | TBD | — |
| `/admin/users` | TBD | — |
| `/admin/media` | TBD | — |
| `/admin/template-engine` | TBD | — |
| Shared by `admin` layout | TBD | — |

---

## Budget Enforcement

Budgets are currently advisory. To fail CI on overages add the `--no-lint` flag and parse the Next.js build output in the workflow.  
A future task can wire this into `next.config.ts` via the `experimental.bundlePagesExternals` or a custom webpack `performance.maxAssetSize` hint.

---

## Core Web Vitals Targets (RUM)

Collected via `useReportWebVitals` → `POST /api/vitals` (stub, KDL-295).

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 |
| INP | ≤ 200 ms | 200–500 ms | > 500 ms |

Thresholds match [web.dev/vitals](https://web.dev/articles/vitals) recommendations.
