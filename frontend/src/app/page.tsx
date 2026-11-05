import { SitePage } from './_site/SitePage'

// The public website's home. No published home page yet → login (fresh install).
export default function RootPage() {
  return <SitePage pageKey="home" fallbackToLogin />
}
