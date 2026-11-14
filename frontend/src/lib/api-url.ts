// The one place that knows where the API lives. NEXT_PUBLIC_API_URL is set in every real deployment
// (behind nginx it is just "/api"); the localhost address is only the fallback for a bare `pnpm dev`.
// Next.js inlines the variable at build time, so it must be read as written here.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
