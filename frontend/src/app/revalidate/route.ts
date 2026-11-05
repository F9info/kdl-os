import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { PUBLIC_PAGES_TAG, isValidRevalidateToken } from '@/frontend/lib/revalidate'

/**
 * Called by the backend after a page is published, unpublished or its SEO changes: drops the cached
 * page data behind the public <head> so the change shows at once instead of within 60 s.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.JWT_SECRET
  if (!secret) return NextResponse.json({ revalidated: false }, { status: 503 })
  if (!isValidRevalidateToken(req.headers.get('x-revalidate-token'), secret)) {
    return NextResponse.json({ revalidated: false }, { status: 401 })
  }
  revalidateTag(PUBLIC_PAGES_TAG)
  return NextResponse.json({ revalidated: true })
}
