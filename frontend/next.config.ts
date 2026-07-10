import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
    ],
  },
  async rewrites() {
    // Proxy API calls through the Next.js origin so the browser only ever talks to
    // one origin (localhost:3001). This makes the httpOnly auth cookie first-party,
    // which the middleware can read reliably. The Next server reaches the backend
    // over the internal Docker network (service name `backend`). NOTE: rewrites()
    // is evaluated at BUILD time, so BACKEND_INTERNAL_URL must be present during
    // `pnpm build` to override the default (Docker service `backend:4000`). For
    // non-Docker `pnpm dev`, set BACKEND_INTERNAL_URL=http://localhost:4000.
    const backend = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
    return [
      // KDL-148: the media "Share / copy link" feature builds public link URLs
      // as `<frontend-origin>/share/:token` (see ShareDialog.tsx shareUrl()),
      // but the backend only serves that path unauthenticated at its own
      // origin, outside /api (see backend/src/index.js — deliberately kept
      // off the /api rate limiter). Without this proxy, the copied link 404s
      // on the frontend origin because there is no Next.js route registered
      // at the exact path `/share/[token]` other than the page itself, which
      // needs *this* JSON to render. Proxy it under /api so the page's client
      // fetch can reach it without exposing the backend's internal/public host.
      //
      // MUST come before the generic '/api/:path*' rule below — Next.js uses
      // the first matching rewrite, and `:path*` would otherwise also match
      // `public-share/:token` and forward it to the (nonexistent) backend
      // route `/api/public-share/:token`, 404ing every time.
      { source: '/api/public-share/:path*', destination: `${backend}/share/:path*` },
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ]
  },
}

export default config
