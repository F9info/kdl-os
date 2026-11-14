# Frontend Architecture — KDL Starter Kit

**Phase 4 — Frontend Architecture Design**
**Author:** Frontend Architect Agent (386b2609)
**Date:** 2026-06-25
**Stack:** Next.js 15 App Router + TypeScript 5 strict + TailwindCSS 3 + shadcn/ui + Zustand 5 + TanStack Query 5

---

## 1. package.json — Dependencies

```json
{
  "name": "kdl-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",

    // State management
    "zustand": "^5.0.0",

    // Server state / data fetching
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.0.0",

    // API client
    "axios": "^1.7.0",

    // Validation
    "zod": "^3.23.0",

    // Forms
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",

    // UI — shadcn/ui installs these via CLI
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.460.0",

    // Theme
    "next-themes": "^0.3.0",

    // Utilities
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

---

## 2. TypeScript Configuration

**`tsconfig.json`** — strict mode, path aliases

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 3. lib/ — Utility Modules

### `lib/axios.ts`

Single axios instance — all API calls must use this. Never `fetch` or a second instance.

```typescript
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach access token from auth store
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor — handle 401 → refresh → retry
let isRefreshing = false
let failQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
          return api(original)
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        )
        const newAccessToken: string = data.data.accessToken
        const newRefreshToken: string = data.data.refreshToken
        useAuthStore.getState().setAuth(useAuthStore.getState().user!, newAccessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
        failQueue.forEach(({ resolve }) => resolve(newAccessToken))
        failQueue = []
        return api(original)
      } catch {
        failQueue.forEach(({ reject }) => reject(error))
        failQueue = []
        useAuthStore.getState().clearAuth()
        localStorage.removeItem('refreshToken')
        if (typeof window !== 'undefined') window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
```

> Note: `useAuthStore` is imported lazily (`.getState()`) to avoid circular deps — Zustand stores support this pattern.

### `lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,      // 2 minutes
      gcTime: 1000 * 60 * 10,         // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
```

### `lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt)
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? 'B'}`
}
```

---

## 4. types/ — TypeScript Type Definitions

### `types/api.types.ts`

```typescript
export interface ApiResponse<T> {
  success: true
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
```

### `types/models.types.ts`

```typescript
export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  description: string | null
  is_public: boolean
}

export interface Media {
  id: string
  user_id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  bucket: string
  path: string
  url: string
  created_at: string
}
```

---

## 5. stores/ — State Management

### `stores/auth.store.ts`

Single source of truth for auth state. Never replicate in component state.

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/models.types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthActions {
  setAuth: (user: User, accessToken: string) => void
  clearAuth: () => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false }),

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'kdl-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

### `stores/ui.store.ts`

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UiState {
  sidebarOpen: boolean
  theme: Theme
}

interface UiActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: Theme) => void
}

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: 'system',

      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'kdl-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

---

## 6. hooks/ — Custom Hooks

### `hooks/useAuth.ts`

```typescript
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/axios'

export function useAuth() {
  const { user, isAuthenticated, isLoading, clearAuth } = useAuthStore()
  const router = useRouter()

  const { mutate: logout, isPending: isLoggingOut } = useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('refreshToken')
      await api.post('/auth/logout', { refreshToken })
    },
    onSettled: () => {
      clearAuth()
      localStorage.removeItem('refreshToken')
      router.push('/login')
    },
  })

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    logout,
    isLoggingOut,
  }
}
```

### `hooks/usePagination.ts`

```typescript
import { useState, useCallback } from 'react'

interface UsePaginationOptions {
  initialPage?: number
  initialLimit?: number
}

export function usePagination({ initialPage = 1, initialLimit = 10 }: UsePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  const reset = useCallback(() => setPage(1), [])

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }, [])

  return { page, limit, setPage, setLimit: handleLimitChange, reset }
}
```

