// Same image hosts as the admin frontend (NEXT_PUBLIC_IMAGE_HOSTS="http:localhost:9002,...").
const hosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? 'http:localhost:9000').split(',').map((e) => {
  const [protocol, hostname, port] = e.trim().split(':')
  return { protocol, hostname, ...(port ? { port } : {}) }
})

const backend = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:4000'
const admin = process.env.FRONTEND_INTERNAL_URL ?? 'http://localhost:3000'

/** @type {import('next').NextConfig} */
// Set by compose when the site sits behind nginx next to the admin app (same origin).
const assetPrefix = process.env.SITE_ASSET_PREFIX || undefined

export default {
  assetPrefix,
  images: { remotePatterns: hosts },
  // Lives inside the admin repo; don't inherit its lint config, and the copied
  // admin code is already type-checked there.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      // Static assets shipped with the admin frontend (seed images, vendor libs).
      { source: '/seed/:path*', destination: `${admin}/seed/:path*` },
      { source: '/vendor/:path*', destination: `${admin}/vendor/:path*` },
    ]
  },
}
