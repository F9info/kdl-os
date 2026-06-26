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
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ]
  },
}

export default config