### `hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
```

### `hooks/useMediaQuery.ts`

```typescript
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}
```

---

## 7. components/layout/ — Layout Components

### `components/layout/AdminShell.tsx`

Root layout wrapper. Composes sidebar + top bar + main content.

```
Props: { children: ReactNode }
Layout: flex h-screen overflow-hidden
  ├── AdminSidebar (fixed left, w-64 collapsed=w-16)
  └── div flex-1 flex flex-col overflow-hidden
        ├── TopBar (sticky top-0)
        └── main (flex-1 overflow-y-auto p-6)
              {children}
```

### `components/layout/AdminSidebar.tsx`

Collapsible sidebar with role-gated nav links.

```
State: reads sidebarOpen from ui.store

Nav items (always shown):
  - Dashboard  →  /admin/dashboard   (icon: LayoutDashboard)
  - Settings   →  /admin/settings    (icon: Settings)

Nav items (isAdmin only):
  - Users      →  /admin/users       (icon: Users)
  - Media      →  /admin/media       (icon: Image)

Active state: next/navigation usePathname() matches href
Collapsed: show icon only (tooltip with label)
```

### `components/layout/TopBar.tsx`

```
Layout: h-16 border-b flex items-center justify-between px-4
  Left:  <Button variant="ghost" size="icon"> hamburger → ui.store.toggleSidebar()
  Right: <DropdownMenu>
           trigger: <Avatar> (initials from user.name)
           items:
             - user.name + user.email (header, non-clickable)
             - separator
             - Profile (future)
             - separator
             - Sign out → useAuth().logout()
```

### `components/layout/PageHeader.tsx`

```typescript
interface PageHeaderProps {
  title: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  action?: React.ReactNode
}

// Layout: flex items-center justify-between mb-6
//   Left: title (h1) + breadcrumb trail
//   Right: {action} slot
```

---

## 8. components/shared/ — Shared Components

### `components/shared/DataTable.tsx`

TanStack Table v8 wrapper with loading skeleton + empty state + pagination.

```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading: boolean
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  emptyMessage?: string
}
```

Loading state: renders skeleton rows (5 rows × column count cells).
Empty state: centered message + optional icon.

### `components/shared/Modal.tsx`

shadcn Dialog wrapper with consistent header/footer layout.

```typescript
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}
```

### `components/shared/ConfirmDialog.tsx`

Destructive action confirmation — always shows warning color.

```typescript
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string   // default: "Delete"
  isLoading?: boolean
  variant?: 'destructive' | 'warning'
}
```

### `components/shared/Pagination.tsx`

```typescript
interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}
// Shows: < [1] [2] [3] ... [N] >
// Max 7 page buttons; ellipsis for large page counts
```

### `components/shared/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  variant: 'active' | 'inactive' | 'user' | 'admin' | 'super_admin'
  label?: string
}
// Maps variants to tailwind color classes
```

### `components/shared/FileUpload.tsx`

```typescript
interface FileUploadProps {
  onFile: (file: File) => void
  accept?: string           // default: "image/*,application/pdf"
  maxSizeMB?: number        // default: 10
  disabled?: boolean
}
// Drag-and-drop zone + click-to-browse
// Client-side validation: type in accept list, size <= maxSizeMB
// Shows selected file name + size after selection
```

### `components/shared/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean   // centers in viewport when true
}
```

### `components/shared/ErrorAlert.tsx`

Extracts human-readable message from AxiosError.

```typescript
interface ErrorAlertProps {
  error: unknown
  className?: string
}
// Reads error.response.data.message or fallback to error.message
// Renders shadcn Alert with destructive variant
```

### `components/shared/FormField.tsx`

react-hook-form field wrapper with label + error message.

```typescript
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}
```

---

## 9. Auth Pages — `app/(auth)/`

### `app/(auth)/layout.tsx`

Minimal unauthenticated layout — no sidebar.

```
Background: bg-muted/40
Center: min-h-screen flex items-center justify-center
Card: w-full max-w-md rounded-xl border bg-card p-8 shadow-sm
  ├── Logo (top, centered)
  └── {children}
