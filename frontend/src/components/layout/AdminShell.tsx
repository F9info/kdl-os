import { AdminSidebar } from './AdminSidebar'
import { TopBar } from './TopBar'

interface AdminShellProps {
  children: React.ReactNode
}

// Shell geometry (sidebar position, page padding, container width, footer
// height) follows the Template Engine's Layout tokens via the te-* classes
// defined in app/te-layout.css (KDL-212).
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="te-admin-shell flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="te-page flex-1 overflow-y-auto">
          <div className="te-container">{children}</div>
        </main>
        <footer className="te-footer flex shrink-0 items-center justify-center border-t text-xs text-muted-foreground">
          KDL Admin
        </footer>
      </div>
    </div>
  )
}
