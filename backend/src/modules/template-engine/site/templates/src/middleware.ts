import { NextResponse, type NextRequest } from 'next/server'

// Friendly URLs only: old links that still carry ?projectId=<id> redirect to the clean path
// (the project scope comes from NEXT_PUBLIC_SITE_PROJECT_ID, written by the generator).
export function middleware(req: NextRequest) {
  const url = req.nextUrl
  if (url.searchParams.has('projectId')) {
    url.searchParams.delete('projectId')
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|api|seed|vendor).*)'] }
