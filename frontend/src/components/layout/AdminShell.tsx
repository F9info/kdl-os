import { AdminSidebar } from './AdminSidebar'
import { TopBar } from './TopBar'
import { CommandMenu } from '@/components/command/CommandMenu'

interface AdminShellProps {
  children: React.ReactNode
}

// Shell geometry (sidebar position, page padding, container width, footer
// height) follows the Theme Engine Layout tokens via the te-* classes
// defined in app/te-layout.css (KDL-212).
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="th-admin-shell flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main id="main-content" className="th-page flex-1 overflow-y-auto">
          <div className="th-container">{children}</div>
        </main>
        <footer className="th-footer flex shrink-0 items-center justify-center border-t text-xs text-muted-foreground">
          KDL Admin
        </footer>
      </div>
      <CommandMenu />
    </div>
  )
}