```

Redirect logic: if `isAuthenticated && !isLoading` → `router.push('/admin/dashboard')`

### `app/(auth)/login/page.tsx`

**Zod schema:**
```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormData = z.infer<typeof loginSchema>
```

**Form fields:** email, password (toggle visibility), remember me (checkbox)

**Submit flow:**
1. `useMutation` → `POST /api/auth/login`
2. On success: `auth.store.setAuth(data.user, data.accessToken)`, `localStorage.setItem('refreshToken', data.refreshToken)`, redirect `/admin/dashboard`
3. On error: render `<ErrorAlert error={error} />`

**Links:** "Forgot password?" → `/forgot-password`, "Create account" → `/register`

### `app/(auth)/register/page.tsx`

**Zod schema:**
```typescript
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
```

**Form fields:** name, email, password, confirm password

**Submit flow:**
1. `useMutation` → `POST /api/auth/register`
2. On success: redirect `/login` with success toast ("Account created. Please sign in.")
3. On error: render `<ErrorAlert />`

**Links:** "Already have an account?" → `/login`

### `app/(auth)/forgot-password/page.tsx`

Two-step UI (local state `step: 'email' | 'sent'`).

**Step 1 — Email entry:**
```typescript
const forgotSchema = z.object({
  email: z.string().email(),
})
```
Submit: `useMutation` → `POST /api/auth/forgot-password` (placeholder — endpoint not yet in backend)
On success: `setStep('sent')`

**Step 2 — Confirmation:**
"Check your inbox. We've sent a reset link to [email]."
Button: "Resend email" (re-triggers mutation)

**Link:** "Back to sign in" → `/login` (both steps)

---

## 10. Admin Pages — `app/(admin)/`

### `app/(admin)/layout.tsx`

**AuthGuard** — client component, reads auth.store:
- `isLoading` → full-page spinner
- `!isAuthenticated` → `router.replace('/login')`
- Authenticated → `<AdminShell>{children}</AdminShell>`

### `app/(admin)/dashboard/page.tsx`

**Data requirements:** 4 stat queries + 1 recent-users query

```typescript
// Stat queries (parallel)
const { data: usersStats } = useQuery({
  queryKey: ['users', 'stats'],
  queryFn: () => api.get<PaginatedResponse<User>>('/users?limit=1').then(r => r.data),
})
// Total, Active, Settings count, Media count

// Recent users (last 5)
const { data: recentUsers } = useQuery({
  queryKey: ['users', 'recent'],
  queryFn: () => api.get<PaginatedResponse<User>>('/users?limit=5&page=1').then(r => r.data),
})
```

**Layout:**
```
PageHeader title="Dashboard"
Grid 2×2 (md:grid-cols-4):
  StatsCard: Total Users    (count from pagination.total)
  StatsCard: Active Users   (count from is_active filter)
  StatsCard: Settings       (count)
  StatsCard: Media Files    (count)
Section: Recent Users
  DataTable (read-only, no pagination)
```

**`StatsCard` component** (dashboard-only, defined in page file or components/dashboard/):
```typescript
interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  isLoading: boolean
}
```

### `app/(admin)/users/page.tsx`

**State:**
```typescript
const { page, limit, setPage, reset } = usePagination()
const [search, setSearch] = useState('')
const [roleFilter, setRoleFilter] = useState<Role | ''>('')
const [statusFilter, setStatusFilter] = useState<boolean | ''>('')
const debouncedSearch = useDebounce(search)
```

**Queries:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
  queryFn: () => api.get<PaginatedResponse<User>>('/users', {
    params: { page, limit, search: debouncedSearch || undefined, role: roleFilter || undefined, is_active: statusFilter === '' ? undefined : statusFilter }
  }).then(r => r.data),
})
```

**Mutations:**
```typescript
const updateUser = useMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
    api.patch(`/users/${id}`, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    toast({ title: 'User updated' })
    setEditUser(null)
  },
})

const deleteUser = useMutation({
  mutationFn: (id: string) => api.delete(`/users/${id}`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    toast({ title: 'User deleted' })
    setDeleteId(null)
  },
})
```

