'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { ThemeEngineProvider } from '@/components/providers/ThemeEngineProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            gcTime: 1000 * 60 * 10,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        // next-themes writes its own `color-scheme` INLINE style on <html>
        // by default (enableColorScheme defaults true) — inline styles beat
        // any stylesheet rule outright, so it silently overrode Theme
        // Engine's own `[data-theme] { color-scheme }` CSS (th-components.css),
        // leaving native form controls (any plain <input> with no explicit
        // bg/text classes) following raw OS dark preference instead of the
        // app's actual active theme: dark chrome, near-black inherited text,
        // unreadable. Theme Engine owns color-scheme now.
        enableColorScheme={false}
      >
        <ThemeEngineProvider>
          {children}
          <Toaster />
        </ThemeEngineProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
