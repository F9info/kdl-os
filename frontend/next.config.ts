import type { NextConfig } from 'next'

// Parse comma-separated image host entries from the env var.
// Format: "protocol:hostname:port" where port is optional.
// Example: NEXT_PUBLIC_IMAGE_HOSTS="http:localhost:9000,https:cdn.example.com"
function parseImageHosts(): Array<{ protocol: 'http' | 'https'; hostname: string; port?: string }> {
  const raw = process.env.NEXT_PUBLIC_IMAGE_HOSTS
  if (raw) {
    return raw.split(',').map((entry) => {
      const [protocol, hostname, port] = entry.trim().split(':')
      const pattern: { protocol: 'http' | 'https'; hostname: string; port?: string } = {
        protocol: (protocol as 'http' | 'https') ?? 'https',
        hostname: hostname ?? '',
      }
      if (port) pattern.port = port
      return pattern
    })
  }
  // Dev default: MinIO on localhost:9000
  return [{ protocol: 'http', hostname: 'localhost', port: '9000' }]
}

// Derives the img-src hosts string for CSP from the same env var.
function cspImageSrc(): string {
  const raw = process.env.NEXT_PUBLIC_IMAGE_HOSTS
  if (!raw) return 'http://localhost:9000'
  return raw
    .split(',')
    .map((entry) => {
      const [protocol, hostname, port] = entry.trim().split(':')
      return port ? `${protocol}://${hostname}:${port}` : `${protocol}://${hostname}`
    })
    .join(' ')
}

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: parseImageHosts(),
  },
  async headers() {
    const imgSrc = cspImageSrc()
    // Next.js App Router injects inline scripts for hydration, requiring
    // 'unsafe-inline'. Nonce-based CSP would remove this but needs middleware
    // (out of scope for this task — tracked as a follow-up).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${imgSrc}`,
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
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