**Table columns:**
| Column | Type | Notes |
|--------|------|-------|
| Name | string | + email below (smaller, muted) |
| Role | StatusBadge | SUPER_ADMIN/ADMIN/USER variants |
| Status | StatusBadge | active/inactive |
| Joined | formatted date | formatDate(created_at) |
| Actions | buttons | Edit (pencil icon), Delete (trash icon, destructive) |

**Modals:**
- Edit User Modal: name input, email input, role `<Select>`, is_active `<Switch>`
  - Zod: `z.object({ name: z.string().min(2), email: z.string().email(), role: z.enum(['USER','ADMIN','SUPER_ADMIN']), is_active: z.boolean() })`
- Delete ConfirmDialog: "Delete [name]? This cannot be undone."

**Zod schemas for forms** (defined in-file or `app/(admin)/users/_schemas.ts`):
```typescript
const updateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
  is_active: z.boolean(),
})
```

### `app/(admin)/settings/page.tsx`

**State:**
```typescript
const [editSetting, setEditSetting] = useState<Setting | null>(null)
const [deleteId, setDeleteId] = useState<string | null>(null)
```

**Query:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['settings'],
  queryFn: () => api.get<ApiResponse<Setting[]>>('/settings').then(r => r.data),
})
```

**Mutations:** create, update, delete — all invalidate `['settings']` on success.

**Layout:**
```
PageHeader title="Settings"
Grid md:grid-cols-3 gap-6:
  col-span-2: DataTable (key, value, type, is_public toggle, actions)
  col-span-1: "Add Setting" form panel (card)
```

**Table columns:**
| Column | Type |
|--------|------|
| Key | monospace string |
| Value | truncated string |
| Type | badge |
| Public | Switch (toggle → PATCH inline) |
| Actions | Edit (modal), Delete (confirm) |

**Add/Edit Setting Zod schema:**
```typescript
const settingSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Lowercase, numbers, underscores only'),
  value: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'json']),
  description: z.string().max(500).optional(),
  is_public: z.boolean(),
})
```

---

## 11. App Root — `app/`

### `app/layout.tsx`

```typescript
// Root layout — server component
// Renders: <html> + <body> + <Providers>
// Font: next/font/google (Inter)
// ThemeProvider from next-themes (attribute="class")
```

### `app/providers.tsx`

```typescript
'use client'
// QueryClientProvider (queryClient from lib/queryClient)
// ThemeProvider (defaultTheme="system", enableSystem)
// Toaster (shadcn toast component)
```

### `app/page.tsx`

```typescript
// Root redirect: redirect('/login') — server component
import { redirect } from 'next/navigation'
export default function RootPage() { redirect('/login') }
```

### `middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PREFIX = '/admin'
const AUTH_PAGES = ['/login', '/register', '/forgot-password']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Token check via cookie (httpOnly cookie for SSR auth — future enhancement)
  // For SPA: client-side AuthGuard handles redirect; middleware handles cookie-based SSR
  if (pathname.startsWith(ADMIN_PREFIX)) {
    const token = req.cookies.get('kdl-auth-token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

> Note: For full SSR auth, set an httpOnly cookie on login alongside localStorage. Middleware reads the cookie. AuthGuard (client) reads Zustand. Both gates fire independently.

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },  // MinIO dev
    ],
  },
  async rewrites() {
    // Only used in dev if not using proxy. In prod, nginx handles routing.
    return []
  },
}

