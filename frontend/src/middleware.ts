import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PREFIX = '/admin'

function isValidToken(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof payload.exp !== 'number') return false
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith(ADMIN_PREFIX)) {
    // The access cookie is short-lived (15m). On a hard refresh it is often
    // expired, so also accept a still-valid refresh token as proof of an active
    // session — the admin layout restores the access token on mount, and the API
    // re-verifies every request. Without this, every reload after 15m logs out.
    const accessToken = req.cookies.get('kdl-auth-token')?.value
    const refreshToken = req.cookies.get('kdl-refresh-token')?.value
    const sessionAlive =
      (accessToken && isValidToken(accessToken)) || (refreshToken && isValidToken(refreshToken))
    if (!sessionAlive) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
