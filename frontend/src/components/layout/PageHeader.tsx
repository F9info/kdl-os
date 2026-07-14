import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface PageHeaderProps {
  title: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  action?: React.ReactNode
}

export function PageHeader({ title, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-1">
        {/* font-size driven by the Template Engine's Typography > H1 (Desktop)
            token when the runtime provider has injected it — the compiled
            token is a bare number (its "px" unit is display-only metadata in
            the editor), so it's multiplied by 1px via calc() rather than
            used directly; 24 is the text-2xl (1.5rem) fallback. */}
        <h1
          className="font-semibold tracking-tight"
          style={{ fontSize: 'calc(var(--typography_desktop_font_size_h1_title, 24) * 1px)' }}
        >
          {title}
        </h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