export default config
```

---

## 12. Auth Flow — End-to-End

```
User visits /admin/*
  │
  ├── middleware.ts → no cookie → redirect /login
  │
  └── /login page
        │
        ├── Submit → POST /api/auth/login
        │     ↓
        │   Success: { data: { user, accessToken, refreshToken } }
        │     │
        │     ├── auth.store.setAuth(user, accessToken)
        │     ├── localStorage.setItem('refreshToken', refreshToken)
        │     └── redirect /admin/dashboard
        │
        └── Any subsequent API call via lib/axios.ts
              │
              ├── Request interceptor → Authorization: Bearer {accessToken}
              │
              └── 401 response
                    │
                    ├── POST /api/auth/refresh { refreshToken }
                    │     ↓
                    │   Success → new accessToken + refreshToken
                    │     ├── auth.store.setAuth(user, newAccessToken)
                    │     ├── localStorage.setItem('refreshToken', newRefreshToken)
                    │     └── retry original request
                    │
                    └── Refresh fails
                          ├── auth.store.clearAuth()
                          ├── localStorage.removeItem('refreshToken')
                          └── window.location.href = '/login'
```

---

## 13. Folder Structure — Final

```
frontend/
├── next.config.ts
├── tsconfig.json
├── package.json
├── tailwind.config.ts
├── postcss.config.js
├── middleware.ts
└── src/
    ├── app/
    │   ├── layout.tsx                    # Root layout (html + body + Providers)
    │   ├── page.tsx                      # redirect('/login')
    │   ├── providers.tsx                 # QueryClientProvider + ThemeProvider + Toaster
    │   ├── (auth)/
    │   │   ├── layout.tsx               # Centered card layout, redirect if authed
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   ├── register/
    │   │   │   └── page.tsx
    │   │   └── forgot-password/
    │   │       └── page.tsx
    │   └── (admin)/
    │       ├── layout.tsx               # AuthGuard + AdminShell
    │       ├── dashboard/
    │       │   └── page.tsx
    │       ├── users/
    │       │   ├── page.tsx
    │       │   └── _schemas.ts          # updateUserSchema
    │       └── settings/
    │           ├── page.tsx
    │           └── _schemas.ts          # settingSchema
    ├── components/
    │   ├── layout/
    │   │   ├── AdminShell.tsx
    │   │   ├── AdminSidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   └── PageHeader.tsx
    │   ├── shared/
    │   │   ├── DataTable.tsx
    │   │   ├── Modal.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── Pagination.tsx
    │   │   ├── StatusBadge.tsx
    │   │   ├── FileUpload.tsx
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ErrorAlert.tsx
    │   │   └── FormField.tsx
    │   └── ui/                          # shadcn/ui generated components
    │       ├── button.tsx
    │       ├── input.tsx
    │       ├── label.tsx
    │       ├── select.tsx
    │       ├── switch.tsx
    │       ├── dialog.tsx
    │       ├── dropdown-menu.tsx
    │       ├── toast.tsx
    │       ├── avatar.tsx
    │       ├── badge.tsx
    │       ├── card.tsx
    │       ├── separator.tsx
    │       └── skeleton.tsx
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── usePagination.ts
    │   ├── useDebounce.ts
    │   └── useMediaQuery.ts
    ├── lib/
    │   ├── axios.ts
    │   ├── queryClient.ts
    │   └── utils.ts
    ├── stores/
    │   ├── auth.store.ts
    │   └── ui.store.ts
    └── types/
        ├── api.types.ts
        └── models.types.ts
```

---

## 14. Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Router | Next.js 15 App Router | Matches stack requirement; server components for layout, client for interactive |
| Auth storage | Zustand (persist) + localStorage | SPA pattern; middleware uses httpOnly cookie for SSR protection (future) |
| API client | Single axios instance (lib/axios.ts) | Interceptors handle auth uniformly; raw fetch forbidden per CLAUDE.md |
| Server state | TanStack Query v5 | Automatic cache invalidation, deduplication, loading/error states |
| Client state | Zustand v5 | Auth + UI state; no Context API for global state |
| Validation | Zod + react-hook-form/resolvers | Zod required per CLAUDE.md; zodResolver bridges form + schema |
| UI components | shadcn/ui (Radix + Tailwind) | Accessible primitives, fully owned code, no runtime dependency |
| Token refresh | Axios interceptor with fail queue | Single inflight refresh; queued concurrent requests retry with new token |
| Route protection | middleware.ts (SSR) + AuthGuard (CSR) | Layered: middleware for cookie-gated SSR redirect, AuthGuard for client hydration |
| Table | TanStack Table v8 | Headless; works with any UI; handles sorting/pagination state |

---

## 15. Environment Variables

```bash
# Required in frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Only `NEXT_PUBLIC_*` vars are exposed to the browser. Never add `DATABASE_URL`, `REDIS_URL`, or any secret to frontend env.
